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
