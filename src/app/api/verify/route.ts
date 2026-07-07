import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return Response.json({ error: "Please enter a verification code." });
  }

  const vc = await prisma.verificationCode.findUnique({
    where: { code },
    include: {
      termResult: {
        include: {
          student: {
            include: { currentClass: { select: { name: true } } },
          },
          term: { include: { session: true } },
          verificationCodes: { where: { status: "active" }, take: 1 },
        },
      },
    },
  });

  if (!vc || vc.status !== "active") {
    return Response.json({ error: "Invalid or revoked verification code." });
  }

  const tr = vc.termResult;
  if (tr.status !== "finalised") {
    return Response.json({ error: "Results have not been finalised yet." });
  }

  const subjectResults = await prisma.subjectResult.findMany({
    where: { studentId: tr.studentId, termId: tr.termId },
    include: { subject: { select: { name: true } } },
    orderBy: { subject: { name: "asc" } },
  });

  const school = await prisma.school.findUnique({
    where: { id: tr.student.schoolId },
    select: { name: true },
  });

  return Response.json({
    studentName: `${tr.student.firstName} ${tr.student.lastName}`,
    admissionNumber: tr.student.admissionNumber,
    className: tr.student.currentClass?.name ?? "—",
    schoolName: school?.name ?? "School",
    session: tr.term.session.label,
    term: tr.term.name,
    overallAverage: tr.overallAverage,
    overallPosition: tr.overallPosition,
    subjects: subjectResults.map((sr) => ({
      name: sr.subject.name,
      score: sr.totalScore,
      grade: sr.grade,
    })),
  });
}
