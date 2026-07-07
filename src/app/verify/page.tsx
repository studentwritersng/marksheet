"use client";

import { useState } from "react";

export default function VerifyPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify() {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);

    const res = await fetch(`/api/verify?code=${encodeURIComponent(code.trim())}`);
    const data = await res.json();
    setLoading(false);

    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
    }
  }

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-margin-mobile">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Result Verification</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Enter the verification code from your report card.
          </p>
        </div>

        {/* Input */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              placeholder="e.g. MS-XXXXXXXXXX"
              className="flex-1 border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={handleVerify}
              disabled={loading || !code.trim()}
              className="bg-primary text-on-primary font-label-md text-label-md py-2 px-6 rounded hover:bg-primary-container disabled:opacity-60"
            >
              {loading ? "Checking…" : "Verify"}
            </button>
          </div>

          {error && (
            <div className="flex items-center gap-3 bg-error-container rounded-lg p-4">
              <span className="material-symbols-outlined text-error text-[20px]">gpp_bad</span>
              <p className="font-body-sm text-body-sm text-on-error-container">{error}</p>
            </div>
          )}
        </div>

        {/* Result card */}
        {result && (
          <div className="mt-6 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 animate-[fadeIn_0.3s_ease-out]">
            <div className="flex items-center gap-2 mb-4 text-secondary">
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings: "'FILL' 1"}}>verified</span>
              <span className="font-label-md text-label-md text-on-secondary-container bg-secondary-container px-2 py-0.5 rounded">
                Verified
              </span>
            </div>

            <div className="border-b border-outline-variant pb-4 mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">{result.studentName}</h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {result.schoolName} · {result.session} · {result.term}
              </p>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Class: {result.className} · Admission: {result.admissionNumber}
              </p>
            </div>

            <table className="w-full text-left mb-4">
              <thead>
                <tr className="border-b border-outline-variant text-on-surface-variant">
                  <th className="py-2 font-label-sm text-label-sm uppercase tracking-wider">Subject</th>
                  <th className="py-2 font-label-sm text-label-sm uppercase tracking-wider">Score</th>
                  <th className="py-2 font-label-sm text-label-sm uppercase tracking-wider">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {result.subjects.map((s: any) => (
                  <tr key={s.name}>
                    <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.name}</td>
                    <td className="py-2 font-body-sm text-body-sm text-on-surface">{s.score ?? "—"}</td>
                    <td className="py-2">
                      <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm">{s.grade ?? "—"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-right">
              <p className="font-headline-sm text-headline-sm text-on-surface">
                Average: {result.overallAverage ?? "—"}%
              </p>
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                Position: {result.overallPosition ?? "—"}
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-outline-variant text-center">
              <p className="font-label-sm text-label-sm text-on-surface-variant">
                This result has been verified as authentic from {result.schoolName}.
              </p>
            </div>

            <style>{`
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        )}
      </div>
    </main>
  );
}
