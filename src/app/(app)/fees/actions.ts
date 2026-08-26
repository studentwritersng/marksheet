"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { canManageFees } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";

export interface ActionState {
  error?: string;
  success?: string;
}

async function requireBursar() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const perms = await resolvePermissions(user);
  if (!canManageFees(perms) || !user.schoolId) throw new Error("FORBIDDEN");
  return { user, schoolId: user.schoolId };
}

export async function withContext(): Promise<{ user: Awaited<ReturnType<typeof getCurrentUser>>; schoolId: string } | null> {
  try {
    return await requireBursar();
  } catch {
    return null;
  }
}

export async function createFeeItemAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await withContext();
  if (!ctx) return { error: "Not authorised." };

  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const termId = String(fd.get("termId") ?? "");
  const level = String(fd.get("level") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const amount = Number(fd.get("amount"));

  if (!termId || !level || !name || !Number.isFinite(amount) || amount < 0) {
    return { error: "Term, level, name, and a valid amount are required." };
  }

  const term = await prisma.term.findFirst({
    where: { id: termId, session: { schoolId: ctx.schoolId } },
    select: { id: true },
  });
  if (!term) return { error: "Term not found." };

  try {
    await prisma.feeItem.create({
      data: {
        schoolId: ctx.schoolId,
        termId,
        level,
        name,
        amount: new Prisma.Decimal(amount),
      },
    });
  } catch {
    return { error: "Could not add fee item (a duplicate level/name may already exist)." };
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "create",
    entityType: "fee_item",
    afterValue: { termId, level, name, amount } as never,
  });

  revalidatePath("/fees");
  return { success: "Fee item added." };
}

export async function updateFeeItemAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await withContext();
  if (!ctx) return { error: "Not authorised." };

  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const id = String(fd.get("id") ?? "");
  const level = String(fd.get("level") ?? "").trim();
  const name = String(fd.get("name") ?? "").trim();
  const amount = Number(fd.get("amount"));

  if (!id || !level || !name || !Number.isFinite(amount) || amount < 0) {
    return { error: "Level, name, and a valid amount are required." };
  }

  const existing = await prisma.feeItem.findFirst({
    where: { id, schoolId: ctx.schoolId },
  });
  if (!existing) return { error: "Fee item not found." };

  try {
    await prisma.feeItem.update({
      where: { id },
      data: { level, name, amount: new Prisma.Decimal(amount) },
    });
  } catch {
    return { error: "Could not update fee item (a duplicate level/name may already exist)." };
  }

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "update",
    entityType: "fee_item",
    entityId: id,
    beforeValue: { level: existing.level, name: existing.name, amount: existing.amount.toString() } as never,
    afterValue: { level, name, amount } as never,
  });

  revalidatePath("/fees");
  return { success: "Fee item updated." };
}

export async function deleteFeeItemAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await withContext();
  if (!ctx) return { error: "Not authorised." };

  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Fee item id is required." };

  const existing = await prisma.feeItem.findFirst({
    where: { id, schoolId: ctx.schoolId },
    select: { id: true, level: true, name: true, amount: true },
  });
  if (!existing) return { error: "Fee item not found." };

  await prisma.feeItem.delete({ where: { id } });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "delete",
    entityType: "fee_item",
    entityId: id,
    beforeValue: { level: existing.level, name: existing.name, amount: existing.amount.toString() } as never,
  });

  revalidatePath("/fees");
  return { success: "Fee item deleted." };
}

export async function copyFeeItemsFromTermAction(
  _prev: ActionState,
  fd: FormData,
): Promise<ActionState> {
  const ctx = await withContext();
  if (!ctx) return { error: "Not authorised." };

  try {
    await guardActiveLicense(ctx.schoolId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "License check failed." };
  }

  const fromTermId = String(fd.get("fromTermId") ?? "");
  const toTermId = String(fd.get("termId") ?? "");
  if (!fromTermId || !toTermId) {
    return { error: "Source and target terms are required." };
  }

  const [fromTerm, toTerm] = await Promise.all([
    prisma.term.findFirst({
      where: { id: fromTermId, session: { schoolId: ctx.schoolId } },
      select: { id: true },
    }),
    prisma.term.findFirst({
      where: { id: toTermId, session: { schoolId: ctx.schoolId } },
      select: { id: true },
    }),
  ]);
  if (!fromTerm) return { error: "Source term not found." };
  if (!toTerm) return { error: "Target term not found." };

  const sourceItems = await prisma.feeItem.findMany({
    where: { schoolId: ctx.schoolId, termId: fromTermId },
    select: { level: true, name: true, amount: true },
  });
  if (sourceItems.length === 0) {
    return { error: "No fee items to copy from the selected term." };
  }

  // Replace the target term's items with the copied set (idempotent copy).
  await prisma.$transaction(async (tx) => {
    await tx.feeItem.deleteMany({
      where: { schoolId: ctx!.schoolId, termId: toTermId },
    });
    await tx.feeItem.createMany({
      data: sourceItems.map((it) => ({
        schoolId: ctx!.schoolId,
        termId: toTermId,
        level: it.level,
        name: it.name,
        amount: it.amount,
      })),
    });
  });

  await recordAudit({
    schoolId: ctx.schoolId,
    actorId: ctx.user!.userId,
    action: "create",
    entityType: "fee_item_copy",
    afterValue: { fromTermId, toTermId, count: sourceItems.length } as never,
  });

  revalidatePath("/fees");
  return { success: `Copied ${sourceItems.length} fee item(s) from the selected term.` };
}
