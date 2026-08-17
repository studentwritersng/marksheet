import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTransaction, paystackEnabled } from "@/lib/paystack";

type IntentRow = {
  id: string;
  kind: string;
  schoolId: string | null;
  groupId: string | null;
  amount: number;
  paystackRef: string | null;
  metadata: unknown;
};

async function fulfillIntent(intent: IntentRow) {
  const meta = (intent.metadata ?? {}) as Record<string, unknown>;
  const methodId = (meta.methodId as string) || undefined;
  const now = new Date();

  if (intent.kind === "school_plan") {
    const planId = meta.planId as string;
    const durationDays = Number(meta.durationDays ?? 365);
    const schoolId = intent.schoolId!;
    const existing = await prisma.schoolLicense.findFirst({
      where: { schoolId, status: { in: ["active", "grace_period"] } },
      orderBy: { endDate: "desc" },
    });
    if (existing) {
      await prisma.schoolLicense.update({
        where: { id: existing.id },
        data: {
          endDate: new Date(existing.endDate.getTime() + durationDays * 24 * 60 * 60 * 1000),
          status: "active",
        },
      });
    } else {
      await prisma.schoolLicense.create({
        data: {
          schoolId,
          planId,
          stage: (meta.stage as never) ?? null,
          startDate: now,
          endDate: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000),
          status: "active",
          paymentReference: `paystack-${intent.paystackRef ?? ""}`,
          notes: `Paystack payment ${intent.id}`,
        },
      });
    }
    await prisma.payment.create({
      data: {
        schoolId,
        planId,
        amount: intent.amount,
        paymentMethodId: methodId!,
        status: "verified",
        reference: intent.paystackRef ?? undefined,
        notes: "Paystack auto-verified",
      },
    });
  } else if (intent.kind === "school_addon") {
    const addonId = meta.addonId as string;
    const durationDays = meta.durationDays != null ? Number(meta.durationDays) : null;
    const schoolId = intent.schoolId!;
    const expiresAt = durationDays ? new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000) : null;
    const payment = await prisma.payment.create({
      data: {
        schoolId,
        addonId,
        amount: intent.amount,
        paymentMethodId: methodId!,
        status: "verified",
        reference: intent.paystackRef ?? undefined,
        notes: "Paystack auto-verified",
      },
    });
    await prisma.schoolAddon.upsert({
      where: { schoolId_addonId: { schoolId, addonId } },
      update: { status: "active", activatedVia: "purchase", expiresAt, paymentId: payment.id, activatedAt: now },
      create: { schoolId, addonId, status: "active", activatedVia: "purchase", expiresAt, paymentId: payment.id },
    });
  } else if (intent.kind === "group_addon") {
    const addonId = meta.addonId as string;
    const durationDays = meta.durationDays != null ? Number(meta.durationDays) : 365;
    const groupId = intent.groupId!;
    const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
    const existing = await prisma.groupAddonSubscription.findUnique({
      where: { groupId_addonId: { groupId, addonId } },
    });
    if (existing) {
      const baseDate = existing.endDate && existing.endDate > now ? existing.endDate : now;
      await prisma.groupAddonSubscription.update({
        where: { id: existing.id },
        data: {
          status: "active",
          endDate: new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000),
          paymentReference: `paystack-${intent.paystackRef ?? ""}`,
        },
      });
    } else {
      await prisma.groupAddonSubscription.create({
        data: {
          groupId,
          addonId,
          status: "active",
          startDate: now,
          endDate,
          paymentReference: `paystack-${intent.paystackRef ?? ""}`,
        },
      });
    }
  }
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference." }, { status: 400 });
  }

  if (!paystackEnabled()) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });
  }

  try {
    const data = await verifyTransaction(reference);

    // 1) Legacy registration invoice flow.
    const invoice = await prisma.invoice.findUnique({ where: { paystackRef: reference } });
    if (invoice) {
      if (data.status === "success" && invoice.status !== "paid") {
        await prisma.$transaction([
          prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "paid", paidAt: new Date(), method: "paystack" },
          }),
          prisma.schoolRegistration.update({
            where: { id: invoice.registrationId },
            data: { paymentStatus: "verified" },
          }),
        ]);
      }
      return NextResponse.json({ ok: data.status === "success", status: data.status, redirectTo: "/" });
    }

    // 2) Generic console payment intent.
    const intent = await prisma.paymentIntent.findUnique({ where: { paystackRef: reference } });
    if (!intent) {
      return NextResponse.json({ error: "Payment not found for reference." }, { status: 404 });
    }

    if (data.status === "success" && intent.status !== "paid") {
      await fulfillIntent(intent as unknown as IntentRow);
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "paid", paidAt: new Date() },
      });
    }

    const redirectTo = ((intent.metadata as Record<string, unknown> | null)?.redirectTo as string) ?? "/";
    return NextResponse.json({ ok: data.status === "success", status: data.status, redirectTo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Paystack verification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
