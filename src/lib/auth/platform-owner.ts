import { getCurrentUser } from "./current-user";

/**
 * Guard for Platform Owner Console access.
 * Only users with role = platform_owner can access console routes.
 * Throws redirect-compatible errors; use in layouts / server components.
 */
export async function requirePlatformOwner(): Promise<{ userId: string; email: string }> {
  const user = await getCurrentUser();
  if (!user) {
    // This will be caught by Next.js error boundary or redirect
    throw new Error("UNAUTHENTICATED");
  }
  if (user.role !== "platform_owner") {
    throw new Error("FORBIDDEN");
  }
  return { userId: user.userId, email: user.email };
}

/**
 * Guard for Proprietor Console access.
 * Only users with role = proprietor AND proprietorGroupId set can access proprietor routes.
 * Returns the proprietor's group id and permission level for downstream scoping.
 */
export interface ProprietorContext {
  userId: string;
  email: string;
  groupId: string;
  permissionLevel: "full" | "view_only";
}
export async function requireProprietor(): Promise<ProprietorContext> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (user.role !== "proprietor") throw new Error("FORBIDDEN");
  if (!user.proprietorGroupId) throw new Error("NO_GROUP_SCOPE");
  if (!user.proprietorPermissionLevel) throw new Error("NO_PERMISSION_LEVEL");
  return {
    userId: user.userId,
    email: user.email,
    groupId: user.proprietorGroupId,
    permissionLevel: user.proprietorPermissionLevel,
  };
}
