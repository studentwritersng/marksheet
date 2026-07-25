import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { CallLogFilter } from "./filter";

const PAGE_SIZE = 50;

// Human-readable labels for task types
const TASK_LABELS: Record<string, string> = {
  lesson_note_generation: "Lesson Note Generation",
  question_generation: "Question Generation",
  essay_grading: "Essay Grading",
  comment_drafting: "Comment Drafting",
  curriculum_parsing: "Curriculum Parsing",
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

export default async function ConsoleAiCallLogPage(props: {
  searchParams: Promise<{
    taskType?: string;
    schoolId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  }>;
}) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const taskFilter = sp.taskType ?? "";
  const schoolFilter = sp.schoolId ?? "";
  const statusFilter = sp.status ?? "";
  const dateFrom = sp.dateFrom ?? "";
  const dateTo = sp.dateTo ?? "";

  // Build Prisma where clause from active filters
  const where: Record<string, unknown> = {};
  if (taskFilter) where.taskType = taskFilter;
  if (schoolFilter) where.schoolId = schoolFilter;
  if (statusFilter) where.status = statusFilter;
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo + "T23:59:59Z") } : {}),
    };
  }

  const [calls, total, taskTypeCounts, allSchools, aggregates, schoolBreakdown] = await Promise.all([
    // Paginated call list
    prisma.aiCallLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),

    // Total matching count
    prisma.aiCallLog.count({ where }),

    // Task type facet (always unfiltered for the dropdown options)
    prisma.aiCallLog.groupBy({
      by: ["taskType"],
      _count: true,
      orderBy: { _count: { taskType: "desc" } },
    }),

    // All schools that have ever made an AI call (for the school filter dropdown)
    prisma.school.findMany({
      where: {
        id: {
          in: await prisma.aiCallLog
            .findMany({ select: { schoolId: true }, distinct: ["schoolId"], where: { schoolId: { not: null } } })
            .then((rows) => rows.map((r) => r.schoolId as string)),
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),

    // Aggregate stats for the current filter (accurate totals, not page-limited)
    prisma.aiCallLog.aggregate({
      where,
      _count: { id: true },
      _sum: { promptTokens: true, completionTokens: true },
    }),

    // Per-school breakdown (with applied filters except schoolId, for the summary table)
    prisma.aiCallLog.groupBy({
      by: ["schoolId"],
      where: {
        ...where,
        schoolId: { not: null },
      },
      _count: { id: true },
      _sum: { promptTokens: true, completionTokens: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
  ]);

  // Resolve school names for the call rows and breakdown table
  const schoolIds = [
    ...new Set([
      ...calls.map((c) => c.schoolId).filter(Boolean) as string[],
      ...schoolBreakdown.map((b) => b.schoolId).filter(Boolean) as string[],
    ]),
  ];
  const schoolMap = schoolIds.length
    ? await prisma.school.findMany({
        where: { id: { in: schoolIds } },
        select: { id: true, name: true },
      }).then((rows) => Object.fromEntries(rows.map((s) => [s.id, s.name])))
    : {} as Record<string, string>;

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const successCount = (await prisma.aiCallLog.count({ where: { ...where, status: "success" } }));
  const errorCount = (await prisma.aiCallLog.count({ where: { ...where, status: { in: ["error", "timeout"] } } }));
  const totalTokens =
    (aggregates._sum.promptTokens ?? 0) + (aggregates._sum.completionTokens ?? 0);

  // Build URL helper for pagination (preserves all filters)
  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (taskFilter) params.set("taskType", taskFilter);
    if (schoolFilter) params.set("schoolId", schoolFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("page", String(p));
    return `/console/ai/call-log?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <a href="/console/ai" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          &larr; Back to AI Config
        </a>
        <h1 className="text-2xl font-semibold text-white mt-2">AI Usage</h1>
        <p className="text-sm text-white/40 mt-1">
          Every AI call across all schools — feature used, credits consumed, and status.
        </p>
      </div>

      {/* Filters */}
      <CallLogFilter
        taskTypes={taskTypeCounts.map((t) => ({ type: t.taskType, count: t._count }))}
        schools={allSchools}
        currentFilters={{ taskType: taskFilter, schoolId: schoolFilter, status: statusFilter, dateFrom, dateTo }}
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={fmt(aggregates._count.id)} />
        <StatCard label="Success" value={fmt(successCount)} color="emerald" />
        <StatCard label="Errors / Timeouts" value={fmt(errorCount)} color="red" />
        <StatCard label="Total Tokens" value={fmt(totalTokens)} sub="prompt + completion" />
      </div>

      {/* Per-school breakdown (when not already filtered to one school) */}
      {!schoolFilter && schoolBreakdown.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-white/60 mb-3">Top Schools by Usage</h2>
          <div className="overflow-x-auto bg-white/5 border border-white/10 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-white/40 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium text-right">Calls</th>
                  <th className="px-4 py-3 font-medium text-right">Prompt Tokens</th>
                  <th className="px-4 py-3 font-medium text-right">Completion Tokens</th>
                  <th className="px-4 py-3 font-medium text-right">Total Tokens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {schoolBreakdown.map((row) => {
                  const sId = row.schoolId as string;
                  const totalTok = (row._sum.promptTokens ?? 0) + (row._sum.completionTokens ?? 0);
                  return (
                    <tr key={sId} className="text-white/70 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <a
                          href={`/console/ai/call-log?schoolId=${sId}`}
                          className="hover:text-white underline-offset-2 hover:underline"
                        >
                          {schoolMap[sId] ?? sId}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-right">{fmt(row._count.id)}</td>
                      <td className="px-4 py-3 text-right text-white/50">{fmt(row._sum.promptTokens)}</td>
                      <td className="px-4 py-3 text-right text-white/50">{fmt(row._sum.completionTokens)}</td>
                      <td className="px-4 py-3 text-right font-medium">{fmt(totalTok)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Call log table */}
      {calls.length > 0 ? (
        <div>
          <h2 className="text-sm font-medium text-white/60 mb-3">
            Call Log
            <span className="ml-2 text-white/30 font-normal">
              {total.toLocaleString()} result{total !== 1 ? "s" : ""}{" "}
              {total > PAGE_SIZE && `· page ${page} of ${totalPages}`}
            </span>
          </h2>
          <div className="overflow-x-auto bg-white/5 border border-white/10 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-white/40 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Time</th>
                  <th className="px-4 py-3 font-medium">School</th>
                  <th className="px-4 py-3 font-medium">Feature</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Prompt</th>
                  <th className="px-4 py-3 font-medium text-right">Completion</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium text-right">Latency</th>
                  <th className="px-4 py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {calls.map((c) => {
                  const totalTok =
                    c.promptTokens != null || c.completionTokens != null
                      ? (c.promptTokens ?? 0) + (c.completionTokens ?? 0)
                      : null;
                  return (
                    <tr key={c.id} className="text-white/70 hover:bg-white/5">
                      <td className="px-4 py-3 whitespace-nowrap text-white/50">
                        {c.createdAt.toLocaleString("en-GB", {
                          day: "2-digit", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 max-w-[160px] truncate">
                        {c.schoolId
                          ? (
                            <a
                              href={`/console/ai/call-log?schoolId=${c.schoolId}`}
                              className="hover:text-white underline-offset-2 hover:underline"
                            >
                              {schoolMap[c.schoolId] ?? c.schoolId}
                            </a>
                          )
                          : <span className="text-white/30 italic">Platform</span>
                        }
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {TASK_LABELS[c.taskType] ?? c.taskType.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 font-mono text-white/50 max-w-[140px] truncate" title={c.modelName}>
                        {c.modelName}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          c.status === "success"
                            ? "bg-emerald-900/30 text-emerald-300"
                            : c.status === "timeout"
                            ? "bg-amber-900/30 text-amber-300"
                            : "bg-red-900/30 text-red-300"
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-white/50">{fmt(c.promptTokens)}</td>
                      <td className="px-4 py-3 text-right text-white/50">{fmt(c.completionTokens)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {totalTok != null ? fmt(totalTok) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-white/50">
                        {c.latencyMs != null ? `${c.latencyMs.toLocaleString()}ms` : "—"}
                      </td>
                      <td className="px-4 py-3 text-red-400 max-w-[200px] truncate" title={c.errorDetail ?? ""}>
                        {c.errorDetail ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-white/30 py-12 text-center">
          No AI calls match the current filters.
        </p>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {page > 1 && (
            <a href={pageUrl(page - 1)}
              className="px-3 py-1 rounded text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              ← Prev
            </a>
          )}
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            // Show pages around the current page
            const half = 4;
            let start = Math.max(1, page - half);
            const end = Math.min(totalPages, start + 9);
            start = Math.max(1, end - 9);
            return start + i;
          }).filter((p) => p >= 1 && p <= totalPages).map((p) => (
            <a key={p} href={pageUrl(p)}
              className={`px-3 py-1 rounded text-xs transition-colors ${
                p === page ? "bg-white/15 text-white font-medium" : "text-white/50 hover:text-white hover:bg-white/5"
              }`}>
              {p}
            </a>
          ))}
          {page < totalPages && (
            <a href={pageUrl(page + 1)}
              className="px-3 py-1 rounded text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors">
              Next →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "emerald" | "red";
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <div className={`text-2xl font-semibold ${
        color === "emerald" ? "text-emerald-400" : color === "red" ? "text-red-400" : "text-white"
      }`}>
        {value}
      </div>
      <div className="text-xs text-white/40 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-white/25 mt-0.5">{sub}</div>}
    </div>
  );
}
