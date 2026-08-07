# 04 — Data Model

## 1. Overview

- **Database**: PostgreSQL.
- **ORM**: Prisma 6, `prisma-client-js`, table names from `model` names (some re-mapped via `@@map`).
- **IDs**: `String @id @default(cuid())` throughout.
- **Models**: 90.
- **Enums**: 17.
- Source of truth: `prisma/schema.prisma` (≈2,000 lines).
- **Migrations**: 16, from `20260705181801_init` to `20260805100000_add_landing_stats`.

## 2. Cross-cutting schema patterns

### 2.1 Multi-tenancy
Almost every domain model carries `schoolId String` with `@relation(... onDelete: Cascade)`. Deleting a school removes all its data. Platform roles have `schoolId = null`.

### 2.2 JSON columns
Used for flexible, non-queryable data to avoid schema migrations:

- `School.gradingScale` — ordered grade bands (e.g. `A1`–`F9`)
- `School.letterheadSettings`
- `Student.bioData`, `Staff.bioData` — blood group, genotype, etc.
- `Exam.subAssessmentWeights`
- `SubjectResult.assessmentScores`
- `TermResult.attendanceSummary`, `affectiveRatings`
- `AiProviderConfig`, `NotificationProviderConfig` credentials
- `SchoolTimetableRule.parameters`

### 2.3 String-typed statuses
Some statuses are strings with documented conventions rather than enums:

- `AttendanceRecord.status`: `present` / `absent` / `late` / `excused`
- `TermResult.status`: `computed` / `finalised` / `withheld`
- `Payment.status`, `FeeStatus.status`, `Notification.deliveryStatus`
- `Staff.accountStatus`: `active` / `suspended`

### 2.4 Soft delete / archiving
Some entities use flags instead of deletes — `Class.archived`, `User.isActive`, `Addon.active`, `School.suspended`, `School.maintenanceMode`.

## 3. Complete model index

Grouped by domain. "−" indicates optional relation.

### School, Session & Term Management
| Model | Table | Purpose |
|---|---|---|
| `School` | `schools` | Tenant root; config (grading scale, admission format, fee gating, stage/license) |
| `Session` | `sessions` | Academic year; unique `[schoolId, label]` |
| `Term` | `terms` | First/Second/Third; unique `[sessionId, name]` |
| `Class` | `classes` | `level`+`section`+`department`; unique `[sessionId, level, section, department]` |
| `PromotionRecord` | `promotion_records` | Snapshot of promoted/withdrawn students |

### 3.2 Staff & Assignments
| Model | Table | Purpose |
|---|---|---|
| `Staff` | `staff` | School employee; unique `[schoolId, email]`; optional linked `User` |
| `Assignment` | `assignments` | Versioned staff→role mapping for a session/term; the basis of permissions |

### 3.3 Students & Guardians
| Model | Table | Purpose |
|---|---|---|
| `Student` | `students` | Core student; unique `[schoolId, admissionNumber]`; optional linked `User` (`userId` unique) |
| `Guardian` | `guardians` | Parent/guardian attached to a student; phone required for WhatsApp |

### 3.4 Auth
| Model | Table | Purpose |
|---|---|---|
| `User` | `users` | Platform-wide login identity; `role UserRole`; school/admin/proprietor/referral links |

### 3.5 Audit & Consent
| Model | Table | Purpose |
|---|---|---|
| `AuditLog` | `audit_logs` | Immutable trail with before/after JSON |
| `ConsentRecord` | `consent_records` | NDPR consent per student/guardian |

### 3.6 AI
| Model | Table | Purpose |
|---|---|---|
| `AiProviderConfig` | `ai_provider_configs` | Provider endpoint, encrypted key, model, priority, active |
| `AiTaskProfile` | `ai_task_profiles` | Per-task model/temperature/tokens/prompt |
| `AiCallLog` | `ai_call_logs` | Telemetry per AI call (tokens, latency, status) |

### 3.7 Syllabus & Lesson Notes
| Model | Table | Purpose |
|---|---|---|
| `Syllabus` | `syllabi` | Uploaded syllabus doc + parsed topic JSON |
| `CurriculumTopic` | `curriculum_topics` | NERDC reference topics (system) + school overrides |
| `NerdcContent` | `nerdc_content` | Raw NERDC markdown |
| `LessonNote` | `lesson_notes` | Structured lesson note (manual or AI) |

