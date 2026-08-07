# 09 — Feature Modules

Deep dives into each feature area. For each: what it does, the key files, the data flow, and the "gotchas".

## 1. Exams

**Purpose:** Create exams from a question bank, review/approve them, deliver online (with offline sync), grade automatically (MCQ) and with AI assistance (essay), and produce raw scores for results.

**Files:**
- `src/lib/exams/actions.ts` — lifecycle actions
- `src/lib/exams/essay-grading.ts` — AI essay grading + review
- `src/app/(app)/exams/*` — pages (list, detail, take, review)
- `src/app/api/exams/[examId]/essay-answers/route.ts` — essay answer feed

**Lifecycle (Exam.status):** `draft → pending_review → approved → published` (and `rejected` back to draft). Exam Officers submit; School Admins / Exam Officers review; publishing makes it available to students.

**Key mechanics:**
- `Exam` links to `AssessmentType`, `Term`, `Subject`, and many `Class`es via `ExamClass`.
- `ExamQuestion` = the paper composition (which questions, in what order). `shuffleEnabled` randomises question/option order per attempt.
- `ExamAttempt` carries `syncStatus` (`local_only`/`queued`/`synced`) for offline hubs, plus a server-side timer.
- `StudentAnswer` holds per-question results; MCQ auto-graded, essays get an AI suggestion + rubric match, teacher confirms the final score (`ManualScore` override).
- **Resits:** `attemptType: "resit"` with `originalExamId` links a resit attempt to the original exam.

**Actions:** `createExamAction`, submit-for-review, review/approve/reject, publish, `studentAnswerAction` (save answers), essay-grade confirm/override.

> Gotcha: always verify `subjectId`/`termId`/`assessmentTypeId` and each `classId` belongs to `ctx.schoolId` before creating (`findFirst`/`count` with `schoolId`).

## 2. Results, Grading & Report Cards

**Purpose:** Weight CA + exam scores into subject results, rank students, compute term results, produce printable report cards and broadsheets, and issue verification codes.

**Files:**
- `src/lib/results/compute.ts` — the computation engine (weighted scores, grades, ranks)
- `src/lib/grading-scale.ts` — grading band helpers (`defaultGradingScale`)
- `src/app/(app)/results/*`, `broadsheet`, `grading-scale`, `assessment-weightings`
- `src/lib/fees/gate.ts` — fee gating for results

**Data flow:**
1. School defines `AssessmentType`s (CA1, CA2, EXM) and `AssessmentWeighting` percentages per subject; all must sum to 100.
2. Teachers enter raw scores (`ManualScore`) for each component.
3. `computeClassResults({ schoolId, classId, termId })`:
   - Loads school `gradingScale` (JSON) or falls back to `defaultGradingScale`.
   - Loads class subjects, active students, and their manual scores.
   - Computes weighted total → grade band → within-class rank per subject.
   - Rolls up into `TermResult` (overallAverage, overallPosition, affective ratings, comments).
4. Status transitions: `computed → finalised → withheld`.
5. Printing: report card via `results/[studentId]` (print styles), broadsheet at `/broadsheet`.
6. **Verification:** finalised term results get a `VerificationCode`; public `/verify` + `api/verify/*` validate it (only finalised results).

**Report card settings:** `results/report-card-settings` — logo, signature, stamp, layout via `ReportCardTemplate` and `School.letterheadSettings`.

> Gotcha: `TermResult.status` and attendance/fee gating (`feeGateResults`, `feeGateExams`) control whether results/verification are available. Respect `withheld`.

## 3. Curriculum, Syllabus & Lesson Notes

**Purpose:** NERDC-aligned curriculum tracking, syllabus uploads, and structured lesson notes (manual or AI-generated).

**Files:**
- `src/lib/nerdc-subjects.ts`, `prisma/nerdc-seed.ts` — NERDC reference data
- `src/app/(app)/curriculum`, `curriculum-tracker`, `syllabus`, `lesson-notes`
- `src/lib/ai/class-level-guidance.ts` — AI lesson-note assistance
- `src/lib/period-tracker/actions.ts` — marking topics taught

**Models:** `CurriculumTopic` (system + school overrides), `NerdcContent` (raw markdown), `Syllabus` (upload + parsed topics), `LessonNote`.

**Flows:**
- Console (`/console/nerdc-upload`, `/console/curriculum`) manages the central curriculum.
- Schools track coverage via `curriculum-tracker`; teachers mark topics taught via `period-tracker` (`TaughtTopic`), verified by class captains.

## 4. Timetable

Two modes:
- **Manual:** `TimetableEntry` per class/day/period/subject/staff/room at `timetable` (with `timetable/wizard` guiding setup).
- **Generator (addon):** `/api/timetable-generate` runs the solver in `src/lib/timetable/solver.ts` against `SubjectTimetableRequirement`s, `StaffAvailability`, `SchoolTimetableRule`s, `Room`/`RoomType`s and a `TimetableTemplate` (days×`AddonPeriod`s), producing `AddonTimetable` + `AddonTimetableEntry` (lockable slots) and logging a `TimetableGenerationRun` (score, violations, iterations).

