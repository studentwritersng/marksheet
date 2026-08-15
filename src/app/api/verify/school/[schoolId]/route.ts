import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const { schoolId } = await params;
  const { searchParams } = new URL(_req.url);
  const code = searchParams.get("code")?.trim().toUpperCase();

  if (!code) {
    return Response.json({ error: "Please enter a verification code." });
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, logo: true, motto: true },
  });

  if (!school) {
    return Response.json({ error: "School not found." }, { status: 404 });
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
        },
      },
    },
  });

  if (!vc || vc.status !== "active") {
    return Response.json({ error: "Invalid or revoked verification code." });
  }

  if (vc.termResult.student.schoolId !== school.id) {
    return Response.json({ error: "This code does not belong to this school." }, { status: 403 });
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

  return Response.json({
    studentName: `${tr.student.firstName} ${tr.student.lastName}`,
    admissionNumber: tr.student.admissionNumber,
    className: tr.student.currentClass?.name ?? "—",
    schoolName: school.name,
    schoolLogo: school.logo,
    schoolMotto: school.motto,
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