### 3.8 Question Bank
| Model | Table | Purpose |
|---|---|---|
| `Stimulus` | `stimuli` | Reusable passage/image/table/audio |
| `QuestionGroup` | `question_groups` | Groups questions under a stimulus; shuffleable |
| `Question` | `questions` | MCQ or essay; draft→approved workflow |
| `McqOption` | `mcq_options` | MCQ choices with `isCorrect` |
| `EssayGradingSpec` | `essay_grading_specs` | Model answer, rubric, optional AI prompt |

### 3.9 Exam Delivery
| Model | Table | Purpose |
|---|---|---|
| `Exam` | `exams` | Review-workflow exam (created→submitted→approved/rejected), shuffling, resits |
| `ExamClass` | `exam_classes` | M2M exam→classes |
| `ExamQuestion` | `exam_questions` | M2M exam→question (paper composition) |
| `ExamAttempt` | `exam_attempts` | Student attempt; offline sync status; timer |
| `StudentAnswer` | `student_answers` | Per-question answer; AI-suggested + final score |

### 3.10 Results & Grading
| Model | Table | Purpose |
|---|---|---|
| `AssessmentType` | `assessment_types` | e.g. `CA1`, `Exam`; self-referencing sub-assessments |
| `AssessmentWeighting` | `assessment_weightings` | Weight % per subject×assessment; must sum to 100 |
| `ManualScore` | `manual_scores` | Teacher-entered scores / AI-score overrides |
| `SubjectResult` | `subject_results` | Per student×subject×term aggregate; unique triple `[studentId, subjectId, termId]` |
| `TermResult` | `term_results` | Per student×term overall; unique `[studentId, termId]` |
| `RemarkTemplate` | `remark_templates` | Teacher/principal comment templates |
| `ReportCardTemplate` | `report_card_templates` | Layout/branding of report cards |
| `VerificationCode` | `verification_codes` | Codes to verify a `TermResult` publicly |

### 3.11 Timetable (core + Generator addon)
| Model | Table | Purpose |
|---|---|---|
| `TimetablePeriod` | `timetable_periods` | School-defined period slots |
| `TimetableEntry` | `timetable_entries` | Manual scheduled class/subject/staff/period/room |
| `SubjectTimetableRequirement` | `subject_timetable_requirements` | Weekly period requirements per subject/class |
| `StaffAvailability` | `staff_availability` | Per-day availability + caps |
| `TimetableTemplate` | `timetable_templates` | Reusable days×periods template |
| `SchoolDay` | `school_days` | A teaching day in a template |
| `AddonPeriod` | `addon_periods` | A period in a template |
| `SchoolTimetableRule` | `school_timetable_rules` | Hard/soft constraints |
| `RoomType` | `room_types` | Room category (Science Lab, etc.) |
| `Room` | `rooms` | Physical room, capacity |
| `AddonTimetable` | `addon_timetables` | Generated timetable instance |
| `AddonTimetableEntry` | `addon_timetable_entries` | A generated slot (lockable) |
| `TimetableGenerationRun` | `timetable_generation_runs` | Run log: score, violations, iterations |
| `TimetableWizard` | `timetable_wizards` | Persisted multi-step wizard state |

### 3.12 Fees
| Model | Table | Purpose |
|---|---|---|
| `FeeStatus` | `fee_statuses` | Per student×term clearance (`cleared`/`not_cleared`/`partial`); gates exams/results |

### 3.13 Attendance (addon)
| Model | Table | Purpose |
|---|---|---|
| `AttendanceRecord` | `attendance_records` | Per-date/period student attendance (QR or manual) |
| `StaffAttendanceRecord` | `staff_attendance_records` | Staff attendance |
| `IDCardTemplate` | `id_card_templates` | QR ID card layout |

### 3.14 Notifications
| Model | Table | Purpose |
|---|---|---|
| `Notification` | `notifications` | In-app/sms/email records |
| `Announcement` | `announcements` | School announcements; target roles; sticky |
| `NotificationProviderConfig` | `notification_provider_configs` | WhatsApp/SMS provider credentials |
| `NotificationTemplate` | `notification_templates` | Message bodies with `{{vars}}` per event+channel |
| `NotificationQueue` | `notification_queue` | Outbound queue with random delays |
| `NotificationLog` | `notification_logs` | Delivery log (sent/failed) |
| `SchoolNotificationConfig` | `school_notification_configs` | Per-school toggles + enabled events |

