import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { consoleLogoutAction } from "@/lib/auth/actions";
import { ConsoleThemeWrapper } from "./theme-wrapper";

export default async function ConsoleGuardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/console/login");
  if (user.role === "proprietor") redirect("/proprietor");
  if (user.role !== "platform_owner") redirect("/dashboard");

  return (
    <ConsoleThemeWrapper userEmail={user.email} logoutAction={consoleLogoutAction}>
      {children}
    </ConsoleThemeWrapper>
  );
}
