import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { consoleLogoutAction } from "@/lib/auth/actions";
import { ConsoleSidebar } from "./sidebar";

export default async function ConsoleGuardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect("/console/login");
  if (user.role !== "platform_owner") redirect("/dashboard");

  return (
    <div className="flex h-screen bg-[#0a0e1a]">
      <ConsoleSidebar userEmail={user.email} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b border-white/5 flex items-center justify-between px-6 bg-[#0a0e1a]">
          <span className="font-label-sm text-label-sm text-white/30">
            Platform Console
          </span>
          <form action={consoleLogoutAction}>
            <button
              type="submit"
              className="font-label-sm text-label-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Sign out
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
