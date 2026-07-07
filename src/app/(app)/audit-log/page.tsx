import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function AuditLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const logs = await prisma.auditLog.findMany({
    where: { schoolId: user.schoolId },
    orderBy: { timestamp: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
          Audit Log
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Track all changes made across the platform.
        </p>
      </div>

      <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-surface-container border-b border-outline-variant">
            <tr>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Time</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Action</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Entity</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Actor</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-surface-container-low transition-colors">
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                  {log.timestamp.toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`font-label-sm text-label-sm px-2 py-0.5 rounded ${
                    log.action === "create" ? "bg-secondary-container text-on-secondary-container" :
                    log.action === "update" ? "bg-primary-fixed text-on-primary-fixed" :
                    log.action === "delete" ? "bg-error-container text-on-error-container" :
                    "bg-surface-variant text-on-surface-variant"
                  }`}>
                    {log.action}
                  </span>
                </td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{log.entityType}</td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{log.actorId?.slice(0, 8) ?? "—"}…</td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant max-w-xs truncate">
                  {JSON.stringify(log.afterValue ?? log.beforeValue ?? {})}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">No audit logs yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
