"use client";

export function CallLogFilter({
  taskTypes,
  schools,
  currentFilters,
}: {
  taskTypes: { type: string; count: number }[];
  schools: { id: string; name: string }[];
  currentFilters: {
    taskType: string;
    schoolId: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  };
}) {
  return (
    <form method="GET" className="flex flex-wrap items-end gap-3">
      {/* Task type */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 uppercase tracking-wider">Feature</label>
        <select
          name="taskType"
          defaultValue={currentFilters.taskType}
          onChange={(e) => e.target.form?.submit()}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white min-w-[180px]"
        >
          <option value="">All features</option>
          {taskTypes.map((t) => (
            <option key={t.type} value={t.type}>
              {t.type.replace(/_/g, " ")} ({t.count})
            </option>
          ))}
        </select>
      </div>

      {/* School */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 uppercase tracking-wider">School</label>
        <select
          name="schoolId"
          defaultValue={currentFilters.schoolId}
          onChange={(e) => e.target.form?.submit()}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white min-w-[200px]"
        >
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 uppercase tracking-wider">Status</label>
        <select
          name="status"
          defaultValue={currentFilters.status}
          onChange={(e) => e.target.form?.submit()}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white min-w-[120px]"
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="timeout">Timeout</option>
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 uppercase tracking-wider">From</label>
        <input
          type="date"
          name="dateFrom"
          defaultValue={currentFilters.dateFrom}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-white/40 uppercase tracking-wider">To</label>
        <input
          type="date"
          name="dateTo"
          defaultValue={currentFilters.dateTo}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors"
      >
        Filter
      </button>

      {/* Clear link — only shown when any filter is active */}
      {(currentFilters.taskType || currentFilters.schoolId || currentFilters.status || currentFilters.dateFrom || currentFilters.dateTo) && (
        <a
          href="/console/ai/call-log"
          className="px-4 py-2 text-white/40 hover:text-white text-xs rounded-lg transition-colors"
        >
          Clear
        </a>
      )}
    </form>
  );
}
