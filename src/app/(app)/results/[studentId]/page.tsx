import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";
import Image from "next/image";
import { getReportCardConfig } from "../report-card-settings/actions";
import { DEFAULT_RC_CONFIG } from "../report-card-settings/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function gradeColorClass(grade: string | null): string {
  if (!grade) return "";
  const g = grade.toUpperCase();
  if (g === "A1") return "text-green-700 font-bold";
  if (g === "B2" || g === "B3") return "text-blue-700 font-semibold";
  if (g === "C4" || g === "C5" || g === "C6") return "text-yellow-700";
  if (g === "D7" || g === "E8") return "text-orange-600";
  return "text-red-600";
}

// Map a grade code to its human-readable remark
function gradeRemark(
  grade: string | null,
  scale: Array<{ grade: string; remark?: string }> | null,
): string {
  if (!grade) return "";
  // Try school's custom scale first
  if (scale) {
    const band = scale.find((b) => b.grade === grade);
    if (band?.remark) return band.remark;
  }
  // Fallback built-in mapping
  const MAP: Record<string, string> = {
    A1: "Excellent", B2: "Very Good", B3: "Good",
    C4: "Credit", C5: "Credit", C6: "Credit",
    D7: "Pass", E8: "Pass", F9: "Fail",
  };
  return MAP[grade.toUpperCase()] ?? "";
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

  // ── Role-based access control ──────────────────────────────────────────────
  // Prevents a student or parent from reading another student's report card.
  // Staff/proprietors are scoped to their own school below.
  if (user.role === "student") {
    const own = await prisma.student.findFirst({
      where: { id: studentId, userId: user.userId, schoolId: user.schoolId ?? undefined },
      select: { id: true },
    });
    if (!own) notFound();
  } else if (user.role === "parent") {
    const linked = await prisma.guardian.findFirst({
      where: { parentUserId: user.userId, studentId },
      select: { id: true },
    });
    if (!linked) notFound();
  }

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

  // Fetch class-subject links for department filtering
  const classSubjects = student.currentClassId
    ? await prisma.classSubject.findMany({
        where: { classId: student.currentClassId },
        select: { subjectId: true, department: true },
      })
    : [];
  const studentDept = (student as any).department || "";
  const registeredSubjectIds = new Set(
    classSubjects
      .filter((cs) => {
        if (cs.department === "general") return true;
        return studentDept && cs.department === studentDept;
      })
      .map((cs) => cs.subjectId),
  );

  // ── Find the class teacher for this student's class ──────────────────────
  // Look for a staff member with a class_teacher assignment for this class
  let classTeacherSignature: string | null = null;
  let classTeacherName: string | null = null;
  if (student.currentClassId) {
    const classTeacherAssignment = await prisma.assignment.findFirst({
      where: {
        classId: student.currentClassId,
        assignmentType: "class_teacher",
        schoolId: user.schoolId ?? undefined,
      },
      include: { staff: { select: { fullName: true, signature: true } } },
    });
    if (classTeacherAssignment?.staff) {
      classTeacherSignature = classTeacherAssignment.staff.signature ?? null;
      classTeacherName = classTeacherAssignment.staff.fullName ?? null;
    }
  }

  const [subjectResults, termResult, totalStudentsInClass, rcConfig] = await Promise.all([
    prisma.subjectResult.findMany({
      where: { studentId, termId, subjectId: registeredSubjectIds.size > 0 ? { in: [...registeredSubjectIds] } : undefined },
      include: { subject: { select: { name: true } } },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.termResult.findUnique({
      where: { studentId_termId: { studentId, termId } },
      include: { verificationCodes: { where: { status: "active" }, take: 1 } },
    }),
    prisma.student.count({
      where: { currentClassId: student.currentClassId ?? undefined, status: "active" },
    }),
    user.schoolId ? getReportCardConfig(user.schoolId) : Promise.resolve(DEFAULT_RC_CONFIG),
  ]);

  // ── Attendance ──────────────────────────────────────────────────────────
  // form saves: { daysPresent, daysAbsent, totalDays }
  const attendance = termResult?.attendanceSummary as Record<string, number> | null;
  const daysPresent = attendance?.daysPresent ?? attendance?.present ?? null;
  const daysAbsent  = attendance?.daysAbsent  ?? attendance?.absent  ?? null;
  const totalDays   = attendance?.totalDays   ?? attendance?.daysOpened ?? attendance?.opened ?? null;
  // derive missing fields when possible
  const effectiveTotalDays  = totalDays  ?? (daysPresent != null && daysAbsent != null ? daysPresent + daysAbsent : null);
  const effectiveDaysAbsent = daysAbsent ?? (daysPresent != null && effectiveTotalDays != null ? effectiveTotalDays - daysPresent : null);

  // ── Affective ratings ───────────────────────────────────────────────────
  const affective = termResult?.affectiveRatings as Record<string, unknown> | null;

  // ── Grading scale ───────────────────────────────────────────────────────
  const gradingScale = school?.gradingScale as Array<{ min: number; max: number; grade: string; remark?: string }> | null;

  // ── Assessment columns from actual stored scores ─────────────────────────
  // Collect all unique assessment type codes present across all subject results
  const allScoreKeys = new Set<string>();
  for (const sr of subjectResults) {
    const scores = sr.assessmentScores as Record<string, number> | null;
    if (scores) Object.keys(scores).forEach((k) => allScoreKeys.add(k));
  }
  // Preferred display order
  const PREFERRED_ORDER = ["WBT", "CA1", "CA2", "CA3", "MDT", "EXM", "EXAM"];
  const assessmentCols = [
    ...PREFERRED_ORDER.filter((k) => allScoreKeys.has(k)),
    ...[...allScoreKeys].filter((k) => !PREFERRED_ORDER.includes(k)),
  ];

  // Fetch assessment type names for the key (code → full name + max marks)
  const assessmentTypes = assessmentCols.length > 0 && user.schoolId
    ? await prisma.assessmentType.findMany({
        where: { schoolId: user.schoolId, code: { in: assessmentCols }, parentId: null },
        select: { code: true, name: true },
      })
    : [];
  // Also get weightings for max marks
  const assessmentWeightings = assessmentCols.length > 0 && user.schoolId
    ? await prisma.assessmentWeighting.findMany({
        where: { schoolId: user.schoolId, subjectId: null, assessmentTypeId: { in: assessmentCols } },
        select: { assessmentTypeId: true, weightPercentage: true },
      })
    : [];
  const atNameMap = new Map(assessmentTypes.map((a) => [a.code, a.name]));
  const atWeightMap = new Map(assessmentWeightings.map((w) => [w.assessmentTypeId, w.weightPercentage]));

  return (
    <div className="mx-auto max-w-[800px] p-6 print:p-0 print:max-w-none">
      {/* Print button — hidden on print */}
      <div className="mb-6 flex items-center gap-3 print:hidden">
        <PrintButton />
        <a href="/results" className="font-body-sm text-body-sm text-on-surface-variant hover:text-on-surface">
          ← Back to results
        </a>
        <a href="/results/report-card-settings" className="ml-auto font-label-sm text-label-sm text-primary hover:underline">
          ⚙ Report Card Settings
        </a>
      </div>

      {/* ════════════════════ REPORT CARD ════════════════════ */}
      <div
        id="report-card"
        className="bg-white border-2 border-gray-800 font-sans text-gray-900 relative overflow-hidden"
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        {/* ── Watermark logo ── */}
        {rcConfig.showWatermarkLogo && school?.logo && (
          <div
            aria-hidden
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-0"
          >
            <Image
              src={school.logo}
              alt=""
              width={360}
              height={360}
              className="object-contain"
              style={{ opacity: 0.06 }}
              unoptimized
            />
          </div>
        )}

        {/* Content wrapper — above watermark */}
        <div className="relative z-10">

          {/* ── SCHOOL HEADER ── */}
          <div className="border-b-2 border-gray-800 px-6 py-4">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex-shrink-0 w-20">
                {school?.logo ? (
                  <Image src={school.logo} alt="School logo" width={80} height={80} className="object-contain" unoptimized />
                ) : (
                  <div className="w-20 h-20 rounded-full border-2 border-gray-400 flex items-center justify-center bg-gray-100">
                    <span className="text-xs text-gray-400 text-center px-1">{school?.shortcode ?? "LOGO"}</span>
                  </div>
                )}
              </div>

              {/* School details */}
              <div className="flex-1 text-center">
                <h1 className="text-xl font-extrabold uppercase tracking-wide text-gray-900">
                  {school?.name ?? "School Name"}
                </h1>
                {school?.address && <p className="text-xs text-gray-600 mt-0.5">{school.address}</p>}
                {(school?.phone || school?.email) && (
                  <p className="text-xs text-gray-600">{[school.phone, school.email].filter(Boolean).join(" | ")}</p>
                )}
                {school?.motto && <p className="text-xs italic text-gray-500 mt-0.5">Motto: &ldquo;{school.motto}&rdquo;</p>}
                <div className="mt-1.5 inline-block border border-gray-800 px-4 py-0.5 rounded">
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-800">Student Report Card</span>
                </div>
              </div>

              {/* Logo mirror (right side) — keeps header balanced */}
              <div className="flex-shrink-0 w-20">
                {school?.logo ? (
                  <Image src={school.logo} alt="" width={80} height={80} className="object-contain opacity-40" unoptimized />
                ) : (
                  <div className="w-20 h-20" />
                )}
              </div>
            </div>
          </div>

          {/* ── SESSION / TERM BANNER ── */}
          <div className="bg-[#002046] text-white px-6 py-1.5 flex justify-between items-center text-xs font-semibold uppercase tracking-wide">
            <span>Session: {term.session.label}</span>
            <span>{term.name} Term</span>
            <span>Class: {student.currentClass?.name ?? "—"}</span>
          </div>

          {/* ── STUDENT INFO + PASSPORT ── */}
          <div className="px-6 py-4 flex gap-6 border-b border-gray-300">
            {/* Passport */}
            {rcConfig.showPassportPhoto && (
              <div className="flex-shrink-0">
                {student.passportPhoto ? (
                  <Image src={student.passportPhoto} alt="Passport" width={90} height={110} className="object-cover border border-gray-400" unoptimized />
                ) : (
                  <div className="w-[90px] h-[110px] border border-gray-400 bg-gray-50 flex items-center justify-center">
                    <span className="text-[10px] text-gray-400 text-center">Passport</span>
                  </div>
                )}
              </div>
            )}

            {/* Details grid */}
            <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <InfoRow label="Full Name" value={[student.firstName, student.middleName, student.lastName].filter(Boolean).join(" ")} />
              <InfoRow label="Admission No." value={student.admissionNumber} />
              <InfoRow label="Class" value={student.currentClass?.name ?? "—"} />
              <InfoRow label="Gender" value={student.gender ? (student.gender.charAt(0).toUpperCase() + student.gender.slice(1)) : "—"} />
              <InfoRow label="Date of Birth" value={student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString("en-GB") : "—"} />
              <InfoRow label="No. in Class" value={String(totalStudentsInClass)} />
              {rcConfig.showPosition && termResult?.overallPosition && (
                <InfoRow label="Position" value={`${ordinal(termResult.overallPosition)} of ${totalStudentsInClass}`} bold />
              )}
              {termResult?.overallAverage != null && (
                <InfoRow label="Overall Average" value={`${Math.round(termResult.overallAverage)}%`} bold />
              )}
            </div>
          </div>

          {/* ── SUBJECT RESULTS TABLE ── */}
          <div className="px-6 py-3">
            <table className="w-full text-xs border-collapse border border-gray-400">
              <thead>
                <tr className="bg-[#002046] text-white">
                  <th className="border border-gray-500 px-2 py-1.5 text-left">Subject</th>
                  {assessmentCols.map((code) => (
                    <th key={code} className="border border-gray-500 px-2 py-1.5 text-center whitespace-nowrap">
                      {code}
                    </th>
                  ))}
                  <th className="border border-gray-500 px-2 py-1.5 text-center font-bold">Total</th>
                  {rcConfig.showGrade && <th className="border border-gray-500 px-2 py-1.5 text-center">Grade</th>}
                  {rcConfig.showPosition && <th className="border border-gray-500 px-2 py-1.5 text-center">Position</th>}
                  {rcConfig.showRemark && <th className="border border-gray-500 px-2 py-1.5 text-center">Remark</th>}
                </tr>
              </thead>
              <tbody>
                {subjectResults.length === 0 && (
                  <tr>
                    <td colSpan={assessmentCols.length + 4} className="border border-gray-300 px-2 py-3 text-center text-gray-400">
                      No subject results recorded.
                    </td>
                  </tr>
                )}
                {subjectResults.map((sr, idx) => {
                  const scores = sr.assessmentScores as Record<string, number> | null;
                  return (
                    <tr key={sr.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="border border-gray-300 px-2 py-1 font-medium">{sr.subject.name}</td>
                      {assessmentCols.map((code) => {
                        const val = scores?.[code];
                        return (
                          <td key={code} className="border border-gray-300 px-2 py-1 text-center">
                            {val != null ? Math.round(val) : "—"}
                          </td>
                        );
                      })}
                      <td className="border border-gray-300 px-2 py-1 text-center font-bold">
                        {sr.totalScore != null ? Math.round(sr.totalScore) : "—"}
                      </td>
                      {rcConfig.showGrade && (
                        <td className={`border border-gray-300 px-2 py-1 text-center ${gradeColorClass(sr.grade)}`}>
                          {sr.grade ?? "—"}
                        </td>
                      )}
                      {rcConfig.showPosition && (
                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                          {sr.subjectPosition != null ? ordinal(sr.subjectPosition) : "—"}
                        </td>
                      )}
                      {rcConfig.showRemark && (
                        <td className="border border-gray-300 px-2 py-1 text-center text-gray-600">
                          {gradeRemark(sr.grade, gradingScale)}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td colSpan={assessmentCols.length + 1} className="border border-gray-400 px-2 py-1.5 text-right">
                    Overall Average:
                  </td>
                  <td className="border border-gray-400 px-2 py-1.5 text-center">
                    {termResult?.overallAverage != null ? `${Math.round(termResult.overallAverage)}%` : "—"}
                  </td>
                  {rcConfig.showGrade && <td className="border border-gray-400 px-2 py-1.5" />}
                  {rcConfig.showPosition && (
                    <td className="border border-gray-400 px-2 py-1.5 text-center text-gray-600">
                      {termResult?.overallPosition ? `${ordinal(termResult.overallPosition)} of ${totalStudentsInClass}` : ""}
                    </td>
                  )}
                  {rcConfig.showRemark && <td className="border border-gray-400 px-2 py-1.5" />}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── GRADING KEY ── */}
          {rcConfig.showGradingKey && gradingScale && gradingScale.length > 0 && (
            <div className="px-6 pb-1">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-gray-600 border border-gray-200 rounded px-2 py-1 bg-gray-50">
                <span className="font-semibold text-gray-700">Grades:</span>
                {gradingScale.map((band) => (
                  <span key={band.grade}>
                    <span className="font-bold">{band.grade}</span>{band.remark ? `: ${band.remark}` : ""} ({band.min}–{band.max})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── ASSESSMENT KEY ── */}
          {assessmentCols.length > 0 && (
            <div className="px-6 pb-2">
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-gray-600 border border-gray-200 rounded px-2 py-1 bg-gray-50">
                <span className="font-semibold text-gray-700">Assessment Key:</span>
                {assessmentCols.map((code) => {
                  const name = atNameMap.get(code);
                  const max  = atWeightMap.get(code);
                  return (
                    <span key={code}>
                      <span className="font-bold">{code}</span>
                      {name ? ` = ${name}` : ""}
                      {max  ? ` (max ${max})` : ""}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── AFFECTIVE + ATTENDANCE ── */}
          {(rcConfig.showAffective || rcConfig.showAttendance) && (
            <div className={`px-6 py-3 border-t border-gray-300 grid gap-4 ${rcConfig.showAffective && rcConfig.showAttendance ? "grid-cols-2" : "grid-cols-1"}`}>
              {/* Affective Domain */}
              {rcConfig.showAffective && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 border-b border-gray-300 pb-1 mb-1">Affective Domain</h3>
                  {affective && Object.keys(affective).length > 0 ? (
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="text-left border border-gray-300 px-1.5 py-1 text-gray-600">Trait</th>
                          <th className="text-center border border-gray-300 px-1.5 py-1 w-12 text-gray-600">Rating</th>
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
              )}

              {/* Attendance */}
              {rcConfig.showAttendance && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 border-b border-gray-300 pb-1 mb-1">Attendance</h3>
                  <table className="w-full text-xs border-collapse">
                    <tbody>
                      <AttRow label="Times School Opened" value={effectiveTotalDays != null ? String(effectiveTotalDays) : "—"} />
                      <AttRow label="Times Present" value={daysPresent != null ? String(daysPresent) : "—"} />
                      <AttRow label="Times Absent" value={effectiveDaysAbsent != null ? String(effectiveDaysAbsent) : "—"} />
                      {attendance?.late != null && <AttRow label="Times Late" value={String(attendance.late)} />}
                    </tbody>
                  </table>
                  {rcConfig.showCumulativeAverage && termResult?.cumulativeAverage != null && (
                    <div className="mt-2 border border-gray-300 rounded px-2 py-1 bg-gray-50 text-xs">
                      <span className="font-semibold text-gray-700">Cumulative Average: </span>
                      <span className="font-bold">{Math.round(termResult.cumulativeAverage)}%</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── COMMENTS ── */}
          {(rcConfig.showTeacherComment || rcConfig.showPrincipalComment) && (
            <div className={`px-6 py-3 border-t border-gray-300 grid gap-4 ${rcConfig.showTeacherComment && rcConfig.showPrincipalComment ? "grid-cols-2" : "grid-cols-1"}`}>
              {rcConfig.showTeacherComment && (
                <CommentBox label="Class Teacher's Comment" comment={termResult?.teacherComment ?? null} />
              )}
              {rcConfig.showPrincipalComment && (
                <CommentBox label="Principal's Comment" comment={termResult?.principalComment ?? null} />
              )}
            </div>
          )}

          {/* ── SIGNATURES & STAMP ── */}
          {rcConfig.showSignatures && (
            <div className="px-6 pb-5 pt-3 border-t border-gray-300 grid grid-cols-3 gap-6 items-end text-xs text-gray-700">
              {/* Class Teacher signature — LEFT */}
              <SignatureBox
                label={classTeacherName ? `Class Teacher: ${classTeacherName}` : "Class Teacher's Signature"}
                imageUrl={classTeacherSignature}
              />

              {/* School Stamp — CENTER */}
              <div className="flex flex-col items-center gap-1">
                <div className="h-20 w-20 flex items-center justify-center">
                  {rcConfig.showStamp && school?.stamp ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={school.stamp}
                      alt="School stamp"
                      width={80}
                      height={80}
                      className="object-contain max-h-20 max-w-20"
                    />
                  ) : rcConfig.showStamp ? (
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center">
                      <span className="text-[9px] text-gray-300">STAMP</span>
                    </div>
                  ) : null}
                </div>
                {rcConfig.showStamp && <span className="text-[10px] text-gray-500">School Stamp</span>}
              </div>

              {/* Principal signature — RIGHT */}
              <SignatureBox label="Principal's Signature" imageUrl={school?.signature ?? null} />
            </div>
          )}

          {/* ── VERIFICATION CODE ── */}
          <div className="px-6 py-3 border-t-2 border-dashed border-gray-400">
            {termResult?.status === "finalised" && termResult.verificationCodes?.[0] ? (
              <div className="flex items-start justify-between gap-4">
                {/* Left: verification details */}
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                    ✓ Verified Result — Authentication Code
                  </p>
                  <p
                    className="text-lg font-extrabold tracking-[0.25em] text-gray-900 font-mono"
                    style={{ fontFamily: "monospace" }}
                  >
                    {termResult.verificationCodes[0].code}
                  </p>
                  <p className="text-[9px] text-gray-500">
                    Verify this result at:{" "}
                    <span className="font-semibold text-gray-700">
                      {school?.shortcode
                        ? `[your-domain]/${school.shortcode.toLowerCase()}/verify`
                        : "[your-domain]/verify"}
                    </span>
                    {" "}or use the school&apos;s portal and enter the code above.
                  </p>
                </div>
                {/* Right: verified badge */}
                <div className="flex-shrink-0 border-2 border-gray-700 rounded px-3 py-1.5 text-center">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-700">Authentic</p>
                  <p className="text-[8px] text-gray-500 mt-0.5">Marksheet Platform</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
                <p className="text-[10px] text-gray-500 italic">
                  {termResult?.status === "withheld"
                    ? "This result is currently withheld. Please contact the school office."
                    : "This is a draft report. A unique verification code will appear here once the principal finalises the results."}
                </p>
              </div>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div className="bg-[#002046] text-white px-6 py-2 text-center text-[10px]">
            {school?.name ?? "Marksheet School"} · Result generated on Marksheet Platform
          </div>

        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #report-card, #report-card * { visibility: visible; }
          #report-card { position: absolute; left: 0; top: 0; width: 100%; border: none !important; }
        }
      `}</style>
    </div>
  );
}

// ─── helper components ────────────────────────────────────────────────────────

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex gap-1 text-sm">
      <span className="text-gray-500 whitespace-nowrap shrink-0">{label}:</span>
      <span className={`text-gray-900 ${bold ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}

function AttRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="border border-gray-200 px-1.5 py-0.5 bg-gray-50">{label}</td>
      <td className="border border-gray-200 px-1.5 py-0.5 text-center font-semibold text-gray-900 w-12">{value}</td>
    </tr>
  );
}

function CommentBox({ label, comment }: { label: string; comment: string | null }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-700 mb-1">{label}:</p>
      <div className="border border-gray-300 rounded px-2 py-2 min-h-[48px] bg-gray-50 text-xs text-gray-800 italic">
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
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="object-contain max-h-14 max-w-full" />
        ) : (
          <div className="w-full border-b border-gray-400" />
        )}
      </div>
      <span className="text-[10px] text-gray-500 text-center">{label}</span>
    </div>
  );
}