### 3.15 Licensing, Payments, Addons
| Model | Table | Purpose |
|---|---|---|
| `LicensePlan` | `license_plans` | Billing plan (monthly/termly) with stage pricing |
| `SchoolLicense` | `school_licenses` | License assignment + status lifecycle |
| `PaymentMethod` | `payment_methods` | Configured channels (bank transfer/cash/online) |
| `CashCode` | `cash_codes` | One-time cash redemption codes |
| `Addon` | `addons` | Addon catalogue (Timetable, Period Tracker, Attendance, Notifications, Multi-Branch) |
| `AddonCode` | `addon_codes` | Activation codes |
| `SchoolAddon` | `school_addons` | Activated addon on a school |
| `Payment` | `payments` | Plan purchases + verification workflow |

### 3.16 Support Tickets
| Model | Table | Purpose |
|---|---|---|
| `Ticket` | `tickets` | Ticket with status/priority/category |
| `TicketMessage` | `ticket_messages` | Messages within a ticket |

### 3.17 Period Tracker (addon)
| Model | Table | Purpose |
|---|---|---|
| `TaughtTopic` | `taught_topics` | Topic marked taught + class-captain verification |

### 3.18 Multi-Branch / Group of Schools
| Model | Table | Purpose |
|---|---|---|
| `SchoolGroup` | `school_groups` | Group of branches under a proprietor |
| `GroupMembership` | `group_memberships` | School→group (a school belongs to ≤1 group) |
| `GroupAddonSubscription` | `group_addon_subscriptions` | Group-level addon subs |
| `GroupStudentTransferRecord` | `group_student_transfer_records` | Cross-branch transfer audit |

### 3.19 Referral Program
| Model | Table | Purpose |
|---|---|---|
| `Referral` | `referrals` | Agent profile, commission bank, unique code |
| `SchoolRegistration` | `school_registrations` | School signup flow + payment + review |
| `ReferralCommissionSetting` | `referral_commission_settings` | Global registration fee + commission % |
| `ReferralCommission` | `referral_commissions` | Commission per referred school (`pending`/`paid`/`rejected`) |

### 3.20 Messaging
| Model | Table | Purpose |
|---|---|---|
| `Conversation` | `conversations` | Thread within a school |
| `ConversationParticipant` | `conversation_participants` | Participant + last-read tracking |
| `Message` | `messages` | A message in a conversation |

### 3.21 Marketing Homepage
| Model | Table | Purpose |
|---|---|---|
| `DemoRequest` | `demo_requests` | Lead-capture form submissions |
| `HomepageContentBlock` | `homepage_content_blocks` | CMS-lite content blocks |
| `LandingStat` | `landing_stats` | Landing hero stats (auto/manual) |

## 4. Core model field/relation detail

### 4.1 School — the tenant root
Key fields: `id`, `name`, `address`, `logo`, `signature`, `stamp`, `phone`, `email`, `motto`, `letterheadSettings Json`, `gradingScale Json`, `admissionFormat` (e.g. `SCH/{year}/{seq:4}`), `shortcode` (unique), `studentSequence`, `maintenanceMode`, `suspended`, `feeGateExams`, `feeGateResults`, `attendancePeriodEnabled`, `attendanceLateCutoff`, `stage`, `referralId?`.
Relations: ~35 back-relations — sessions, subjects, staff, students, users, audit logs, syllabi, lessonNotes, questions, exams, assessment types/weightings, remark templates, reportCardTemplates, timetable*, classSubjects, announcements, licenses, payments, tickets, consent, addons, taughtTopics, attendance, notifications, group membership, referral, commissions, transfers.

### 4.2 `User` — the login identity
`id`, `schoolId?` (null for platform roles), `email` (unique), `passwordHash`, `role`, `staffId?` (unique), `isActive`, `mustChangePassword`, `proprietorGroupId?`, `proprietorPermissionLevel?` (`full`/`view_only`), `referralId?`, timestamps.
Relations: `school`, `staff` (via `staffId`), `student` (via `Student.userId`), `proprietorGroup`, `referral`, `verifiedPayments`, `createdTickets`/`assignedTickets`, `ticketMessages`.

