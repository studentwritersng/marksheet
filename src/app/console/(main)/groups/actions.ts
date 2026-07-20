"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import bcrypt from "bcryptjs";

export interface GroupsActionResult { error?: string; success?: string; }

// ── Guard ────────────────────────────────────────────────────────────────────

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") throw new Error("Not authorised.");
  return user;
}

// ── Create group ─────────────────────────────────────────────────────────────

export async function createGroupAction(_prev: GroupsActionResult, formData: FormData): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const name = (formData.get("name") as string)?.trim();
  const feeGroupStageRaw = formData.get("feeGroupStage") as string;
  if (!name) return { error: "Group name is required." };
  const feeGroupStage = (feeGroupStageRaw === "basic" || feeGroupStageRaw === "standard" || feeGroupStageRaw === "premium") ? feeGroupStageRaw : null;
  try {
    await prisma.schoolGroup.create({
      data: {
        name,
        feeGroupStage,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "A group with this name already exists." };
    return { error: "Failed to create group." };
  }
  revalidatePath("/console/groups");
  return { success: `Group "${name}" created.` };
}

// ── Update group (name + fee-group stage) ────────────────────────────────────

export async function updateGroupAction(_prev: GroupsActionResult, formData: FormData): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const groupId = formData.get("groupId") as string;
  const name = (formData.get("name") as string)?.trim();
  const feeGroupStageRaw = formData.get("feeGroupStage") as string;
  if (!groupId || !name) return { error: "Name is required." };
  const feeGroupStage = (feeGroupStageRaw === "basic" || feeGroupStageRaw === "standard" || feeGroupStageRaw === "premium") ? feeGroupStageRaw : null;
  try {
    await prisma.schoolGroup.update({
      where: { id: groupId },
      data: { name, feeGroupStage },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "A group with this name already exists." };
    return { error: "Failed to update group." };
  }
  revalidatePath("/console/groups");
  return { success: `Group "${name}" updated.` };
}

// ── Delete group ─────────────────────────────────────────────────────────────

export async function deleteGroupAction(groupId: string): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const memberCount = await prisma.groupMembership.count({ where: { groupId } });
  if (memberCount > 0) {
    return { error: `Remove all ${memberCount} member school(s) first.` };
  }
  const transferCount = await prisma.groupStudentTransferRecord.count({ where: { groupId } });
  if (transferCount > 0) {
    return { error: `Cannot delete a group with historical transfer records (${transferCount} found).` };
  }
  await prisma.groupAddonSubscription.deleteMany({ where: { groupId } });
  await prisma.schoolGroup.delete({ where: { id: groupId } });
  revalidatePath("/console/groups");
  return { success: "Group deleted." };
}

// ── Add school to group ──────────────────────────────────────────────────────

export async function addSchoolToGroupAction(_prev: GroupsActionResult, formData: FormData): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const groupId = formData.get("groupId") as string;
  const schoolId = formData.get("schoolId") as string;
  if (!groupId || !schoolId) return { error: "Group and school are required." };
  // Check if school is already in another group
  const existing = await prisma.groupMembership.findUnique({ where: { schoolId } });
  if (existing) return { error: "This school already belongs to another group. Remove it first." };
  try {
    await prisma.groupMembership.create({
      data: { groupId, schoolId },
    });
  } catch {
    return { error: "Failed to add school to group." };
  }
  revalidatePath("/console/groups");
  return { success: "School added to group." };
}

// ── Remove school from group ─────────────────────────────────────────────────

export async function removeSchoolFromGroupAction(membershipId: string): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.groupMembership.delete({ where: { id: membershipId } });
  revalidatePath("/console/groups");
  return { success: "School removed from group." };
}

// ── Create proprietor user ───────────────────────────────────────────────────

export async function createProprietorUserAction(_prev: GroupsActionResult, formData: FormData): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const groupId = formData.get("groupId") as string;
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const fullName = (formData.get("fullName") as string)?.trim();
  const password = formData.get("password") as string;
  const permissionLevel = formData.get("permissionLevel") as string;
  if (!groupId || !email || !fullName || !password) return { error: "Email, name, and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (permissionLevel !== "full" && permissionLevel !== "view_only") return { error: "Invalid permission level." };
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: "proprietor",
        isActive: true,
        mustChangePassword: true,
        proprietorGroupId: groupId,
        proprietorPermissionLevel: permissionLevel,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") return { error: "A user with this email already exists." };
    return { error: "Failed to create proprietor account." };
  }
  revalidatePath("/console/groups");
  return { success: `Proprietor account created for ${email}. They can log in with their email + password.` };
}

// ── Toggle proprietor active ─────────────────────────────────────────────────

export async function toggleProprietorActiveAction(userId: string, isActive: boolean): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  await prisma.user.update({ where: { id: userId }, data: { isActive } });
  revalidatePath("/console/groups");
  return { success: isActive ? "Proprietor account activated." : "Proprietor account deactivated." };
}

// ── Activate addon at group level ────────────────────────────────────────────

export async function toggleGroupAddonAction(_prev: GroupsActionResult, formData: FormData): Promise<GroupsActionResult> {
  try { await guard(); } catch { return { error: "Not authorised." }; }
  const groupId = formData.get("groupId") as string;
  const addonId = formData.get("addonId") as string;
  const activate = formData.get("activate") === "1";
  if (!groupId || !addonId) return { error: "Group and addon are required." };

  const existing = await prisma.groupAddonSubscription.findUnique({
    where: { groupId_addonId: { groupId, addonId } },
  });

  if (activate) {
    if (existing) {
      if (existing.status !== "active") {
        await prisma.groupAddonSubscription.update({
          where: { id: existing.id },
          data: { status: "active", startDate: new Date() },
        });
      }
    } else {
      await prisma.groupAddonSubscription.create({
        data: {
          groupId,
          addonId,
          status: "active",
        },
      });
    }
  } else {
    if (existing) {
      await prisma.groupAddonSubscription.update({
        where: { id: existing.id },
        data: { status: "suspended" },
      });
    }
  }
  revalidatePath("/console/groups");
  return { success: activate ? "Group addon activated." : "Group addon suspended." };
}
