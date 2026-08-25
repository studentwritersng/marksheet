"use client";

export function TermSelector({
  terms,
  selectedTermId,
  classId,
}: {
  terms: { id: string; name: string }[];
  selectedTermId: string;
  classId?: string;
}) {
  return (
    <form method="GET">
      {classId ? <input type="hidden" name="classId" value={classId} /> : null}
      <select
        name="termId"
        defaultValue={selectedTermId}
        onChange={(e) => e.target.form?.submit()}
        className="border border-outline-variant rounded px-3 py-1.5 font-label-md text-label-md text-on-surface bg-surface-container-lowest"
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} Term
          </option>
        ))}
      </select>
    </form>
  );
}
