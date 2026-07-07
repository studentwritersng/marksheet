import Link from "next/link";

interface StaffVM {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  assignments: {
    id: string;
    type: string;
    subject: string | null;
    class: string | null;
    term: string | null;
  }[];
}

export function StaffRow({ staff }: { staff: StaffVM }) {
  return (
    <div className="flex items-center justify-between bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3">
      <div>
        <p className="font-label-md text-label-md text-on-surface">{staff.fullName}</p>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{staff.email}{staff.phone ? ` · ${staff.phone}` : ""}</p>
        {staff.assignments.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {staff.assignments.map((a) => (
              <span
                key={a.id}
                className="inline-block rounded bg-surface-variant px-1.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant"
              >
                {a.type.replace("_", " ")}
                {a.subject ? ` (${a.subject})` : ""}
                {a.class ? ` · ${a.class}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
      <Link
        href={`/staff/${staff.id}`}
        className="font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
      >
        Assignments
      </Link>
    </div>
  );
}
