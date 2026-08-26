CREATE TYPE "HomeworkStatus" AS ENUM ('draft','published','closed');
CREATE TYPE "HomeworkAttemptStatus" AS ENUM ('in_progress','submitted','graded');
CREATE TABLE "homework" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "instructions" TEXT,
  "dueDate" TIMESTAMP(3),
  "status" "HomeworkStatus" NOT NULL DEFAULT 'draft',
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "homework_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "homework_questions" (
  "id" TEXT NOT NULL,
  "homeworkId" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL,
  "order" INTEGER NOT NULL,
  "marks" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "text" TEXT NOT NULL,
  "options" JSONB,
  "rubric" JSONB,
  "sourceQuestionId" TEXT,
  CONSTRAINT "homework_questions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "homework_attempts" (
  "id" TEXT NOT NULL,
  "homeworkId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "status" "HomeworkAttemptStatus" NOT NULL DEFAULT 'in_progress',
  "mcqScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "essayScore" DOUBLE PRECISION,
  "totalScore" DOUBLE PRECISION,
  "percentage" DOUBLE PRECISION,
  "published" BOOLEAN NOT NULL DEFAULT false,
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "homework_attempts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "homework_answers" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "homeworkQuestionId" TEXT NOT NULL,
  "type" "QuestionType" NOT NULL,
  "response" JSONB NOT NULL,
  "autoCorrect" BOOLEAN,
  "autoScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "teacherScore" DOUBLE PRECISION,
  "teacherComment" TEXT,
  "gradedAt" TIMESTAMP(3),
  CONSTRAINT "homework_answers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "homework" ADD CONSTRAINT "homework_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "homework_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_questions" ADD CONSTRAINT "homework_questions_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_attempts" ADD CONSTRAINT "homework_attempts_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_attempts" ADD CONSTRAINT "homework_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_answers" ADD CONSTRAINT "homework_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "homework_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "homework_answers" ADD CONSTRAINT "homework_answers_homeworkQuestionId_fkey" FOREIGN KEY ("homeworkQuestionId") REFERENCES "homework_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "homework_schoolId_idx" ON "homework"("schoolId");
CREATE INDEX "homework_classId_subjectId_termId_idx" ON "homework"("classId","subjectId","termId");
CREATE INDEX "homework_questions_homeworkId_idx" ON "homework_questions"("homeworkId");
CREATE UNIQUE INDEX "homework_attempts_homeworkId_studentId_key" ON "homework_attempts"("homeworkId","studentId");
CREATE INDEX "homework_attempts_studentId_idx" ON "homework_attempts"("studentId");
CREATE INDEX "homework_attempts_classId_idx" ON "homework_attempts"("classId");
CREATE INDEX "homework_answers_attemptId_idx" ON "homework_answers"("attemptId");
