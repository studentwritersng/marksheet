"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface AddonActionResult { error?: string; success?: string; code?: string; }

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

export async function createAddonAction(_prev: AddonActionResult, formData: FormData): Promise<AddonActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const featuresRaw = formData.get("features") as string;
  const priceRaw = formData.get("price") as string;
  const durationDaysRaw = formData.get("durationDays") as string;
  if (!name) return { error: "Name is required." };
  const price = priceRaw ? parseFloat(priceRaw) : null;
  if (price !== null && isNaN(price)) return { error: "Invalid price." };
  const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : null;
  if (durationDays !== null && (isNaN(durationDays) || durationDays < 1)) return { error: "Invalid duration." };
  let features: string[] | null = null;
  if (featuresRaw) {
    features = featuresRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  try {
    await prisma.addon.create({ data: { name, description, features: features ?? undefined, price, durationDays } });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "An addon with this name already exists." };
    return { error: "Failed to create addon." };
  }
  revalidatePath("/console/addons");
  return { success: `Addon "${name}" created.` };
}

export async function updateAddonAction(_prev: AddonActionResult, formData: FormData): Promise<AddonActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const id = formData.get("addonId") as string;
  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const featuresRaw = formData.get("features") as string;
  const priceRaw = formData.get("price") as string;
  const durationDaysRaw = formData.get("durationDays") as string;
  if (!id || !name) return { error: "Name is required." };
  const price = priceRaw ? parseFloat(priceRaw) : null;
  if (price !== null && isNaN(price)) return { error: "Invalid price." };
  const durationDays = durationDaysRaw ? parseInt(durationDaysRaw, 10) : null;
  if (durationDays !== null && (isNaN(durationDays) || durationDays < 1)) return { error: "Invalid duration." };
  let features: string[] | null = null;
  if (featuresRaw) {
    features = featuresRaw.split("\n").map((l) => l.trim()).filter(Boolean);
  }
  try {
    await prisma.addon.update({ where: { id }, data: { name, description, features: features ?? undefined, price, durationDays } });
  } catch {
    return { error: "Failed to update addon." };
  }
  revalidatePath("/console/addons");
  return { success: `Addon "${name}" updated.` };
}

export async function toggleAddonActiveAction(addonId: string, isActive: boolean): Promise<AddonActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.addon.update({ where: { id: addonId }, data: { isActive } });
  revalidatePath("/console/addons");
  return { success: `Addon ${isActive ? "activated" : "deactivated"}.` };
}

export async function deleteAddonAction(addonId: string): Promise<AddonActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const count = await prisma.schoolAddon.count({ where: { addonId } });
  if (count > 0) return { error: "Cannot delete an addon that has activations. Deactivate it instead." };
  await prisma.addonCode.deleteMany({ where: { addonId } });
  await prisma.addon.delete({ where: { id: addonId } });
  revalidatePath("/console/addons");
  return { success: "Addon deleted." };
}

export async function generateAddonCodeAction(_prev: AddonActionResult, formData: FormData): Promise<AddonActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const addonId = formData.get("addonId") as string;
  const schoolId = (formData.get("schoolId") as string)?.trim() || undefined;
  if (!addonId) return { error: "Addon is required." };
  const addon = await prisma.addon.findUnique({ where: { id: addonId } });
  if (!addon) return { error: "Addon not found." };
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "ADDON-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  try { await prisma.addonCode.create({ data: { code, addonId, schoolId: schoolId || null } }); }
  catch { return { error: "Failed to generate code." }; }
  revalidatePath("/console/addons");
  return { success: `Code generated successfully.`, code };
}
