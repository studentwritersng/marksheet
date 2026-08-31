/**
 * Deep-dive copy for /features/[slug].
 * Reverted to short placeholders — deep dives for 12,15,8,17,3,9 to be written in requested order.
 */

export interface FeatureDeepDive {
  challenge: string;
  solution: string;
  helps: string;
}

export const FEATURE_DEEP_DIVES: Record<string, FeatureDeepDive> = {
  exams: {
    challenge: `Ask any exam officer what week 10 feels like and you will get the same sigh. Three class arms, six subjects, 30 pages of questions that were typed in three different fonts, a printer that jams at 11 pm, and a sealing envelope that has to be carried to the hall by hand.`,
    solution: `Marksheet treats an exam as a proper lifecycle, not a file. You build the paper from the Question Bank and compose an Exam that links to AssessmentType, Term, Subject and Classes. It moves draft → pending_review → approved → published, with shuffle and offline hub sync.`,
    helps: `The paper that is printed is the paper that was approved. MCQs grade instantly, essays arrive with rubric-grounded AI suggestions, and the score that flows to results is the score that was graded — not a re-typed copy.`,
  },
  "results-grading-report-cards": {
    challenge: `Broadsheet week is three teachers sharing one laptop, hoping the SUM formula did not miss row 42. Weightings, grade boundaries and tie rules live in different heads and spreadsheets, and verification is a paper file in a filing room.`,
    solution: `Define AssessmentTypes and Weightings once, store gradingScale on School, enter only raw ManualScores and let computeClassResults compute weighted totals, grades, ranks and TermResult deterministically. Only finalised results get a VerificationCode.`,
    helps: `Five evenings become one screen. Parents see a rule applied the same way to every child, and every report card carries a short code any bank can verify without calling the school.`,
  },
  "curriculum-syllabus": {
    challenge: `The NERDC scheme lives as a PDF on the principal's phone and as differently retyped Word files per HOD. By week 3 no two classes track the same topic name, and by week 10 the exam asks what the syllabus says while the note says something else.`,
    solution: `NERDC topics live as CurriculumTopic and NerdcContent. Upload a syllabus once and it is parsed into SyllabusTopics per class/subject/week, so the same topic name appears in tracker, lesson notes and question bank. Coverage is marked as TaughtTopic and verified by class captain.`,
    helps: `At week 4 the tracker shows which class is behind before it becomes a poor score. A new teacher inherits a list, not a folder, and a supervisor sees NERDC-aligned coverage by week with who taught and who verified it.`,
  },
  "lesson-notes": {
    challenge: `Lesson notes are written in different templates, copied across levels with stale examples, and stored on laptops that leave with teachers. No version history, no consistent evaluation, and no link to the syllabus week they belong to.`,
    solution: `Every note links to Subject, Class, Term and SyllabusTopic, with a single template (objectives, materials, steps, evaluation). Write by hand or draft with AI grounded in class-level guidance — both save as draft until HOD approves and become published and inheritable.`,
    helps: `Teachers improve notes instead of retyping them. HODs moderate a queue of same-template drafts. Notes stay in the portal — linked to week and topic — so the next teacher starts teaching, not searching.`,
  },
  timetable: {
    challenge: `Timetabling disappoints everyone a little. Lab, availability, department and back-to-back rules collide, and the board version is patched by week 2 because two teachers are in two rooms at once.`,
    solution: `Manual TimetableEntry grid plus an optional generator (Addon) that solves from TimetableTemplate, SubjectTimetableRequirements, StaffAvailability, Rooms and SchoolTimetableRules via solver.ts, with lockable AddonTimetableEntries.`,
    helps: `A small school keeps the manual grid; a larger one generates a conflict-free draft and refines preference instead of fixing collisions. Changes regenerate with locks for already-planned periods.`,
  },
  attendance: {
    challenge: `A register marked in five books must become one percentage by Friday, with spelling variants and unclear denominators, while QR cards without a template just lengthen the gate queue.`,
    solution: `Daily or per-period AttendanceRecord keyed to Student/Class/date, with late flag via attendanceLateCutoff. Hand-mark or scan QR cards from IDCardTemplate; spreadsheet view bulk-marks and exports correctly spelled names.`,
    helps: `Gate scan replaces copying. The report card percentage matches the gate, because both read the same denominator for every class.`,
  },
  "period-tracker": {
    challenge: `“We covered the syllabus” ends as a debate, not a query, because the only evidence is a note written after the fact.`,
    solution: `TaughtTopic marked by teacher then verified by class captain. The tracker grid shows topic × teacher × captain, scoped so teachers only mark their subjects and captains only verify their class.`,
    helps: `Week 6 shows four unverified topics in JSS2B vs none in JSS2A while there is still a term to catch up. Diligent teachers are protected; students see what is coming.`,
  },
  "question-bank": {
    challenge: `Last year's good paper is this year's bad Word file — misaligned options, answer key on another page, no moderation note, and no provenance for which lesson note a hard question came from.`,
    solution: `Stimulus → QuestionGroup → Question with McqOptions/EssayGradingSpec, draft→pending_review→approved→archived, CSV staging via question-import.ts that lists every row error before commit.`,
    helps: `Moderation becomes a queue of approved questions. Two arms get same-outcome, different-item papers with proven grounding, and a new teacher inherits a searchable bank, not a folder called “final FINAL.”`,
  },
  "students-staff-parents-promotion": {
    challenge: `One child appears as three spellings because admission numbers were typed by hand; one teacher needs three roles a flat dropdown cannot express; parents are columns, not a table; promotion rewrites history by re-typing names.`,
    solution: `Student with generated admissionNumber from School.admissionFormat, Staff + scoped Assignment (subject_teacher/class_teacher/hod/exam_officer/bursar), Guardian table linked to parent User, PromotionRecord and GroupStudentTransferRecord for history.`,
    helps: `Intake pastes a CSV, sees row-level errors and commits clean. Staff see exactly their inboxes/classes/marks. Parents see three ward cards with correct classes. Promotion keeps a snapshot so JSS1A→JSS2A history remains queryable.`,
  },
  "class-subjects": {
    challenge: `JSS1 offers Basic Science to every child while SSS2 Science vs Art offer different subjects, but results and timetables have nowhere that says which class offers what — so broadsheets include strays and periods are scheduled for subjects never offered.`,
    solution: `ClassSubject per class×subject with department (general/science/art/commercial), managed in class-subjects/actions.ts. computeClassResults and the timetable solver both read it, so a stray was never assigned.`,
    helps: `Broadsheets stop including strays; a new department is added per class without retyping history; teachers see only the classes/subjects they actually teach.`,
  },
  messaging: {
    challenge: `Broadcasts reach everyone and no one, with no thread to point at when a parent says “nobody told us.”`,
    solution: `Conversation → ConversationParticipant → Message, with /messages/compose audience picker (teachers/students/parents/by fee), live countAudience, bulkSendAction in batches of 20, and {{variable}} rendering per recipient (student_name, class, guardian_name, date etc.).`,
    helps: `64 parents get 64 private threads each addressed by name, not a broadcast 300 reply-all to. “Nobody told us” becomes an open thread with a read marker.`,
  },
  "support-tickets": {
    challenge: `Every request as a voice note means nothing has priority and nothing has a thread.`,
    solution: `Ticket with status/priority/category, creator/assignee and TicketMessages, per school in /tickets and globally in /console/tickets, scoped by tenant.`,
    helps: `History stays. Leadership can measure tickets per week and category instead of asking around a group.`,
  },
  "school-settings-announcements": {
    challenge: `To be written — 12 Settings & Announcements deep dive (requested first in order). The school knows what it wants to be called, what an A means and when parents should hear, until those live in five different places and a notice for parents is sent to “all.”`,
    solution: `To be written — will cover /settings/school (logo/signature/stamp, gradingScale JSON, feeGateExams/Results, letterheadSettings) and Announcement targeting (role, sticky, publish/expiry) with audit.ts, in conversational depth.`,
    helps: `To be written — how a principal changes signature/boundary once, how announcements become trusted, and how audit answers “who changed this?” — in order 12.`,
  },
  "landing-public-flows": {
    challenge: `A landing page that makes big promises and a portal that must keep them often behave like two products, with stats that cannot be verified and a checker that is not linked to the real result.`,
    solution: `Root page.tsx routes by host/auth, landing_stats with auto/manual modes via resolveLandingStats, sales-led /register without checkout, honeypot demo, and public /verify that only finalised VerificationCodes answer.`,
    helps: `Prospects see a tour ending in a conversation, not a cart; parents verify a code on the spot before leaving the compound.`,
  },
  "fee-status": {
    challenge: `Cleared vs not_cleared as a ticked box, not a number, makes every exam entry and result release a negotiation.`,
    solution: `FeeItem per level + StudentPayment per term → getStudentFeeSummary derives cleared/partial/not_paid and balance/overpaid; gate.ts enforces feeGateExams/Results uniformly.`,
    helps: `Recording a payment once updates every gate and badge. A parent sees balance, not a checkbox, and the same number that blocked the result is the number they were reminded of.`,
  },
  "data-imports-exports": {
    challenge: `To be written — 15 Imports & Exports deep dive (requested second). Every session starts with re-typing names and questions, and exports are screenshots that cannot be filtered.`,
    solution: `To be written — will cover CSV templates, staging reports (Row 14: class not found), commit boundary, and exporters csv/doc/pdf/xlsx over papaparse/xlsx/jspdf/html2canvas.`,
    helps: `To be written — how intake pastes once before lunch and how broadsheets export already filtered — in order 15.`,
  },
  homework: {
    challenge: `Photocopied homework, taken by some, marked when time allows, scored in a notebook parents never see, and re-set from memory with a new mistake in option C.`,
    solution: `Homework draft→published, HomeworkQuestions from bank or ad-hoc, student attempt in /student/homework with instant MCQ grading and teacher essay marking in /homework/[id]/mark, then published to parent ward pages.`,
    helps: `Teachers reuse bank questions; students take the same paper without being in school; parents see status and score per ward without asking.`,
  },
  "bursary-fee-management": {
    challenge: `To be written — 17 Bursary deep dive (requested fourth). What is JSS2 fee this term, was the transfer recorded, who still owes and by how much — the 9 am list is wrong by 10 am and broadcasts use one figure for 300 different balances.`,
    solution: `To be written — will cover FeeItems per level, StudentPayments, derived status, and /fees/reminders with variable template and weekly cron — in order 17.`,
    helps: `To be written — how one payment updates every screen and how a father of two gets two lines with total — in order 17.`,
  },
  "mobile-app-push-notifications": {
    challenge: `SMS/WhatsApp per-message cost, muted groups and failed queues, plus a portal that cannot link the notification to the parent's existing conversation.`,
    solution: `Capacitor APK with allowNavigation, CapacitorBridge registering PushDevice FCM tokens, deliverPushForNotification fan-out, and FCM HTTP v1 JWT in push.ts — with paid SMS/WhatsApp as fallback.`,
    helps: `Lock screen says the result is out and the tap opens the portal with the verification code, at zero per-message cost as enrolment grows.`,
  },
};
// Keep alias for old combined slug
export const FEATURE_DEEP_DIVES_ALIAS: Record<string, string> = {
  "curriculum-syllabus-lesson-notes": "curriculum-syllabus",
};
export function getFeatureDeepDive(slug: string): FeatureDeepDive | undefined {
  if (slug === "curriculum-syllabus-lesson-notes") return FEATURE_DEEP_DIVES["curriculum-syllabus"];
  return FEATURE_DEEP_DIVES[slug];
}
