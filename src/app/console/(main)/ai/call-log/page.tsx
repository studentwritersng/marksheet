import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";

export default async function ConsoleAiCallLogPage(props: {
  searchParams: Promise<{ taskType?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const page = parseInt(searchParams.page ?? "1", 10);
  const pageSize = 50;
  const taskFilter = searchParams.taskType ?? "";
  const where = taskFilter ? { taskType: taskFilter } : {};

  const [calls, total, taskTypes] = await Promise.all([
    prisma.aiCallLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.aiCallLog.count({ where }),
    prisma.aiCallLog.groupBy({ by: ["taskType"], _count: true, orderBy: { _count: { taskType: "desc" } } }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div>
        <a href="/console/ai" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">&larr; Back to AI Config</a>
        <h1 className="text-2xl font-semibold text-white mt-2">AI Call Log</h1>
        <p className="text-sm text-white/40 mt-1">Usage and error logs for all AI calls routed through the AI Gateway.</p>
      </div>

      {/* Filter + stats */}
      <div className="flex items-center gap-4">
        <form method="GET" className="flex items-center gap-3">
          <select name="taskType" defaultValue={taskFilter} onChange={(e) => e.target.form?.submit()}
            className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white">
            <option value="">All task types</option>
            {taskTypes.map((t) => (
              <option key={t.taskType} value={t.taskType}>{t.taskType.replace(/_/g, " ")} ({t._count})</option>
            ))}
          </select>
          {taskFilter && <a href="/console/ai/call-log" className="text-xs text-white/40 hover:text-white/70">Clear</a>}
        </form>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-lg">
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-white">{total}</div>
          <div className="text-xs text-white/40">Total Calls</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-emerald-400">{calls.filter((c) => c.status === "success").length}</div>
          <div className="text-xs text-white/40">Success</div>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
          <div className="text-2xl font-semibold text-red-400">{calls.filter((c) => c.status === "error" || c.status === "timeout").length}</div>
          <div className="text-xs text-white/40">Errors</div>
        </div>
      </div>

      {calls.length > 0 ? (
        <div className="overflow-x-auto bg-white/5 border border-white/10 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-xs text-white/40 uppercase tracking-wider">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Task</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Tokens</th>
                <th className="px-4 py-3 font-medium">Latency</th>
                <th className="px-4 py-3 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {calls.map((c) => (
                <tr key={c.id} className="text-xs text-white/70 hover:bg-white/5">
                  <td className="px-4 py-3 whitespace-nowrap">{c.createdAt.toLocaleString()}</td>
                  <td className="px-4 py-3 capitalize">{c.taskType.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3 font-mono text-white/50">{c.modelName}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      c.status === "success" ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/30 text-red-300"
                    }`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-white/50">{c.promptTokens != null ? `${c.promptTokens}→${c.completionTokens ?? "?"}` : "—"}</td>
                  <td className="px-4 py-3 text-white/50">{c.latencyMs != null ? `${c.latencyMs}ms` : "—"}</td>
                  <td className="px-4 py-3 text-red-400 max-w-xs truncate">{c.errorDetail ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-white/30 py-12 text-center">No AI calls logged yet.</p>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <a key={p} href={`/console/ai/call-log?${new URLSearchParams({ ...(taskFilter ? { taskType: taskFilter } : {}), page: String(p) }).toString()}`}
              className={`px-3 py-1 rounded text-xs ${p === page ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}>
              {p}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
