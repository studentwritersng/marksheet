# Homework Feature — Design Spec

**Date:** 2026-08-26
**Status:** Approved (design)
**Branch target:** separate feature branch off `master`

## 1. Goal

Add a **standalone Homework (take-home assignment)** feature to Marksheet. Teachers create homework per class + subject with MCQ and essay questions (manually or from the existing question bank). Students submit once (no time limit, optional due date). MCQ are auto-graded; essays are manually marked by the teacher; once published, results are pushed to the guardian via push + email.

Homework is **independent of the assessment/exam engine** (separate tables, separate UI, separate nav). It only reuses the existing `Question` bank for content import and the existing `createNotification` pipeline for guardian alerts.

## 2. Non-goals

- Not connected to the exam/CA/assessment scoring or report-card computation.
- Does not modify the existing `LessonNote.assignment` free-text homework field (legacy lesson-note homework stays as-is).
- No leaderboards, no timed quizzes (that is the separate `Quiz` system).
- No automatic essay grading; essays are teacher-marked.

## 3. Data model (new Prisma models)

```prisma
enum HomeworkStatus {
  draft
  published
  closed
}

enum HomeworkAttemptStatus {
  in_progress
  submitted
  graded
}

model Homework {
  id          String        @id @default(cuid())
  schoolId    String
  classId     String
  subjectId   String
  termId      String
  title       String
  instructions String?
  dueDate     DateTime?
  status      HomeworkStatus @default("draft")
  createdBy   String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  school    School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  class     Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  subject   Subject      @relation(fields: [subjectId], references: [id])
  term      Term         @relation(fields: [termId], references: [id], onDelete: Cascade)
  questions HomeworkQuestion[]
  attempts  HomeworkAttempt[]

  @@index([schoolId])
  @@index([classId, subjectId, termId])
  @@map("homework")
}

model HomeworkQuestion {
  id            String    @id @default(cuid())
  homeworkId    String
  type          QuestionType // mcq | essay (reuse existing enum)
  order         Int
  marks         Float     @default(1)
  text          String
  options       Json?     // MCQ: [{ text, isCorrect }] x4
  rubric        Json?     // Essay: grading guidance / mark scheme
  sourceQuestionId String? // when imported from the Question bank (provenance only)

  homework Homework @relation(fields: [homeworkId], references: [id], onDelete: Cascade)
  answers  HomeworkAnswer[]

  @@index([homeworkId])
  @@map("homework_questions")
}

model HomeworkAttempt {
  id          String              @id @default(cuid())
  homeworkId  String
  studentId   String
  schoolId    String
  classId     String
  termId      String
  status      HomeworkAttemptStatus @default("in_progress")
  mcqScore    Float     @default(0)
  essayScore   Float?    // set by teacher
  totalScore   Float?
  percentage   Float?
  published    Boolean   @default(false)
  submittedAt  DateTime?
  createdAt    DateTime  @default(now())

  homework Homework         @relation(fields: [homeworkId], references: [id], onDelete: Cascade)
  student  Student          @relation(fields: [studentId], references: [id], onDelete: Cascade)
  answers  HomeworkAnswer[]

  @@unique([homeworkId, studentId]) // one attempt per student
  @@index([studentId])
  @@index([classId])
  @@map("homework_attempts")
}

model HomeworkAnswer {
  id                  String   @id @default(cuid())
  attemptId           String
  homeworkQuestionId  String
  type                QuestionType
  response            Json     // MCQ: selectedIndex (Int); Essay: text (String)
  autoCorrect         Boolean?
  autoScore           Float    @default(0)
  teacherScore        Float?
  teacherComment      String?
  gradedAt            DateTime?

  attempt        HomeworkAttempt   @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  homeworkQuestion HomeworkQuestion @relation(fields: [homeworkQuestionId], references: [id], onDelete: Cascade)

  @@index([attemptId])
  @@map("homework_answers")
}
```

Reuses the existing `QuestionType` enum (`mcq | essay`). New migration folder applies these four tables.

## 4. Teacher flow

