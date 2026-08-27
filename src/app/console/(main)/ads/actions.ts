"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

const ROLES = [
  "super_admin",
  "platform_owner",
  "proprietor",
  "staff",
  "student",
  "parent",
  "referral",
] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  blobUrl: z.string().url(),
  targetRoles: z.array(z.enum(ROLES)).min(1, "Select at least one role"),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
});

function ownerOnly() {
  return getCurrentUser().then((u) =>
    u && u.role === "platform_owner" ? u : null,
  );
}

export async function createPlatformAd(input: unknown) {
  const user = await ownerOnly();
  if (!user) return { error: "Unauthorized" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const created = await prisma.platformAd.create({
    data: {
      title: parsed.data.title,
      blobUrl: parsed.data.blobUrl,
      targetRoles: parsed.data.targetRoles,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      active: parsed.data.active,
      createdById: user.userId,
    },
  });
  return { id: created.id };
}

export async function deletePlatformAd(id: string) {
  const user = await ownerOnly();
  if (!user) return { error: "Unauthorized" };
  await prisma.platformAd.deleteMany({ where: { id } });
  return {};
}

export async function updatePlatformAd(id: string, patch: unknown) {
  const user = await ownerOnly();
  if (!user) return { error: "Unauthorized" };
  const parsed = updateSchema.safeParse(patch);
  if (!parsed.success) return { error: "Invalid input" };
  const data: Record<string, unknown> = {};
  if (parsed.data.expiresAt !== undefined) {
    data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  await prisma.platformAd.updateMany({ where: { id }, data });
  return {};
}
