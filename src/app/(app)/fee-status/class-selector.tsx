"use client";

export function ClassSelector({
  classes,
  selectedClassId,
  selectedTermId,
}: {
  classes: { id: string; name: string }[];
  selectedClassId: string;
  selectedTermId: string;
}) {
  return (
    <form method="GET">
      <input type="hidden" name="termId" value={selectedTermId} />
      <select
        name="classId"
        defaultValue={selectedClassId}
        onChange={(e) => e.target.form?.submit()}
        className="border border-outline-variant rounded px-3 py-1.5 font-label-md text-label-md text-on-surface bg-surface-container-lowest"
      >
        <option value="">All classes</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}
