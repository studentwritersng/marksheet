const STYLES = {
  cleared: { label: "Cleared", cls: "bg-green-100 text-green-800 border border-green-200" },
  partial: { label: "Partial", cls: "bg-amber-100 text-amber-800 border border-amber-200" },
  not_paid: { label: "Not Paid", cls: "bg-red-100 text-red-800 border border-red-200" },
  no_structure: { label: "No Structure", cls: "bg-slate-100 text-slate-600 border border-slate-200" },
} as const;

type BadgeStatus = keyof typeof STYLES;

export function FeeStatusBadge({ status }: { status: string }) {
  const { label, cls } = STYLES[(status in STYLES ? status : "not_paid") as BadgeStatus];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-label-sm text-label-sm font-semibold ${cls}`}>
      {label}
    </span>
  );
}