- **Nav:** new "Homework" group (teachers / class-teachers / school_admin). Items: "My Homework" (list), "New Homework", "Marking".
- **Create:** select class + subject + term, title, instructions, optional due date. Add questions via:
  - **From question bank:** search `Question` by subject + classLevel + type; import copies `text`, `options`/`rubric` (from `McqOption` / `EssayGradingSpec`) into a `HomeworkQuestion`. `sourceQuestionId` records provenance.
  - **Manual:** enter text; for MCQ enter up to 4 options + mark correct; for essay enter a rubric.
  - **Limits enforced server-side:** total MCQ ≤ 20, total essay ≤ 5; reject otherwise.
  - Save as `draft` or `published` (published = visible to students).
- **Marking dashboard:** list submitted attempts for a homework. MCQ answers shown with auto-score (reviewable). Each essay answer gets a teacher score (≤ question marks) + optional comment. "Save scores" → attempt `status = graded`, compute `totalScore = mcqScore + essayScore`, `percentage`. "Publish results" sets `published = true` and triggers guardian notifications.
- **Authorization:** teacher may only manage homework for classes/subjects they are assigned to (`Assignment` with `subject_teacher`/`class_teacher` for that class+subject), or school_admin.

## 5. Student flow

- **Nav:** student "Homework" item. Lists homework assigned to the student's class + subject + active term with `status = published`.
- Open a homework: renders MCQ + essay questions, **no timer**. Student answers and submits once.
- **Submission rules:** one attempt per `(homeworkId, studentId)`. If `dueDate` is set and has passed and the student has not submitted, the homework is locked (shows closed). After submit: MCQ auto-graded immediately (`autoCorrect`/`autoScore`); essay pending teacher. Student sees final result only after teacher publishes (`published = true`).

## 6. Grading logic

- **MCQ auto-grade:** on submit, for each MCQ answer compare `selectedIndex` to the stored correct option → `autoCorrect`, `autoScore = marks` if correct else 0. Sum into `mcqScore`.
- **Essay:** `autoScore = 0` on submit; teacher sets `teacherScore` (≤ question `marks`) + comment. Sum into `essayScore`.
- **Totals:** `totalScore = mcqScore + essayScore`; `percentage = totalScore / sum(question.marks) * 100`. Computed when attempt graded; persisted.

## 7. Notifications

- On **Publish results**, for each student in the homework's class (or each attempt), call `createNotification` to the guardian:
  - `recipientType: "parent"`, `recipientId: guardian.parentUserId`, `recipientEmail: guardian.email`
  - `eventType: "homework_result"`, `title: "Homework result: <title>"`, `content`: student name, score, percentage.
  - Two calls per guardian: `channel: "in_app"` (delivers push) and `channel: "email"`.
- Reuses `src/lib/notifications/actions.ts` `createNotification` exactly as the Bursary reminders do.

## 8. Permissions & nav

- New nav group "Homework": teacher items (`/homework`, `/homework/new`, `/homework/marking`) and student item (`/homework` or `/student/homework`).
- Server actions guard: teacher actions require an assignment covering the target class+subject (or school_admin); student actions require the attempt belongs to the session student.
- Mirror the existing `canManageFees` / `requireBursar` guard pattern from the Bursary feature.

## 9. Reuse / dependencies

- `Question` bank (`src/.../questions`) for import.
- `createNotification` (Bursary reminders pattern) for guardian alerts.
- `Guardian` model for `parentUserId` / `email`.
- `Assignment` model for teacher class/subject authorization.
- Existing shadcn/ui + server-action + `ActionState` patterns (mirror `/fees`).

## 10. Testing & verification

- Unit tests (vitest) for grading math: MCQ auto-score, essay manual score aggregation, percentage, MCQ≤20/essay≤5 guards.
- `npx tsc --noEmit` (excluding pre-existing `next.config.ts`) must be clean.
- `npx vitest run src/lib/homework`.
- Manual smoke requires a live DB (the local dev DB was unreachable this session; migrations must be applied via `prisma migrate deploy` before testing).

## 11. Open decisions / constraints

- LessonNote free-text homework field is left intact (separate concern).
- The dev database is unreachable in the build environment; migrations are written but applied against the real DB during Vercel deploy (`prisma migrate deploy` runs in the build step).
