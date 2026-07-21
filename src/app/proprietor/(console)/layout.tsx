import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { proprietorLogoutAction } from "@/lib/auth/actions";
import { prisma } from "@/lib/prisma";
import { ProprietorConsoleShell } from "./shell";

export default async function ProprietorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/proprietor/login");
  if (user.role !== "proprietor") redirect("/dashboard");
  if (user.role === "proprietor" && user.mustChangePassword) redirect("/proprietor/change-password");

  const group = await prisma.schoolGroup.findUnique({
    where: { id: user.proprietorGroupId! },
    select: { name: true },
  });

  return (
    <ProprietorConsoleShell
      userEmail={user.email}
      groupName={group?.name ?? "School Group"}
      permissionLevel={user.proprietorPermissionLevel ?? "view_only"}
      logoutAction={proprietorLogoutAction}
    >
      {children}
    </ProprietorConsoleShell>
  );
}
