import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";
import Image from "next/image";

// ─── helpers ────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function gradeColor(grade: string | null): string {
  if (!grade) return "";
  const g = grade.toUpperCase();
  if (g === "A1" || g === "A") return "text-green-700 font-bold";
  if (g === "B2" || g === "B3" || g === "B") return "text-blue-700 font-semibold";
  if (g === "C4" || g === "C5" || g === "C6" || g === "C") return "text-yellow-700";
  if (g === "D7" || g === "D") return "text-orange-600";
  return "text-red-600";
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function ReportCardPage(props: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<{ termId: string }>;
}) {
  const { studentId } = await props.params;
  const { termId } = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [student, term, school] = await Promise.all([
    prisma.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId ?? undefined },
      include: { currentClass: { select: { name: true, level: true, section: true } } },
    }),
    prisma.term.findUnique({
      where: { id: termId },
      include: { session: true },
    }),
    user.schoolId ? prisma.school.findUnique({ where: { id: user.schoolId } }) : null,
  ]);
  if (!student || !term) notFound();

  const subjectResults = await prisma.subjectResult.findMany({
    where: { studentId, termId },
    include: { subject: { select: { name: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  const termResult = await prisma.termResult.findUnique({
    where: { studentId_termId: { studentId, termId } },
  });

  // Gather attendance data
  const attendance = termResult?.attendanceSummary as Record<string, number> | null;
  const daysOpened = attendance?.daysOpened ?? attendance?.opened ?? null;
  const daysPresent = attendance?.daysPresent ?? attendance?.present ?? null;

  // Affective ratings
  const affective = termResult?.affectiveRatings as Record<string, unknown> | null;

  // Grading scale helper
  const gradingScale = school?.gradingScale as Array<{ min: number; max: number; grade: string; remark?: string }> | null;
  function getGradeRemark(grade: string | null): string {
    if (!grade || !gradingScale) return "";
    const band = gradingScale.find((b) => b.grade === grade);
    return band?.remark ?? "";
  }

  const totalStudentsInClass = await prisma.student.count({
    where: { currentClassId: student.currentClassId ?? undefined, status: "active" },
  });

  return (
    <div className="mx-auto max-w-[800px] p-6 print:p-0 print:max-w-none">
      {/* Actions — hidden on print */}
      <div className="mb-6 flex items-center gap-3 no-print print:hidden">
        <PrintButton />
        <a
          href="/results"
          className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface"
        >
          ← Back to results
        </a>
      </div>

      {/* ═══════════════════════════ REPORT CARD ═══════════════════════════ */}
      <div
        id="report-card"
        className="bg-white border-2 border-gray-800 rounded-sm print:border-0 print:rounded-none font-sans text-gray-900"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >

        {/* ── SCHOOL HEADER ── */}
        <div className="border-b-2 border-gray-800 px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              {school?.logo ? (
                <Image
                  src={school.logo}
                  alt="School logo"
                  width={80}
                  height={80}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-gray-400 flex items-center justify-center bg-gray-100">
                  <span className="text-xs text-gray-400 text-center leading-tight px-1">{school?.shortcode ?? "LOGO"}</span>
                </div>
              )}
            </div>

            {/* School name / address */}
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-extrabold uppercase tracking-wide text-gray-900">
                {school?.name ?? "School Name"}
              </h1>
              {school?.address && (
                <p className="text-xs text-gray-600 mt-0.5">{school.address}</p>
              )}
              {(school?.phone || school?.email) && (
                <p className="text-xs text-gray-600">
                  {[school.phone, school.email].filter(Boolean).join(" | ")}
                </p>
              )}
              {school?.motto && (
                <p className="text-xs italic text-gray-500 mt-1">Motto: &ldquo;{school.motto}&rdquo;</p>
              )}
              <div className="mt-2 inline-block border border-gray-800 px-4 py-0.5 rounded">
                <p className="text-sm font-bold uppercase tracking-widest text-gray-800">
                  Student Report Card
                </p>
              </div>
            </div>

            {/* Stamp placeholder */}
            <div className="flex-shrink-0">
              {school?.stamp ? (
                <Image
                  src={school.stamp}
                  alt="School stamp"
                  width={80}
                  height={80}
                  className="object-contain opacity-80"
                  unoptimized
                />
              ) : (
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-[9px] text-gray-300 text-center">STAMP</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SESSION / TERM BANNER ── */}
        <div className="bg-gray-100 border-b border-gray-300 px-6 py-1.5 flex justify-between items-center text-xs font-semibold uppercase tracking-wide text-gray-700">
          <span>Academic Session: {term.session.label}</span>
          <span>{term.name} Term</span>
          <span>Class: {student.currentClass?.name ?? "—"}</span>
        </div>

        {/* ── STUDENT INFO + PASSPORT ── */}
        <div className="px-6 py-4 flex gap-6 border-b border-gray-300">
          {/* Student photo */}
          <div className="flex-shrink-0">
            {student.passportPhoto ? (
              <Image
                src={student.passportPhoto}
                alt="Student passport"
                width={90}
                height={110}
                className="object-cover border border-gray-400"
                unoptimized
              />
            ) : (
              <div className="w-[90px] h-[110px] border border-gray-400 bg-gray-50 flex items-center justify-center">
                <span className="text-[10px] text-gray-400 text-center">Passport Photo</span>
              </div>
            )}
          </div>

          {/* Student details grid */}
          <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <InfoRow label="Full Name" value={`${student.firstName} ${student.middleName ? student.middleName + " " : ""}${student.lastName}`} />
            <InfoRow label="Admission No." value={student.admissionNumber} />
            <InfoRow label="Class" value={student.currentClass?.name ?? "—"} />
            <InfoRow label="Gender" value={student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : "—"} />
            <InfoRow label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-GB") : "—"} />
            <InfoRow label="No. in Class" value={totalStudentsInClass.toString()} />
            {termResult?.overallPosition && (
              <InfoRow label="Position" value={`${ordinal(termResult.overallPosition)} of ${totalStudentsInClass}`} bold />
            )}
            {termResult?.overallAverage != null && (
              <InfoRow label="Overall Average" value={`${termResult.overallAverage.toFixed(1)}%`} bold />
            )}
          </div>
        </div>

        {/* ── SUBJECT RESULTS TABLE ── */}
        <div className="px-6 py-3">
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-[#002046] text-white">
                <th className="border border-gray-400 px-2 py-1.5 text-left w-[30%]">Subject</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">1st C.A</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">2nd C.A</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">Exam</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Total</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">Grade</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">Position</th>
                <th className="border border-gray-400 px-2 py-1.5 text-center">Remark</th>
              </tr>
            </thead>
            <tbody>
              {subjectResults.map((sr, idx) => {
                const scores = sr.assessmentScores as Record<string, { raw?: number; weighted?: number }> | null;
                const ca1 = scores?.["CA1"]?.raw ?? scores?.["1st CA"]?.raw ?? null;
                const ca2 = scores?.["CA2"]?.raw ?? scores?.["2nd CA"]?.raw ?? null;
                const exam = scores?.["EXAM"]?.raw ?? scores?.["Exam"]?.raw ?? null;
                return (
                  <tr key={sr.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="border border-gray-300 px-2 py-1 font-medium">{sr.subject.name}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{ca1 != null ? ca1.toFixed(0) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{ca2 != null ? ca2.toFixed(0) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{exam != null ? exam.toFixed(0) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-bold">{sr.totalScore != null ? sr.totalScore.toFixed(1) : "—"}</td>
                    <td className={`border border-gray-300 px-2 py-1 text-center ${gradeColor(sr.grade)}`}>{sr.grade ?? "—"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center">{sr.subjectPosition != null ? ordinal(sr.subjectPosition) : "—"}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">{getGradeRemark(sr.grade)}</td>
                  </tr>
                );
              })}
              {subjectResults.length === 0 && (
                <tr>
                  <td colSpan={8} className="border border-gray-300 px-2 py-3 text-center text-gray-400">No subject results recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td colSpan={4} className="border border-gray-400 px-2 py-1.5 text-right">Overall Average:</td>
                <td className="border border-gray-400 px-2 py-1.5 text-center">{termResult?.overallAverage?.toFixed(1) ?? "—"}%</td>
                <td colSpan={3} className="border border-gray-400 px-2 py-1.5 text-center text-gray-600">
                  {termResult?.overallPosition ? `Position: ${ordinal(termResult.overallPosition)} of ${totalStudentsInClass}` : ""}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── GRADING KEY ── */}
        {gradingScale && gradingScale.length > 0 && (
          <div className="px-6 pb-2">
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-gray-600 border border-gray-200 rounded px-2 py-1 bg-gray-50">
              <span className="font-semibold text-gray-700 mr-1">Grading Key:</span>
              {gradingScale.map((band) => (
                <span key={band.grade}>
                  <span className="font-bold">{band.grade}</span>: {band.min}–{band.max}{band.remark ? ` (${band.remark})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── AFFECTIVE / PSYCHOMOTOR + ATTENDANCE (side by side) ── */}
        <div className="px-6 py-3 grid grid-cols-2 gap-4 border-t border-gray-300">

          {/* Affective Domain */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 border-b border-gray-300 pb-1 mb-1">
              Affective Domain
            </h3>
            {affective && Object.keys(affective).length > 0 ? (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600">
                    <th className="text-left border border-gray-300 px-1.5 py-1">Trait</th>
                    <th className="text-center border border-gray-300 px-1.5 py-1 w-12">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(affective).map(([trait, rating], i) => (
                    <tr key={trait} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-200 px-1.5 py-0.5 capitalize">{trait.replace(/_/g, " ")}</td>
                      <td className="border border-gray-200 px-1.5 py-0.5 text-center font-semibold">{String(rating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-gray-400 italic">Not recorded.</p>
            )}
          </div>

          {/* Attendance */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 border-b border-gray-300 pb-1 mb-1">
              Attendance
            </h3>
            <table className="w-full text-xs border-collapse">
              <tbody>
                <AttendanceRow label="Times School Opened" value={daysOpened != null ? String(daysOpened) : "—"} />
                <AttendanceRow label="Times Present" value={daysPresent != null ? String(daysPresent) : "—"} />
                <AttendanceRow
                  label="Times Absent"
                  value={daysOpened != null && daysPresent != null ? String(daysOpened - daysPresent) : "—"}
                />
                {attendance?.late != null && (
                  <AttendanceRow label="Times Late" value={String(attendance.late)} />
                )}
              </tbody>
            </table>
            {termResult?.cumulativeAverage != null && (
              <div className="mt-2 border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs">
                <span className="font-semibold text-gray-700">Cumulative Average:</span>{" "}
                <span className="font-bold text-gray-900">{termResult.cumulativeAverage.toFixed(1)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* ── COMMENTS ── */}
        <div className="px-6 py-3 border-t border-gray-300 grid grid-cols-2 gap-4">
          <CommentBox
            label="Class Teacher's Comment"
            comment={termResult?.teacherComment ?? null}
          />
          <CommentBox
            label="Principal's Comment"
            comment={termResult?.principalComment ?? null}
          />
        </div>

        {/* ── SIGNATURES ── */}
        <div className="px-6 pb-5 pt-2 border-t border-gray-300 grid grid-cols-3 gap-4 text-xs text-gray-700">
          <SignatureBox label="Class Teacher's Signature" />
          <SignatureBox label="Principal's Signature" imageUrl={school?.signature ?? null} />
          <div className="flex flex-col items-center gap-1">
            <div className="h-14 w-20 flex items-center justify-center">
              {school?.stamp ? (
                <Image src={school.stamp} alt="Stamp" width={60} height={60} className="object-contain opacity-70" unoptimized />
              ) : (
                <div className="w-14 h-14 rounded-full border border-dashed border-gray-300 flex items-center justify-center">
                  <span className="text-[9px] text-gray-300">STAMP</span>
                </div>
              )}
            </div>
            <span className="text-center text-gray-500">School Stamp</span>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="bg-gray-100 border-t-2 border-gray-800 px-6 py-2 text-center text-[10px] text-gray-500">
          {termResult?.status === "finalised"
            ? "This report has been finalised. Verify authenticity via the school's verification portal."
            : "This report is a draft and has not been finalised."}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-card, #report-card * { visibility: visible; }
          #report-card { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

// ─── Small helper components ─────────────────────────────────────────────────

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-1">
      <span className="text-gray-500 whitespace-nowrap">{label}:</span>
      <span className={`text-gray-900 ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function AttendanceRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="border border-gray-200 px-1.5 py-0.5 bg-gray-50">{label}</td>
      <td className="border border-gray-200 px-1.5 py-0.5 text-center font-semibold text-gray-900">{value}</td>
    </tr>
  );
}

function CommentBox({ label, comment }: { label: string; comment: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-1">{label}:</p>
      <div className="border border-gray-300 rounded px-2 py-2 min-h-[52px] bg-gray-50 text-xs text-gray-800 italic">
        {comment || <span className="text-gray-400 not-italic">No comment recorded.</span>}
      </div>
      <div className="mt-2 border-b border-gray-400 w-full" />
      <p className="text-[10px] text-gray-400 text-center mt-0.5">Signature</p>
    </div>
  );
}

function SignatureBox({ label, imageUrl }: { label: string; imageUrl?: string | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-14 w-full flex items-end justify-center">
        {imageUrl ? (
          <Image src={imageUrl} alt={label} width={80} height={40} className="object-contain" unoptimized />
        ) : (
          <div className="w-full border-b border-gray-400" />
        )}
      </div>
      <span className="text-center text-gray-500 text-[10px]">{label}</span>
    </div>
  );
}
