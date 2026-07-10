import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function ConsoleAuditLogPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 100,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      actorId: true,
      schoolId: true,
      timestamp: true,
      school: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <p className="text-sm text-white/40 mt-1">
          Last {logs.length} platform-wide events
        </p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
                <th className="text-left px-4 py-3 font-medium">Entity</th>
                <th className="text-left px-4 py-3 font-medium">Entity ID</th>
                <th className="text-left px-4 py-3 font-medium">Actor</th>
                <th className="text-left px-4 py-3 font-medium">School</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3 text-white/50 text-xs whitespace-nowrap">
                    {l.timestamp.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-white font-mono text-xs bg-white/5 rounded px-1.5 py-0.5">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70 text-xs">{l.entityType}</td>
                  <td className="px-4 py-3 text-white/30 text-xs font-mono max-w-[100px] truncate">{l.entityId ?? "—"}</td>
                  <td className="px-4 py-3 text-white/50 text-xs font-mono">{l.actorId ? `${l.actorId.slice(0, 8)}…` : "—"}</td>
                  <td className="px-4 py-3 text-white/50 text-xs">{l.school?.name ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-white/30 text-sm py-12">No audit log entries.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
