import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function ConsoleDashboardPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [schools, totalLicenses, activeLicenses, graceLicenses, expiredLicenses, expiringSoon, plans] =
    await Promise.all([
      prisma.school.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          shortcode: true,
          maintenanceMode: true,
          _count: { select: { students: true, staff: true } },
          licenses: {
            where: { status: { in: ["active", "grace_period"] } },
            orderBy: { endDate: "desc" },
            take: 1,
            select: {
              id: true,
              status: true,
              endDate: true,
              plan: { select: { name: true } },
            },
          },
        },
      }),
      prisma.schoolLicense.count(),
      prisma.schoolLicense.count({ where: { status: "active" } }),
      prisma.schoolLicense.count({ where: { status: "grace_period" } }),
      prisma.schoolLicense.count({ where: { status: "expired" } }),
      prisma.schoolLicense.count({
        where: { status: "active", endDate: { lte: thirtyDaysFromNow, gte: now } },
      }),
      prisma.licensePlan.findMany({ orderBy: { name: "asc" } }),
    ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white">{greeting()}</h1>
        <p className="text-sm text-white/40 mt-1">
          {schools.length} school{schools.length !== 1 ? "s" : ""} on the platform
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Schools" value={schools.length} icon="domain" />
        <StatCard label="Active Licenses" value={activeLicenses} icon="check_circle" accent="text-emerald-400" />
        <StatCard label="Grace Period" value={graceLicenses} icon="warning" accent="text-amber-400" />
        <StatCard label="Expired" value={expiredLicenses} icon="error" accent="text-red-400" />
        <StatCard label="Expiring ≤30 days" value={expiringSoon} icon="schedule" accent="text-orange-400" />
      </div>

      {/* License plans summary */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-3">License Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <div key={p.id} className="bg-white/5 rounded-lg px-4 py-3 border border-white/5">
              <p className="text-white font-medium text-sm">{p.name}</p>
              <p className="text-white/40 text-xs mt-0.5 capitalize">{p.durationType}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Schools table */}
      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wider">All Schools</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">School</th>
                <th className="text-left px-4 py-3 font-medium">Shortcode</th>
                <th className="text-left px-4 py-3 font-medium">Students</th>
                <th className="text-left px-4 py-3 font-medium">Staff</th>
                <th className="text-left px-4 py-3 font-medium">License</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Expires</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {schools.map((s) => {
                const license = s.licenses[0];
                const daysLeft = license
                  ? Math.ceil((license.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  : null;
                return (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3.5">
                      <div>
                        <p className="text-white font-medium">{s.name}</p>
                        {s.address && <p className="text-white/30 text-xs mt-0.5">{s.address}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-white/50 font-mono">{s.shortcode ?? "—"}</td>
                    <td className="px-4 py-3.5 text-white/70">{s._count.students}</td>
                    <td className="px-4 py-3.5 text-white/70">{s._count.staff}</td>
                    <td className="px-4 py-3.5">
                      {license ? (
                        <span className={`inline-flex items-center gap-1 ${
                          daysLeft !== null && daysLeft <= 7 ? "text-red-400" :
                          daysLeft !== null && daysLeft <= 30 ? "text-amber-400" : "text-white/70"
                        }`}>
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          {daysLeft !== null ? `${daysLeft}d` : "—"}
                        </span>
                      ) : (
                        <span className="text-white/30">No license</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-white/70">{license?.plan?.name ?? "—"}</td>
                    <td className="px-4 py-3.5 text-white/50 text-xs">
                      {license ? license.endDate.toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={license?.status ?? null} maintenanceMode={s.maintenanceMode} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, accent }: {
  label: string; value: number; icon: string; accent?: string;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className={`material-symbols-outlined text-[20px] ${accent ?? "text-white/40"}`}>{icon}</span>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-white/40 mt-0.5">{label}</p>
    </div>
  );
}

function StatusBadge({ status, maintenanceMode }: { status: string | null; maintenanceMode: boolean }) {
  if (maintenanceMode) {
    return <span className="inline-flex items-center gap-1 rounded-full bg-purple-900/50 text-purple-300 text-[11px] px-2.5 py-0.5 font-medium">Maintenance</span>;
  }
  switch (status) {
    case "active":
      return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/50 text-emerald-300 text-[11px] px-2.5 py-0.5 font-medium">Active</span>;
    case "grace_period":
      return <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/50 text-amber-300 text-[11px] px-2.5 py-0.5 font-medium">Grace</span>;
    case "expired":
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-900/50 text-red-300 text-[11px] px-2.5 py-0.5 font-medium">Expired</span>;
    case "suspended":
      return <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 text-gray-400 text-[11px] px-2.5 py-0.5 font-medium">Suspended</span>;
    default:
      return <span className="inline-flex items-center gap-1 rounded-full bg-gray-800 text-gray-500 text-[11px] px-2.5 py-0.5 font-medium">None</span>;
  }
}
