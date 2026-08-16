import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyTransaction, paystackEnabled } from "@/lib/paystack";

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

    const invoice = await prisma.invoice.findUnique({ where: { paystackRef: reference } });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found for reference." }, { status: 404 });
    }

    if (data.status === "success") {
      if (invoice.status !== "paid") {
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
      return NextResponse.json({ ok: true, status: "paid" });
    }

    return NextResponse.json({ ok: false, status: data.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Paystack verification failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
