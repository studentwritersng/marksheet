"use client";

export function CallLogFilter({
  taskTypes,
  currentTaskFilter,
}: {
  taskTypes: { type: string; count: number }[];
  currentTaskFilter: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <form method="GET" className="flex items-center gap-3">
        <select
          name="taskType"
          defaultValue={currentTaskFilter}
          onChange={(e) => e.target.form?.submit()}
          className="bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-white"
        >
          <option value="">All task types</option>
          {taskTypes.map((t) => (
            <option key={t.type} value={t.type}>{t.type.replace(/_/g, " ")} ({t.count})</option>
          ))}
        </select>
        {currentTaskFilter && <a href="/console/ai/call-log" className="text-xs text-white/40 hover:text-white/70">Clear</a>}
      </form>
    </div>
  );
}