**Files:** `src/lib/timetable/{actions,solver}.ts`, `src/app/(app)/timetable/*`, `my-timetable`, `src/app/api/timetable-generate/route.ts`.

> Gotcha: the generator endpoint requires the **Timetable Generator addon** (`isAddonActive(schoolId, ...)`), same-origin, and school-admin. See `src/lib/addons/check.ts`.

## 5. Attendance (addon)

**Files:** `src/lib/attendance/actions.ts`, `src/app/(app)/attendance/{page,spreadsheet,qr-cards}`.

- Manual marking or QR-card scanning (`AttendanceRecord` per date/period/student; `StaffAttendanceRecord` for staff).
- `attendancePeriodEnabled` + `attendanceLateCutoff` on `School` control per-period vs daily mode.
- Spreadsheet view supports bulk entry, print, CSV export.
- QR ID cards configured via `IDCardTemplate`.
- Attendance can flow into `TermResult.attendanceSummary`.

## 6. Period Tracker (addon)

`TaughtTopic` = teacher marks a `CurriculumTopic` taught; **class captain** verifies (two-way accountability). Actions in `src/lib/period-tracker/actions.ts`.

## 7. Question Bank

**Files:** `src/lib/csv/question-import.ts` (CSV import), `src/lib/csv/question-template.ts`, `src/app/(app)/questions`, `src/app/api/question-groups/route.ts`.

- `Stimulus` → `QuestionGroup` → `Question` (`mcq`/`essay`) → `McqOption` / `EssayGradingSpec`.
- Question status workflow: `draft → pending_review → approved → archived`.
- CSV import supports bulk MCQ creation.

## 8. Students, Staff, Parents & Promotion

- **Students:** `students` (register, `students/import` CSV, `students/transfer`, `students/[id]`). Admission number auto-generated from `School.admissionFormat` (`SCH/{year}/{seq:4}`) via `studentSequence`. `status` active/withdrawn/graduated. `isClassCaptain`/`isViceClassCaptain` flags.
- **Staff:** `staff` + `staff/[id]` (assignments, signature upload). `AccountStatus` active/suspended. `Staff.workDays`, `dayStartTime`, `dayEndTime` feed the timetable solver.
- **Parents:** `parents` + `Guardian`. Parent logins: `User` (role `parent`) linked via `Guardian.parentUserId`, plus legacy `ParentAccount`.
- **Promotion:** `promotion` moves students across sessions/classes; `PromotionRecord` snapshots; cross-branch transfers in the proprietor console use `GroupStudentTransferRecord`.

## 9. Class-Subjects & Subject Assignment

`ClassSubject` links a `Subject` to a `Class` with a department (`general/science/art/commercial`). Used everywhere results are computed (department filtering). Actions in `src/lib/class-subjects/actions.ts`.

## 10. Messaging

- `Conversation` → `ConversationParticipant` (staff/parent/student, last-read) → `Message`.
- `/messages` (inbox), `/messages/compose`, `/messages/[id]`.
- `src/app/api/messages/search/route.ts` powers recipient search.

## 11. Support Tickets

- `Ticket` (status/priority/category, creator/assignee) → `TicketMessage`.
- School side: `/tickets`. Platform side: `/console/tickets`.
- Actions in `src/lib/tickets/actions.ts`.

## 12. School Settings & Announcements

- `/settings/school` (branding, `letterheadSettings`, grading scale, fee gating toggles).
- `/announcements` — `Announcement` with target roles, sticky flag, publish/expiry.
- `/audit-log` — read-only audit trail (see `src/lib/audit.ts`).

## 13. Landing page & public flows

- Root `page.tsx` redirects by role; guests see `(marketing)/landing-page.tsx`.
- **Landing stats** (`landing_stats` table): 4 hero numbers controlled from `/console/landing-stats`; each is `auto` (live platform counts: schools, students, verifications) or `manual` (stored value like "99.9%"). Logic in `src/lib/landing-stats.ts`.
- `/register` — `SchoolRegistrationForm` (sales-led onboarding, payment methods, referral offer). Creates a `SchoolRegistration`.
- `/verify` + `[shortcode]/verify` — public result verification.
- `DemoRequest` — homepage lead capture.

## 14. Fee status

`FeeStatus` per student×term (`cleared`/`not_cleared`/`partial`). `feeGateExams`/`feeGateResults` on `School` control whether unpaid students are blocked from exams/results. Gate logic in `src/lib/fees/gate.ts`.

## 15. Data imports/exports

- `src/lib/csv/` — student + question import parsers + downloadable templates.
- `src/lib/export/` — `csv.ts`, `doc.ts`, `pdf.ts`, `xlsx.ts` exporters (report cards, broadsheets, attendance).
- Client-side libraries: `papaparse`, `xlsx`, `jspdf`, `html2canvas` (print to PDF), `file-saver`.
