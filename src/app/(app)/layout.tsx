import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { buildNav } from "@/lib/nav";
import { logoutAction } from "@/lib/auth/actions";
import { NotificationBell } from "./notification-bell";
import { prisma } from "@/lib/prisma";
import { MobileSidebar } from "./mobile-sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Maintenance mode check — super admins bypass
  if (user.schoolId && user.role !== "super_admin") {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { maintenanceMode: true },
    });
    if (school?.maintenanceMode) redirect("/maintenance");
  }

  const perms = await resolvePermissions(user);
  const nav = buildNav(user, perms);

  // Fetch school info for sidebar branding
  let schoolInfo: { name: string; logo: string | null; motto: string | null } | null = null;
  if (user.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, logo: true, motto: true },
    });
    schoolInfo = school;
  }

  const roleLabel =
    user.role === "super_admin"
      ? "Super Admin"
      : user.role === "parent"
        ? "Parent"
        : perms.isSchoolAdmin
          ? "School Admin"
          : user.role === "staff"
            ? "Staff"
            : user.role === "student"
              ? "Student"
              : user.role;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-surface text-on-surface font-body-md antialiased">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col h-full p-stack-md gap-stack-sm bg-[#002046] w-64 shrink-0 z-20">
        {/* Branding */}
        <div className="flex items-center gap-3 px-3 py-4 mb-4">
          <div className="w-10 h-10 rounded bg-white/20 flex items-center justify-center text-white shrink-0 overflow-hidden">
            {schoolInfo?.logo ? (
              <img src={schoolInfo.logo} alt="" className="w-full h-full object-contain" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-headline-sm text-headline-sm font-bold text-white truncate">{schoolInfo?.name ?? "Marksheet"}</span>
            <span className="font-label-sm text-label-sm text-blue-200 uppercase tracking-wider truncate">{schoolInfo?.motto ?? "Academic Portal"}</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 flex flex-col gap-1 overflow-y-auto">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 text-blue-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors font-label-md text-label-md"
            >
              <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              <span className="font-label-md text-label-md">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* CTA */}
        <div className="pt-4 mt-auto border-t border-white/20">
          <button className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-white/10 text-white rounded font-label-md text-label-md hover:bg-white/20 transition-colors">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Record
          </button>
        </div>
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top nav */}
        <header className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop h-16 bg-surface-container-lowest border-b border-outline-variant shrink-0 z-10 sticky top-0">
          {/* Mobile sidebar toggle */}
          <MobileSidebar nav={nav} schoolInfo={schoolInfo} />
          {/* Desktop title area */}
          <div className="hidden md:block" />

          {/* Actions */}
          <div className="flex items-center gap-4">
            <div className="flex items-center text-primary gap-2">
            <NotificationBell />
              <button aria-label="help" className="p-2 rounded-full hover:bg-surface-container-low transition-colors flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">help</span>
              </button>
            </div>
            <div className="h-6 w-px bg-outline-variant mx-1" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-label-md text-label-md text-on-surface-variant">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="font-label-sm text-label-sm text-on-surface leading-tight">{user.email}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</p>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="ml-2 p-1.5 rounded hover:bg-surface-container-low transition-colors text-on-surface-variant"
                  title="Sign out"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* Main canvas */}
        <main className="flex-1 overflow-y-auto p-margin-mobile md:p-margin-desktop">
          <div className="max-w-container-max mx-auto flex flex-col gap-stack-lg">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
