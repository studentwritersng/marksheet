import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ConsoleSchoolsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const now = new Date();

  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      shortcode: true,
      maintenanceMode: true,
      createdAt: true,
      _count: { select: { students: true, staff: true, sessions: true } },
      licenses: {
        orderBy: { endDate: "desc" },
        take: 1,
        select: { status: true, endDate: true, plan: { select: { name: true } } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Schools</h1>
        <p className="text-sm text-white/40 mt-1">
          {schools.length} registered school{schools.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {schools.map((s) => {
          const license = s.licenses[0];
          return (
            <div key={s.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/[0.04] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-white font-semibold text-base">{s.name}</h2>
                    {s.maintenanceMode && (
                      <span className="rounded-full bg-purple-900/50 text-purple-300 text-[10px] px-2 py-0.5 font-medium">Maintenance</span>
                    )}
                    <LicenseBadge status={license?.status ?? null} />
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-white/40">
                    {s.address && <span>{s.address}</span>}
                    {s.phone && <span>{s.phone}</span>}
                    {s.email && <span>{s.email}</span>}
                    <span>Shortcode: <span className="font-mono text-white/50">{s.shortcode ?? "—"}</span></span>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs">
                    <span className="text-white/50"><strong className="text-white/70">{s._count.students}</strong> students</span>
                    <span className="text-white/50"><strong className="text-white/70">{s._count.staff}</strong> staff</span>
                    <span className="text-white/50"><strong className="text-white/70">{s._count.sessions}</strong> sessions</span>
                    <span className="text-white/50">Registered {s.createdAt.toLocaleDateString()}</span>
                  </div>
                  {license && (
                    <div className="mt-3 text-xs text-white/40">
                      Plan: <span className="text-white/70">{license.plan.name}</span>
                      &middot; Expires: <span className="text-white/70">{license.endDate.toLocaleDateString()}</span>
                      &middot; {Math.ceil((license.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days remaining
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link
                    href={`/console/schools/${s.id}`}
                    className="text-xs text-white/50 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30"
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
        {schools.length === 0 && (
          <p className="text-white/30 text-sm py-12 text-center">No schools registered yet.</p>
        )}
      </div>
    </div>
  );
}

function LicenseBadge({ status }: { status: string | null }) {
  switch (status) {
    case "active":
      return <span className="rounded-full bg-emerald-900/50 text-emerald-300 text-[10px] px-2 py-0.5 font-medium">Active</span>;
    case "grace_period":
      return <span className="rounded-full bg-amber-900/50 text-amber-300 text-[10px] px-2 py-0.5 font-medium">Grace</span>;
    case "expired":
      return <span className="rounded-full bg-red-900/50 text-red-300 text-[10px] px-2 py-0.5 font-medium">Expired</span>;
    case "suspended":
      return <span className="rounded-full bg-gray-800 text-gray-400 text-[10px] px-2 py-0.5 font-medium">Suspended</span>;
    default:
      return null;
  }
}
