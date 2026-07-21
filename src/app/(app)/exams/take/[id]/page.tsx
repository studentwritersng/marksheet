import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { ExamTakingView } from "../exam-taking-view";

export default async function ExamTakePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  const exam = await prisma.exam.findUnique({
    where: { id },
    include: {
      subject: { select: { name: true } },
      class: { select: { name: true } },
      term: true,
      classes: { include: { class: { select: { id: true, name: true, level: true, department: true } } } },
      examQuestions: {
        include: {
          question: {
            include: {
              mcqOptions: { select: { id: true, optionText: true } },
              essaySpec: { select: { modelAnswer: true } },
            },
          },
        },
        orderBy: { questionId: "asc" },
      },
    },
  });
  if (!exam || exam.schoolId !== user.schoolId) notFound();

  // Find student record + their class details
  const student = await prisma.student.findFirst({
    where: { userId: user.userId },
    include: { currentClass: { select: { id: true, department: true, level: true } } },
  });
  if (!student || !student.currentClass) {
    return (
      <div className="flex flex-col gap-stack-lg">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">You are not enrolled in any class.</p>
        </div>
      </div>
    );
  }

  // Check the student's class is among the exam's assigned classes
  const examClassIds = new Set(exam.classes.map((ec) => ec.class.id));
  if (!examClassIds.has(student.currentClass.id)) {
    return (
      <div className="flex flex-col gap-stack-lg">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">You are not enrolled in this exam's class.</p>
        </div>
      </div>
    );
  }

  // Fee gate check — exam access blocked
  const { checkExamFeeGate } = await import("@/lib/fees/gate");
  const feeBlock = await checkExamFeeGate(user.schoolId, student.id, exam.termId);
  if (feeBlock) {
    return (
      <div className="flex flex-col gap-stack-lg">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 text-center">
          <p className="font-body-md text-body-md text-on-surface-variant">{feeBlock}</p>
        </div>
      </div>
    );
  }

  // Department check: if the exam's subject is restricted to a department,
  // the student's class must have that department.
  const classSubjectLink = await prisma.classSubject.findUnique({
    where: { classId_subjectId: { classId: student.currentClass.id, subjectId: exam.subjectId } },
  });
  if (classSubjectLink && classSubjectLink.department !== "general") {
    const studentDept = student.currentClass.department || "";
    if (studentDept !== classSubjectLink.department) {
      return (
        <div className="flex flex-col gap-stack-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              This subject is only available to {classSubjectLink.department} students in {student.currentClass.level}.
            </p>
          </div>
        </div>
      );
    }
  }

  const existingAttempt = await prisma.examAttempt.findFirst({
    where: { examId: id, studentId: student.id },
    include: { answers: true },
  });

  if (existingAttempt?.status === "submitted") {
    return <SubmittedView exam={exam} attempt={existingAttempt} />;
  }

  // Group questions for stimulus rendering
  const groupIds = [...new Set(exam.examQuestions.map((eq) => eq.question.questionGroupId).filter(Boolean))];
  const groups = groupIds.length > 0
    ? await prisma.questionGroup.findMany({
        where: { id: { in: groupIds as string[] } },
        include: { stimulus: true },
      })
    : [];

  const groupMap = new Map(groups.map((g) => [g.id, g]));

  // Build question data with group context
  const questions = exam.examQuestions.map((eq) => {
    const q = eq.question;
    const group = q.questionGroupId ? groupMap.get(q.questionGroupId) : undefined;
    return {
      id: q.id,
      text: q.text,
      type: q.type,
      marks: q.marks,
      mcqOptions: q.mcqOptions,
      hasModelAnswer: !!q.essaySpec,
      questionGroupId: q.questionGroupId,
      stimulus: group?.stimulus ?? null,
      groupInternallyShufflable: group?.internallyShufflable ?? false,
    };
  });

  return (
    <ExamTakingView
      examId={exam.id}
      studentId={student.id}
      attemptId={existingAttempt?.id}
      attemptData={existingAttempt ? {
        shuffledQuestionIds: existingAttempt.shuffledQuestionIds,
        shuffledOptionOrder: existingAttempt.shuffledOptionOrder,
        endsAt: existingAttempt.endsAt?.toISOString() ?? null,
      } : null}
      subjectName={exam.subject.name}
      className={exam.class?.name ?? ""}
      assessmentTypeId={exam.assessmentTypeId}
      durationMinutes={exam.durationMinutes}
      termName={`${exam.term.name}`}
      questions={questions}
      savedAnswers={existingAttempt?.answers.map((a) => ({
        questionId: a.questionId,
        mcqSelectedOptionId: a.mcqSelectedOptionId ?? undefined,
        essayResponseText: a.essayResponseText ?? undefined,
      })) ?? []}
      studentName={`${student.firstName} ${student.lastName}`.trim() || student.admissionNumber || "Student"}
      studentPhoto={student.passportPhoto ?? null}
    />
  );
}

async function SubmittedView({
  exam,
  attempt,
}: {
  exam: any;
  attempt: any;
}) {
  const mcqCorrect = attempt.answers.filter((a: any) => {
    const eq = exam.examQuestions.find((e: any) => e.questionId === a.questionId);
    if (!eq || eq.question.type !== "mcq") return false;
    const correct = eq.question.mcqOptions.find((o: any) => o.id === a.mcqSelectedOptionId)?.isCorrect;
    return correct;
  }).length;

  const totalMcq = attempt.answers.filter((a: any) => {
    const eq = exam.examQuestions.find((e: any) => e.questionId === a.questionId);
    return eq?.question.type === "mcq";
  }).length;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-on-secondary-container">check_circle</span>
        </div>
        <h2 className="font-headline-md text-headline-md text-on-surface">Exam Submitted</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-2">
          {exam.subject.name} · {exam.assessmentTypeId}
        </p>
        {totalMcq > 0 && exam.status === "published" && (
          <p className="mt-4 font-headline-sm text-headline-sm text-on-surface">
            MCQ Score: {mcqCorrect}/{totalMcq}
          </p>
        )}
        {totalMcq > 0 && exam.status !== "published" && (
          <p className="mt-4 font-body-sm text-body-sm text-on-surface-variant">
            Results will be available once the exam is published.
          </p>
        )}
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          Essay answers will be graded shortly.
        </p>
        <a
          href="/my-exams"
          className="mt-6 inline-block bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
        >
          Back to Exams
        </a>
      </div>
    </div>
  );
}
