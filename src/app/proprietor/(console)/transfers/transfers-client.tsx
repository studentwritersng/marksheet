"use client";

interface TransferRecord {
  id: string;
  originSchoolName: string;
  destinationSchoolName: string;
  originStudentName: string;
  originAdmissionNumber: string;
  destinationStudentName: string;
  destinationAdmissionNumber: string;
  transferredAt: string;
  notes: string | null;
}

export function TransfersClient({ transfers }: { transfers: TransferRecord[] }) {
  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Transfer Records</h1>
        <p className="text-sm text-white/40 mt-1">
          {transfers.length} cross-branch student transfer{transfers.length !== 1 ? "s" : ""} recorded
        </p>
      </div>

      {transfers.length === 0 ? (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-white/20">swap_horiz</span>
          <p className="text-sm text-white/40 mt-3">No cross-branch student transfers recorded yet.</p>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/5 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-white/40 text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Origin School</th>
                  <th className="text-left px-4 py-3 font-semibold">Origin Student</th>
                  <th className="text-left px-4 py-3 font-semibold">→</th>
                  <th className="text-left px-4 py-3 font-semibold">Destination School</th>
                  <th className="text-left px-4 py-3 font-semibold">Destination Student</th>
                  <th className="text-left px-4 py-3 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {transfers.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-white/60 whitespace-nowrap">
                      {new Date(t.transferredAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-white">{t.originSchoolName}</td>
                    <td className="px-4 py-3 text-white/60">
                      {t.originStudentName}
                      <span className="block text-[10px] text-white/40">#{t.originAdmissionNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-white/30">→</td>
                    <td className="px-4 py-3 text-white">{t.destinationSchoolName}</td>
                    <td className="px-4 py-3 text-white/60">
                      {t.destinationStudentName}
                      <span className="block text-[10px] text-white/40">#{t.destinationAdmissionNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs">{t.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
