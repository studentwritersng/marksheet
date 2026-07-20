import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { proprietorLogoutAction } from "@/lib/auth/actions";
import Link from "next/link";

export default async function ProprietorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/proprietor/login");
  if (user.role !== "proprietor") redirect("/dashboard");

  const permissionLevel = user.proprietorPermissionLevel ?? "view_only";

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Header */}
      <header className="h-16 shrink-0 border-b border-outline-variant bg-[#002046] flex items-center justify-between px-4 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px] text-white">workspaces</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white tracking-wide uppercase">Proprietor Console</span>
            <span className="text-[10px] text-blue-200 font-semibold uppercase tracking-widest">
              {permissionLevel === "full" ? "Full Access" : "View Only"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs text-white/80 font-medium truncate">{user.email}</span>
            <span className="text-[10px] text-blue-200 uppercase tracking-wider">Proprietor</span>
          </div>
          <div className="h-5 w-px bg-white/20" />
          <form action={proprietorLogoutAction}>
            <button
              type="submit"
              className="text-xs font-semibold uppercase tracking-wider text-white/60 hover:text-red-300 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 hover:border-red-400/20 hover:bg-red-500/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">logout</span>
              Sign out
            </button>
          </form>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
