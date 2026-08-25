import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export default async function AuditLogPage(props: {
  searchParams: Promise<{ action?: string; entity?: string; from?: string; to?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const action = searchParams.action?.trim() || undefined;
  const entity = searchParams.entity?.trim() || undefined;
  const from = searchParams.from?.trim() || undefined;
  const to = searchParams.to?.trim() || undefined;

  const where: Prisma.AuditLogWhereInput = { schoolId: user.schoolId };
  if (action) where.action = action;
  if (entity) where.entityType = entity;
  if (from || to) {
    const ts: Prisma.DateTimeFilter = {};
    if (from) ts.gte = new Date(from);
    if (to) ts.lte = new Date(to + "T23:59:59.999Z");
    where.timestamp = ts;
  }

  const [logs, actionRows, entityRows] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      where: { schoolId: user.schoolId },
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { schoolId: user.schoolId },
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    }),
  ]);

  const actionValues = actionRows.map((r) => r.action);
  const entityValues = entityRows.map((r) => r.entityType);

  const selectCls =
    "border border-outline-variant rounded px-3 py-1.5 font-label-md text-label-md text-on-surface bg-surface-container-lowest";
  const labelCls = "font-label-sm text-label-sm text-on-surface-variant";

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

      <form
        method="GET"
        action="/audit-log"
        className="flex flex-wrap items-end gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg p-3"
      >
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Action</span>
          <select name="action" defaultValue={action ?? ""} className={selectCls}>
            <option value="">All</option>
            {actionValues.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>Entity</span>
          <select name="entity" defaultValue={entity ?? ""} className={selectCls}>
            <option value="">All</option>
            {entityValues.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>From</span>
          <input type="date" name="from" defaultValue={from ?? ""} className={selectCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelCls}>To</span>
          <input type="date" name="to" defaultValue={to ?? ""} className={selectCls} />
        </label>
        <button
          type="submit"
          className="bg-primary text-on-primary font-label-md text-label-md py-1.5 px-4 rounded hover:bg-primary-container"
        >
          Filter
        </button>
        <a
          href="/audit-log"
          className="font-label-md text-label-md text-on-surface-variant hover:text-on-surface py-1.5 px-2"
        >
          Reset
        </a>
      </form>

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
                <td colSpan={5} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">No audit logs match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