### 4.3 `Assignment` — permissions source
`staffId`, `schoolId`, `assignmentType`, `subjectId?`, `classId?`, `sessionId?`, `termId?` (null = whole session), `isTemporary`, `startDate?`, `endDate?`, `createdBy`.
Effective permissions = union of active assignments (see [03-authentication.md](./03-authentication.md)).

### 4.4 `Exam` — lifecycle
`subjectId`, `classId?` (legacy; use `ExamClass`), `termId`, `assessmentTypeId`, `durationMinutes`, `shuffleEnabled`, `status` (`draft`/`pending_review`/`approved`/`rejected`/`published`), `attemptType` (`original`/`resit`), `originalExamId?`, review fields (`createdBy`, `submittedForReviewAt`, `reviewedBy`, `reviewedAt`, `reviewComment`), `subAssessmentWeights Json`.
Relations: `examQuestions`, `attempts`, `classes` (via `ExamClass`), `manualScores`.

### 4.5 `SubjectResult` / `TermResult`
- `SubjectResult`: unique `[studentId, subjectId, termId]`; `assessmentScores Json`, `totalScore`, `grade`, `position`.
- `TermResult`: unique `[studentId, termId]`; `overallAverage`, `overallPosition`, `attendanceSummary Json`, `effectiveRatings Json`, `teacherComment`, `principalComment`, `cumulativeAverage`, `status` (`computed`/`finalised`/`withheld`), `finalizedAt`; links `verificationCodes`.

### 4.6 `Student`
`admissionNumber` (unique per school), bio fields, `currentClassId?`, `department`, `status`, `userId?` (unique), `bioData Json`, `isClassCaptain`, `isViceClassCaptain`. Relations: guardians, results, attempts, scores, consent, attendance, transfers.

## 5. Entity-relationship highlights

```
School 1──N Session 1──N Term 1──N Class
                │
                ├─────────────── Exam 1──N ExamClass
                ├─────────────── ExamAttempt 1──N StudentAnswer
School 1──N Subject 1──N Question 1──N McqOption
                ├──N AssessmentWeighting
Student 1──N SubjectResult 1── TermResult 1── VerificationCode
Student N──1 Class
Staff 1──N Assignment (→ role permission)
Student 1──N Guardian (← ParentAccount login)
Attribute "schoolId" key on most models for tenancy
```

## 6. Enums (all 17)

| Enum | Values |
|---|---|
| `SessionStatus` | `upcoming`, `active`, `closed` |
| `TermName` | `First`, `Second`, `Third` |
| `AssignmentType` | `subject_teacher`, `class_teacher`, `hod`, `exam_officer`, `school_admin`, `fee_status_manager`, `receptionist` |
| `StudentStatus` | `active`, `withdrawn`, `graduated` |
| `UserRole` | `super_admin`, `platform_owner`, `proprietor`, `staff`, `student`, `parent`, `referral` |
| `QuestionType` | `mcq`, `essay` |
| `QuestionStatus` | `draft`, `pending_review`, `approved`, `archived` |
| `ExamAttemptType` | `original`, `resit` |
| `ExamStatus` | `draft`, `pending_review`, `approved`, `rejected`, `published` |
| `AttemptStatus` | `in_progress`, `submitted`, `absent`, `pending_resit` |
| `SyncStatus` | `local_only`, `queued`, `synced` |
| `LicenseDurationType` | `monthly`, `termly` |
| `LicenseStageName` | `basic`, `standard`, `premium` |
| `LicenseStatus` | `active`, `grace_period`, `expired`, `suspended` |
| `PaymentMethodType` | `bank_transfer`, `cash`, `online` |
| `TicketStatus` | `open`, `in_progress`, `resolved`, `closed` |
| `TicketPriority` | `low`, `medium`, `high`, `urgent` |

## 7. Seed data

`prisma/seed.ts` (idempotent, upsert-based) creates:
- Super admin + demo school + school admin + teacher + 2 students + guardians
- 1 session with 3 terms, 6 classes, subjects, ClassSubject links
- Addons + staged pricing + demo school at `basic` stage
- Timetable generator demo data (template, periods, requirements, staff availability, rules, rooms)
- NERDC curriculum (system topics, JSS1: English, Maths, PHE)

`prisma/nerdc-seed.ts` provides the actual NERDC curriculum topics.

## 8. Changing the schema

See [05-migrations.md](./05-migrations.md). Do **not** run `prisma migrate dev`.