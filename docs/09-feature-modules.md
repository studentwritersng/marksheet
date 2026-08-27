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

The per-student fee status (`cleared` / `partial` / `not_paid`) is **derived** from the fee structure (`FeeItem`s) and recorded payments (`StudentPayment`s) via `getStudentFeeSummary` in `src/lib/fees/bursary.ts` — it is no longer hand-set on the `FeeStatus` row. `feeGateExams`/`feeGateResults` on `School` (logic in `src/lib/fees/gate.ts`) control whether unpaid students are blocked from exams/results. Full fee management — structure, payments, reminders — is covered in §17.

## 15. Data imports/exports

- `src/lib/csv/` — student + question import parsers + downloadable templates.
- `src/lib/export/` — `csv.ts`, `doc.ts`, `pdf.ts`, `xlsx.ts` exporters (report cards, broadsheets, attendance).
- Client-side libraries: `papaparse`, `xlsx`, `jspdf`, `html2canvas` (print to PDF), `file-saver`.

## 16. Homework (Take-home Assignments)

**Purpose:** Teachers set take-home assignments (MCQ + essay questions) for a class/subject/term; students attempt them; MCQs auto-grade and essays are teacher-marked; scores publish to the student and surface on the parent portal.

**Files:**
- `src/app/(app)/homework/actions.ts` — `createHomeworkAction`, `publishHomeworkAction` (draft → published), `submitHomeworkAction`, `markHomeworkAction`
- `src/app/(app)/homework/auth.ts` — `requireHomeworkManager` (teacher) / `requireStudentSelf` (student) guards
- `src/app/(app)/homework/*` — teacher pages (list, `new`, `[id]` detail, `[id]/mark` grading)
- `src/lib/homework/grading.ts` — MCQ auto-grade + essay scoring
- `src/app/(app)/student/homework/*` — student list + take flow (`[id]/take-client.tsx`)
- `src/app/(app)/parent/ward/[studentId]/page.tsx` — shows each ward's homework status + score
- `src/app/(app)/parent/results/page.tsx` — parent Academic Hub aggregates published homework across all wards

**Models:** `Homework` (status `draft`/`published`, `classId`, `subjectId`, `termId`, `dueDate`), `HomeworkQuestion` (`mcq`/`essay`, `marks`), `HomeworkAttempt` (per student: `mcqScore`, `essayScore`, `totalScore`, `percentage`, `status`, `published`).

**Flow:**
1. Teacher builds homework (questions from the bank or ad-hoc) and publishes it → visible to students in the assigned class.
2. Student opens `/student/homework`, attempts the paper; MCQs grade instantly, essays await teacher marking.
3. Teacher marks essays at `/homework/[id]/mark`; the attempt's `totalScore`/`percentage` is set and `published` so the student/parent can see it.
4. Parent portal surfaces homework status + score per ward, and the Academic Hub (`/parent/results`) lists published homework for all wards.

> Gotcha: homework visibility is gated on `Homework.status === "published"`; unpublished drafts are invisible to students. Use `requireHomeworkManager` for teacher routes and `requireStudentSelf` for student routes.

## 17. Bursary & Fee Management

**Purpose:** Define per-term fee structures, record student payments, derive each student's fee status, and run automated fee reminders. Surfaced to fee managers via the "Bursary" nav menu (when `canManageFees`).

**Files:**
- `src/lib/fees/bursary.ts` — `getStudentFeeSummary`, `getStudentFeeSummaryBatch`, `deriveFeeStatus` (expected vs paid → `cleared`/`partial`/`not_paid`/`no_structure`)
- `src/app/(app)/fees/page.tsx` + `fees-manager.tsx` — Fee Menu
- `src/app/(app)/fees/payments/*` — record/view payments (`StudentPayment`)
- `src/app/(app)/fees/reminders/*` — reminder config + send (`FeeReminderConfig`)
- `src/lib/fees/gate.ts` — `feeGateExams` / `feeGateResults` (also used by §2/§14)

**Models:** `FeeItem` (per `termId`+`level`, `amount`), `StudentPayment` (`amount`, `method`, `recordedBy`), `FeeStatus` (legacy per-student×term `cleared`/`not_cleared`/`partial` — now superseded by the derived status in `bursary.ts`), `FeeReminderConfig` (`weeklyEnabled`, `dayOfWeek`, `lastSentAt`).

**Flow:**
1. School sets `FeeItem`s per term and class level; expected fee = sum of items for the student's level.
2. Bursar records `StudentPayment`s; `getStudentFeeSummary` derives `status` from expected vs paid (balance/overpaid computed).
3. Fee status is **no longer hand-set** — it is fetched/derived from payments. The parent dashboard's fee-status quick link and `/fee-status` render this derived status.
4. `FeeReminderConfig` drives weekly automated reminders; `/fees/reminders` configures the day and enables/disables them.

> Gotcha: fee status visibility and exam/result gating still run through `src/lib/fees/gate.ts` (`feeGateExams`/`feeGateResults` on `School`). The derived status in `bursary.ts` is the single source of truth for `cleared`/`partial`/`not_paid`.

## 18. Mobile App & Push Notifications

**Purpose:** A native Android app (built with Capacitor) plus a **free, unlimited, instant** push-notification channel (Firebase Cloud Messaging) that delivers events straight to parents', students' and staff's devices — eliminating the per-message cost of SMS and WhatsApp.

**Mobile app (Capacitor):**
- `mobile-app/` — the Android APK project (`capacitor.config.ts`, `android/`, `app.config.ts`). The web portal runs inside a WebView; `allowNavigation` whitelists the portal hosts so redirects stay in-app.
- `src/components/CapacitorBridge.tsx` — client bridge: detects the native platform, requests notification permission, and registers the device's FCM token.
- The `PushNotifications` plugin is configured in `capacitor.config.ts` (custom Android channel/sound `marksheet_notifications`).

**Push (FCM — zero per-message cost):**
- `src/lib/notifications/push.ts` — FCM HTTP v1 sender, zero-dependency (mints an RS256 JWT bearer token). Reads `FCM_PROJECT_ID` / `FCM_CLIENT_EMAIL` / `FCM_PRIVATE_KEY` from env; when unset it is a silent no-op.
- `PushDevice` model (`push_devices`) — `{ userId, fcmToken (unique), schoolId?, platform }`. One fan-out hits every device for a recipient; dead/expired tokens are auto-pruned.
- Endpoints: `api/push/register`, `api/push/unregister`, `api/push/diagnose`.
- `deliverPushForNotification(...)` fans a notification out to all of a recipient's devices and never throws (delivery failures are logged). In-app centre: `my-notifications`, `notification-bell.tsx`.

**Paid channels (legacy — being replaced):**
- `NotificationProviderConfig` (`notification_provider_configs`) — `whatsapp` / `sms` via Twilio / Africa's Talking / custom. `NotificationTemplate` + `NotificationQueue` + `NotificationLog` route these costly per-message sends.
- Because push is free and instant, schools can default to push and avoid SMS/WhatsApp spend entirely; the paid providers remain available as a fallback.

> Gotcha: push only reaches devices that have registered an `fcmToken` (installed the app / PWA and granted permission). Confirm the `FCM_*` env vars are set on the server, and that `allowNavigation` in `capacitor.config.ts` lists the deployed portal host.
