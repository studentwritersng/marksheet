/**
 * Source of truth for the public Features pages.
 * Mirrors docs/09-feature-modules.md (§1-§18).
 * Each entry powers: /features (card) and /features/[slug] (deep dive).
 */

export interface FeatureDefinition {
  slug: string;
  title: string;
  shortTitle: string; // for chips / nav
  excerpt: string;
  image: string; // public path
  imageAlt: string;
  category: string;
  module: string; // e.g. "§1 Exams"
}

export const FEATURES: FeatureDefinition[] = [
  {
    slug: "exams",
    title: "Exams — From Question Bank to Graded Scripts",
    shortTitle: "Exams",
    excerpt: "Build papers from a shared bank, deliver online or completely offline on the school LAN, grade MCQs instantly and get rubric-grounded AI help for essays — then feed clean scores straight into results.",
    image: "/marketing/classroom.jpg",
    imageAlt: "Students writing an exam in a Nigerian secondary school hall",
    category: "Assessment",
    module: "§1 Exams",
  },
  {
    slug: "results-grading-report-cards",
    title: "Results, Grading & Report Cards",
    shortTitle: "Results & Reports",
    excerpt: "Weight CA1, CA2 and exams into subject totals, rank within class, roll up term averages and print broadsheets and report cards that carry a verification code any employer can check in seconds.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "Parent and student checking a published result on a phone",
    category: "Assessment",
    module: "§2 Results & Report Cards",
  },
  {
    slug: "curriculum-syllabus",
    title: "Curriculum & Syllabus — The Official Scheme, Made Visible",
    shortTitle: "Curriculum & Syllabus",
    excerpt: "The NERDC scheme is no longer a PDF on someone's phone. Upload syllabi once, see every topic by class and week, and track what was actually taught — with the same topic names the exam will use.",
    image: "/marketing/teacher-laptop.jpg",
    imageAlt: "Teacher reviewing curriculum coverage on a laptop beside a mark register",
    category: "Teaching",
    module: "§3 Curriculum & Syllabus",
  },
  {
    slug: "lesson-notes",
    title: "Lesson Notes — Consistent, Reviewable, AI-Assisted",
    shortTitle: "Lesson Notes",
    excerpt: "One template, one review flow, every note linked to its syllabus topic. Write by hand or draft with AI that follows the class-level guidance — then let the HOD approve and the next teacher inherit.",
    image: "/marketing/teacher-laptop.jpg",
    imageAlt: "Lesson note approval flow on a teacher dashboard",
    category: "Teaching",
    module: "§3b Lesson Notes",
  },
  {
    slug: "timetable",
    title: "Timetable — Manual or Auto-Generated",
    shortTitle: "Timetable",
    excerpt: "Lay out periods by hand, or let the solver build a collision-free timetable from staff availability, subject load, rooms and department rules. Lock what you like, regenerate the rest.",
    image: "/marketing/teacher-laptop.jpg",
    imageAlt: "Timetable grid displayed on a laptop in a staff room",
    category: "Operations",
    module: "§4 Timetable",
  },
  {
    slug: "attendance",
    title: "Attendance — Daily or Per-Period, QR-Ready",
    shortTitle: "Attendance",
    excerpt: "Mark attendance on a register or scan QR ID cards. Toggle daily vs per-period mode, print cards from a template, and flow totals straight into the term report.",
    image: "/marketing/principal.jpg",
    imageAlt: "School corridor with students — attendance moment",
    category: "Operations",
    module: "§5 Attendance",
  },
  {
    slug: "period-tracker",
    title: "Period Tracker — Who Really Taught What",
    shortTitle: "Period Tracker",
    excerpt: "Teachers tick off every CurriculumTopic they teach; the class captain verifies it. Two-way accountability replaces the ‘we covered it’ that nobody can prove at week 12.",
    image: "/marketing/teacher-laptop.jpg",
    imageAlt: "Class captain confirming topics covered on a tablet",
    category: "Teaching",
    module: "§6 Period Tracker",
  },
  {
    slug: "question-bank",
    title: "Question Bank — The Shared Paper Factory",
    shortTitle: "Question Bank",
    excerpt: "One stimulus, many questions. MCQs and essays with model answers and rubrics, a clear draft → approved → archived workflow and a CSV import that validates before it touches live records.",
    image: "/marketing/classroom.jpg",
    imageAlt: "Exam question paper being reviewed by teachers",
    category: "Assessment",
    module: "§7 Question Bank",
  },
  {
    slug: "students-staff-parents-promotion",
    title: "Students, Staff, Parents & Promotion",
    shortTitle: "People & Promotion",
    excerpt: "Admission numbers that generate themselves, staff assignments that know who can do what, parent logins linked to guardians, and a promotion engine that moves whole classes without breaking history.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "School admin confirming student promotion list",
    category: "Administration",
    module: "§8 People & Promotion",
  },
  {
    slug: "class-subjects",
    title: "Class-Subjects & Department Assignment",
    shortTitle: "Class-Subjects",
    excerpt: "Link each subject to the classes that actually offer it — with science / art / commercial departments — so results, broadsheets and timetables all filter to the right students automatically.",
    image: "/marketing/classroom.jpg",
    imageAlt: "Subject assignment chart on a notice board",
    category: "Administration",
    module: "§9 Class-Subjects",
  },
  {
    slug: "messaging",
    title: "Messaging — Private Conversations at Scale",
    shortTitle: "Messaging",
    excerpt: "Staff, students and parents talk in scoped 1:1 conversations. Admins and HODs can also bulk-message ‘all teachers’, ‘all JSS2 parents’ or ‘parents by fee status’ — each as a private thread, with template variables like {{student_name}} and {{class}}.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "Admin composing a bulk message to parents on a laptop",
    category: "Communication",
    module: "§10 Messaging",
  },
  {
    slug: "support-tickets",
    title: "Support Tickets — Help That Can Be Tracked",
    shortTitle: "Support Tickets",
    excerpt: "Every request gets a ticket, a priority and a thread. Schools talk to the platform team in the same place they manage everything else — nothing gets lost in WhatsApp.",
    image: "/marketing/principal.jpg",
    imageAlt: "Support team reviewing tickets on a dashboard",
    category: "Communication",
    module: "§11 Support Tickets",
  },
  {
    slug: "school-settings-announcements",
    title: "School Settings & Announcements",
    shortTitle: "Settings & Notices",
    excerpt: "Branding, letterhead, grading scales, fee-gating and role-targeted announcements — one place to make the school look like itself and say what needs saying, with a full audit trail behind it.",
    image: "/marketing/teacher-laptop.jpg",
    imageAlt: "School settings page showing branding and grading scale",
    category: "Administration",
    module: "§12 Settings & Announcements",
  },
  {
    slug: "landing-public-flows",
    title: "Landing Page & Public Flows",
    shortTitle: "Public Flows",
    excerpt: "The marketing site, live hero stats, sales-led registration, demo requests and the public /verify portal that makes every report card checkable — all wired to the same tenant data without leaking it.",
    image: "/marketing/classroom.jpg",
    imageAlt: "Public verification portal on a phone screen",
    category: "Public",
    module: "§13 Landing & Public Flows",
  },
  {
    slug: "fee-status",
    title: "Fee Status — Derived, Not Declared",
    shortTitle: "Fee Status",
    excerpt: "Cleared / partial / not_paid is computed from what the bursar actually recorded — fee items vs payments — and is the single gate for exam and result access, not a box someone ticks by hand.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "Fee status overview on bursary dashboard",
    category: "Finance",
    module: "§14 Fee Status",
  },
  {
    slug: "data-imports-exports",
    title: "Data Imports & Exports — CSV In, Truth Out",
    shortTitle: "Imports & Exports",
    excerpt: "Download a template, fill it, get a staging report with every error named. Only clean rows commit. And when you need a broadsheet or report card out, export it as CSV, DOC, PDF or XLSX in one click.",
    image: "/marketing/teacher-laptop.jpg",
    imageAlt: "Spreadsheet validation report before import",
    category: "Administration",
    module: "§15 Imports & Exports",
  },
  {
    slug: "homework",
    title: "Homework — The Take-Home Assignment Loop",
    shortTitle: "Homework",
    excerpt: "Teachers set MCQs and essays for a class, students take them at home, MCQs grade instantly, teachers mark essays once and parents see the published score for every ward without being asked.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "Student attempting homework on a tablet at home",
    category: "Teaching",
    module: "§16 Homework",
  },
  {
    slug: "bursary-fee-management",
    title: "Bursary & Fee Management — Structure, Payments, Reminders",
    shortTitle: "Bursary & Fees",
    excerpt: "Define fee items per term and class level, record payments by cash or transfer, let the system derive each student’s balance and auto-nudge guardians on schedule with an editable, variable-powered reminder.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "Bursar recording payments and sending reminders",
    category: "Finance",
    module: "§17 Bursary & Fees",
  },
  {
    slug: "mobile-app-push-notifications",
    title: "Mobile App & Push Notifications — Free, Instant, Unlimited",
    shortTitle: "Mobile & Push",
    excerpt: "The whole portal in an Android APK plus Firebase push that delivers result alerts and school notices to a parent’s lock screen — at zero per-message cost, replacing paid SMS/WhatsApp threads.",
    image: "/marketing/parent-student.jpg",
    imageAlt: "Parent receiving a push notification on a phone",
    category: "Communication",
    module: "§18 Mobile & Push",
  },
];

export function getFeature(slug: string): FeatureDefinition | undefined {
  if (slug === "curriculum-syllabus-lesson-notes") {
    return FEATURES.find((f) => f.slug === "curriculum-syllabus");
  }
  return FEATURES.find((f) => f.slug === slug);
}

export const FEATURE_SLUGS = FEATURES.map((f) => f.slug);
