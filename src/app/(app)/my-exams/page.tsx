import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function MyExamsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/dashboard");

  const student = await prisma.student.findUnique({
    where: { userId: user.userId },
    select: { id: true, firstName: true, lastName: true, currentClassId: true, currentClass: { select: { name: true } } },
  });
  if (!student) return <p className="font-body-sm text-body-sm text-on-surface-variant">Student record not found.</p>;
  if (!student.currentClassId) return <p className="font-body-sm text-body-sm text-on-surface-variant">You have not been assigned a class yet.</p>;

  const session = await prisma.session.findFirst({
    where: { schoolId: user.schoolId!, isCurrent: true },
    include: { terms: { where: { isCurrent: true } } },
  });
  if (!session || !session.terms[0]) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No active session/term set.</p>;
  }

  const exams = await prisma.exam.findMany({
    where: {
      schoolId: user.schoolId!,
      termId: session.terms[0].id,
      status: "published",
      classes: { some: { classId: student.currentClassId } },
    },
    include: {
      subject: { select: { name: true } },
      attempts: {
        where: { studentId: student.id },
        select: { id: true, status: true, startedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">My Exams</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          {student.firstName} {student.lastName} &middot; {student.currentClass?.name} &middot; {session.label} ({session.terms[0].name} Term)
        </p>
      </div>

      {exams.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">No exams assigned to your class this term.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {exams.map((exam) => {
            const attempt = exam.attempts[0];
            const isSubmitted = attempt?.status === "submitted";
            const isInProgress = attempt?.status === "in_progress";

            return (
              <div key={exam.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-[#002046]">quiz</span>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">{exam.subject.name}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-2 py-0.5 rounded">
                    {exam.durationMinutes} min
                  </span>
                  <span className="bg-surface-variant text-on-surface-variant font-label-sm text-label-sm px-2 py-0.5 rounded capitalize">
                    {exam.assessmentTypeId}
                  </span>
                </div>
                <div className="mt-auto pt-2">
                  {isSubmitted ? (
                    <div className="flex items-center gap-2 text-secondary">
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      <span className="font-label-sm text-label-sm">Submitted</span>
                    </div>
                  ) : (
                    <Link
                      href={`/exams/take/${exam.id}`}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {isInProgress ? "play_arrow" : "start"}
                      </span>
                      {isInProgress ? "Continue" : "Start Exam"}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
