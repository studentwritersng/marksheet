"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveEffectiveStage } from "@/lib/license/stage-resolver";
import { calculateGroupPrice } from "@/lib/billing/progressive";

export interface GroupBillingData {
  groupId: string;
  groupName: string;
  feeGroupStage: string | null;
  stage: string;
  schoolCount: number;
  addons: {
    id: string;
    name: string;
    description: string | null;
    price: number | null;
    priceBreakdown: { basePrice: number; schoolCount: number; discount: number; subtotal: number; total: number } | null;
    durationDays: number | null;
    subscription: {
      id: string;
      status: string;
      startDate: string;
      endDate: string | null;
    } | null;
  }[];
}

export interface BillingActionResult { error?: string; success?: string }

// ── Get billing data for the proprietor's group ────────────────────────────

export async function getGroupBillingData(): Promise<GroupBillingData> {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    throw new Error("Not authorised.");
  }

  const groupId = user.proprietorGroupId;

  const [group, memberships, addons, subs] = await Promise.all([
    prisma.schoolGroup.findUniqueOrThrow({
      where: { id: groupId },
      select: { id: true, name: true, feeGroupStage: true },
    }),
    prisma.groupMembership.findMany({
      where: { groupId },
      select: { schoolId: true },
    }),
    prisma.addon.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, basicPrice: true, standardPrice: true, premiumPrice: true, price: true, durationDays: true },
    }),
    prisma.groupAddonSubscription.findMany({
      where: { groupId },
      select: { id: true, addonId: true, status: true, startDate: true, endDate: true },
    }),
  ]);

  const schoolCount = memberships.length;

  // Resolve the effective stage for pricing
  const firstSchoolId = memberships[0]?.schoolId;
  const effectiveStage = firstSchoolId
    ? await resolveEffectiveStage(firstSchoolId)
    : { stage: group.feeGroupStage ?? "basic" as const, overridden: false, groupName: null };

  const stage = effectiveStage.stage;

  return {
    groupId: group.id,
    groupName: group.name,
    feeGroupStage: group.feeGroupStage,
    stage,
    schoolCount,
    addons: addons.map((a) => {
      const sub = subs.find((s) => s.addonId === a.id);
      const stagePrice =
        stage === "basic" ? a.basicPrice
          : stage === "standard" ? a.standardPrice
            : a.premiumPrice;
      const basePrice = stagePrice !== null ? Number(stagePrice) : (a.price !== null ? Number(a.price) : null);

      // Progressive pricing always applies at group level
      let displayPrice = basePrice;
      let priceBreakdown: { basePrice: number; schoolCount: number; discount: number; subtotal: number; total: number } | null = null;
      if (basePrice !== null && schoolCount > 0) {
        priceBreakdown = calculateGroupPrice(basePrice, schoolCount);
        displayPrice = priceBreakdown.total;
      }

      return {
        id: a.id,
        name: a.name,
        description: a.description,
        price: displayPrice,
        priceBreakdown,
        durationDays: a.durationDays,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              startDate: sub.startDate.toISOString(),
              endDate: sub.endDate?.toISOString() ?? null,
            }
          : null,
      };
    }),
  };
}

// ── Purchase / renew addon at group level ────────────────────────────────────

export async function purchaseGroupAddonAction(
  _prev: BillingActionResult,
  formData: FormData,
): Promise<BillingActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== "proprietor" || !user.proprietorGroupId) {
    return { error: "Not authorised." };
  }
  if (user.proprietorPermissionLevel !== "full") {
    return { error: "Only full-access proprietors can purchase addons." };
  }

  const groupId = user.proprietorGroupId;
  const addonId = formData.get("addonId") as string;
  const durationDaysRaw = formData.get("durationDays") as string;
  const paymentReference = (formData.get("paymentReference") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!addonId) return { error: "Addon is required." };

  const addon = await prisma.addon.findUnique({ where: { id: addonId } });
  if (!addon) return { error: "Addon not found." };

  // Resolve duration
  const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : (addon.durationDays ?? 365);
  if (isNaN(durationDays) || durationDays < 1) return { error: "Invalid duration." };

  // Check if there's an existing active subscription
  const existing = await prisma.groupAddonSubscription.findUnique({
    where: { groupId_addonId: { groupId, addonId } },
  });

  const now = new Date();
  const endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

  if (existing) {
    // Extend from current end date or now (whichever is later)
    const baseDate = existing.endDate && existing.endDate > now ? existing.endDate : now;
    const newEndDate = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await prisma.groupAddonSubscription.update({
      where: { id: existing.id },
      data: {
        status: "active",
        endDate: newEndDate,
        paymentReference: paymentReference ?? existing.paymentReference,
        notes: notes ?? existing.notes,
      },
    });

    revalidatePath("/proprietor/billing");
    return { success: `${addon.name} renewed until ${newEndDate.toLocaleDateString()}.` };
  }

  // Create new subscription
  await prisma.groupAddonSubscription.create({
    data: {
      groupId,
      addonId,
      status: "active",
      startDate: now,
      endDate,
      paymentReference,
      setBy: user.userId,
      notes,
    },
  });

  revalidatePath("/proprietor/billing");
  return { success: `${addon.name} activated until ${endDate.toLocaleDateString()}.` };
}
