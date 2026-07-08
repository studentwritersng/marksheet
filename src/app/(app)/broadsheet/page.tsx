import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { BroadsheetView } from "./broadsheet-view";

export default async function BroadsheetPage(props: {
  searchParams: Promise<{ classId?: string; termId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const { classId, termId } = await props.searchParams;

  const [classes, terms, school] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: user.schoolId, archived: false },
      select: { id: true, name: true, level: true },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    }),
    prisma.term.findMany({
      where: { session: { schoolId: user.schoolId } },
      include: { session: { select: { label: true } } },
      orderBy: [{ session: { label: "desc" } }, { name: "asc" }],
    }),
    prisma.school.findUnique({
      where: { id: user.schoolId },
      select: { name: true, logo: true, gradingScale: true },
    }),
  ]);

  // Build broadsheet data when class + term selected
  let broadsheetData: BroadsheetData | null = null;
  if (classId && termId) {
    broadsheetData = await fetchBroadsheetData(user.schoolId, classId, termId);
  }

  return (
    <BroadsheetView
      classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level }))}
      terms={terms.map((t) => ({ id: t.id, label: `${t.name} (${t.session.label})` }))}
      selectedClassId={classId ?? ""}
      selectedTermId={termId ?? ""}
      schoolName={school?.name ?? ""}
      schoolLogo={school?.logo ?? null}
      data={broadsheetData}
    />
  );
}

// --- Broadsheet data types & fetcher ---

interface SubjectCol {
  id: string;
  name: string;
  assessmentTypeCodes: string[];
}

interface StudentRow {
  sn: number;
  id: string;
  admissionNumber: string;
  fullName: string;
  scores: Record<string, Record<string, number | null>>; // subjectId -> assessmentTypeCode -> score
  totals: Record<string, number | null>; // subjectId -> totalScore
  grades: Record<string, string | null>; // subjectId -> grade
  positions: Record<string, number | null>;
  grandTotal: number | null;
  average: number | null;
  overallGrade: string | null;
  position: number | null;
}

interface FooterAggregate {
  subjectId: string;
  classAverage: number | null;
  highest: number | null;
  lowest: number | null;
}

export interface BroadsheetData {
  className: string;
  termLabel: string;
  generatedAt: string;
  assessmentTypeCodes: string[]; // ordered list of column headings (e.g. CA1, CA2, CA3, Exam)
  subjects: SubjectCol[];
  students: StudentRow[];
  footers: FooterAggregate[];
  resitIndicators: Set<string>; // "studentId:subjectId" keys
}

async function fetchBroadsheetData(
  schoolId: string,
  classId: string,
  termId: string,
): Promise<BroadsheetData> {
  const cls = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
  const term = await prisma.term.findUniqueOrThrow({
    where: { id: termId },
    include: { session: { select: { label: true } } },
  });

  // Assessment types with weightings (parent-level, ordered by sortOrder)
  const assessmentTypes = await prisma.assessmentType.findMany({
    where: { schoolId, parentId: null },
    orderBy: { sortOrder: "asc" },
  });
  const assessmentTypeCodes = assessmentTypes.map((at) => at.code).filter(Boolean);

  // Subjects linked to this class
  const classSubjects = await prisma.classSubject.findMany({
    where: { classId },
    include: { subject: { select: { id: true, name: true } } },
  });
  const subjects: SubjectCol[] = classSubjects.map((cs) => ({
    id: cs.subject.id,
    name: cs.subject.name,
    assessmentTypeCodes,
  }));

  // Active students in class
  const students = await prisma.student.findMany({
    where: { schoolId, currentClassId: classId, status: "active" },
    orderBy: { lastName: "asc" },
  });

  // Subject results for this class/term
  const studentIds = students.map((s) => s.id);
  const subjectIds = subjects.map((s) => s.id);
  const subjectResults = await prisma.subjectResult.findMany({
    where: { studentId: { in: studentIds }, subjectId: { in: subjectIds }, termId },
  });

  // Term results for overall scores
  const termResults = await prisma.termResult.findMany({
    where: { studentId: { in: studentIds }, termId },
  });

  // Build lookup maps
  const srMap = new Map<string, typeof subjectResults[0]>();
  for (const sr of subjectResults) {
    srMap.set(`${sr.studentId}:${sr.subjectId}`, sr);
  }
  const trMap = new Map(termResults.map((tr) => [tr.studentId, tr]));

  // Build student rows
  const resitIndicators = new Set<string>();
  let sn = 0;
  const studentRows: StudentRow[] = students.map((s) => {
    sn++;
    const tr = trMap.get(s.id);

    const scores: Record<string, Record<string, number | null>> = {};
    const totals: Record<string, number | null> = {};
    const grades: Record<string, string | null> = {};
    const positions: Record<string, number | null> = {};

    for (const sub of subjects) {
      const sr = srMap.get(`${s.id}:${sub.id}`);
      const rawScores = (sr?.assessmentScores as Record<string, number> | null) ?? {};
      scores[sub.id] = {};
      for (const code of assessmentTypeCodes) {
        scores[sub.id][code] = rawScores[code] ?? null;
      }
      totals[sub.id] = sr?.totalScore ?? null;
      grades[sub.id] = sr?.grade ?? null;
      positions[sub.id] = sr?.subjectPosition ?? null;
    }

    return {
      sn,
      id: s.id,
      admissionNumber: s.admissionNumber ?? "",
      fullName: `${s.lastName}, ${s.firstName}`,
      scores,
      totals,
      grades,
      positions,
      grandTotal: tr?.overallAverage != null ? tr.overallAverage * subjects.length : null,
      average: tr?.overallAverage ?? null,
      overallGrade: null, // computed below
      position: tr?.overallPosition ?? null,
    };
  });

  // Compute overall grade from average using school grading scale
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { gradingScale: true },
  });
  const defaultGradingScale = [
    { grade: "A1", min: 75, max: 100 },
    { grade: "B2", min: 70, max: 74 },
    { grade: "B3", min: 65, max: 69 },
    { grade: "C4", min: 60, max: 64 },
    { grade: "C5", min: 55, max: 59 },
    { grade: "C6", min: 50, max: 54 },
    { grade: "D7", min: 45, max: 49 },
    { grade: "E8", min: 40, max: 44 },
    { grade: "F9", min: 0, max: 39 },
  ];
  const scale = (school?.gradingScale as unknown as typeof defaultGradingScale) ?? defaultGradingScale;
  for (const row of studentRows) {
    if (row.average != null) {
      for (const band of scale) {
        if (row.average >= band.min && row.average <= band.max) {
          row.overallGrade = band.grade;
          break;
        }
      }
    }
  }

  // Footer aggregates per subject
  const footers: FooterAggregate[] = subjects.map((sub) => {
    const totalsList = studentRows
      .map((r) => r.totals[sub.id])
      .filter((t): t is number => t != null);
    return {
      subjectId: sub.id,
      classAverage: totalsList.length > 0
        ? Math.round((totalsList.reduce((a, b) => a + b, 0) / totalsList.length) * 10) / 10
        : null,
      highest: totalsList.length > 0 ? Math.max(...totalsList) : null,
      lowest: totalsList.length > 0 ? Math.min(...totalsList) : null,
    };
  });

  return {
    className: cls.name,
    termLabel: `${term.name} (${term.session.label})`,
    generatedAt: new Date().toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    }),
    assessmentTypeCodes,
    subjects,
    students: studentRows,
    footers,
    resitIndicators,
  };
}
