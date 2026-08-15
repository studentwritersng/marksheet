import type { EffectivePermissions } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";

export interface NavItem {
  label: string;
  href?: string;     // parent items may omit href
  icon: string;
  children?: NavItem[];
}

export function buildNav(
  user: SessionPayload,
  perms: EffectivePermissions,
  isStudentCaptain?: boolean,
): NavItem[] {
  const items: NavItem[] = [{ label: "Dashboard", href: "/dashboard", icon: "overview" }];

  if (user.role === "super_admin" || user.role === "platform_owner") {
    items.push(
      { label: "Schools", href: "/schools", icon: "domain" },
      { label: "Audit Log", href: "/audit-log", icon: "history" },
    );
    return items;
  }

  const admin = perms.isSuperAdmin || perms.isSchoolAdmin;

  if (admin) {
    items.push(
      { label: "Academic", icon: "school", children: [
        { label: "Sessions & Terms", href: "/sessions", icon: "calendar_today" },
        { label: "Classes", href: "/classes", icon: "school" },
        { label: "Subjects", href: "/subjects", icon: "book" },
        { label: "Class–Subject Links", href: "/class-subjects", icon: "link" },
        { label: "Curriculum", href: "/curriculum", icon: "menu_book" },
        { label: "Syllabi", href: "/syllabus", icon: "import_contacts" },
        { label: "Timetable", href: "/timetable", icon: "calendar_view_week" },
      ]},
      { label: "People", icon: "group", children: [
        { label: "Staff", href: "/staff", icon: "badge" },
        { label: "Students", href: "/students", icon: "group" },
        { label: "Parents", href: "/parents", icon: "family_history" },
      ]},
      { label: "Teaching Resources", icon: "menu_book", children: [
        { label: "Period Tracker", href: "/period-tracker", icon: "checklist" },
        { label: "Curriculum Tracker", href: "/curriculum-tracker", icon: "checklist" },
        { label: "Lesson Notes", icon: "note", children: [
          { label: "Generate", href: "/lesson-notes", icon: "note_add" },
          { label: "My Lesson Notes", href: "/lesson-notes/mine", icon: "note" },
        ]},
        { label: "Question Bank", href: "/questions", icon: "quiz" },
      ]},
      { label: "Assessments", icon: "quiz", children: [
        { label: "Assessment Weights", href: "/assessment-weightings", icon: "tune" },
        { label: "Exams", href: "/exams", icon: "quiz" },
        { label: "Essay Grading", href: "/essay-grading", icon: "rate_review" },
      ]},
      { label: "Attendance & Notifications", icon: "notifications", children: [
        { label: "Daily Attendance", href: "/attendance", icon: "fact_check" },
        { label: "Attendance Spreadsheet", href: "/attendance/spreadsheet", icon: "grid_view" },
        { label: "Notifications", href: "/notifications", icon: "notifications" },
      ]},
      { label: "Results", icon: "analytics", children: [
        { label: "Result", href: "/results", icon: "analytics" },
        { label: "Psychomotor", href: "/results/psychomotor", icon: "psychology" },
        { label: "Attendance", href: "/results/attendance", icon: "fact_check" },
        { label: "Remarks", href: "/results/remarks", icon: "rate_review" },
        { label: "Broadsheet", href: "/broadsheet", icon: "table_chart" },
        { label: "Report Card Settings", href: "/results/report-card-settings", icon: "tune" },
        { label: "Grading Scale", href: "/grading-scale", icon: "score" },
      ]},
      { label: "Billing", icon: "payments", children: [
        { label: "Billing & License", href: "/billing", icon: "account_balance_wallet" },
      ]},
      { label: "Fee Status", href: "/fee-status", icon: "account_balance_wallet" },
      { label: "System", icon: "settings", children: [
        { label: "Announcements", href: "/announcements", icon: "campaign" },
        { label: "Audit Log", href: "/audit-log", icon: "history" },
        { label: "Offline Hubs", href: "/offline-hubs", icon: "router" },
        { label: "Settings", href: "/settings/school", icon: "settings" },
      ]},
      { label: "Addons", href: "/addons", icon: "extension" },
      { label: "Support Tickets", href: "/tickets", icon: "support" },
      { label: "Messages", href: "/messages", icon: "chat" },
    );
  } else if (perms.isExamOfficer) {
    items.push(
      { label: "Exam Review", href: "/exams/review", icon: "rate_review" },
      { label: "All Exams", href: "/exams", icon: "quiz" },
    );
  } else if (user.role === "parent") {
    items.push(
      { label: "Messages", href: "/messages", icon: "chat" },
      { label: "My Wards", href: "/parent", icon: "family_history" },
      { label: "Curriculum Tracker", href: "/curriculum-tracker", icon: "checklist" },
      { label: "Notification Prefs", href: "/parent/settings", icon: "notifications" },
    );
  } else if (user.role === "student") {
    const studentItems: NavItem[] = [
      { label: "My Exams", href: "/my-exams", icon: "quiz" },
      { label: "My Results", href: "/my-results", icon: "analytics" },
      { label: "My Timetable", href: "/my-timetable", icon: "calendar_view_week" },
      { label: "Curriculum Tracker", href: "/curriculum-tracker", icon: "checklist" },
      { label: "Fee Status", href: "/fee-status", icon: "account_balance_wallet" },
    ];
    if (isStudentCaptain) {
      studentItems.push({ label: "Period Tracker", href: "/period-tracker", icon: "checklist" });
    }
    items.push(...studentItems);
  } else {
    // Generic staff (teachers, HODs, receptionists, etc.)
    if (
      perms.subjectTeacherClassIds.size > 0 ||
      perms.classTeacherClassIds.size > 0
    ) {
      items.push({ label: "My Classes", href: "/my-classes", icon: "school" });
    }
    if (perms.subjectTeacherSubjectIds.size > 0) {
      items.push({
        label: "Lesson Notes",
        icon: "note",
        children: [
          { label: "Generate", href: "/lesson-notes", icon: "note_add" },
          { label: "My Lesson Notes", href: "/lesson-notes/mine", icon: "note" },
        ],
      });
      items.push({ label: "Period Tracker", href: "/period-tracker", icon: "checklist" });
      items.push({ label: "Curriculum Tracker", href: "/curriculum-tracker", icon: "checklist" });
      items.push({
        label: "Assessments",
        icon: "quiz",
        children: [
          { label: "My Question Bank", href: "/questions", icon: "quiz" },
          { label: "My Exams", href: "/exams", icon: "assignment" },
          { label: "Essay Grading", href: "/essay-grading", icon: "rate_review" },
        ],
      });
    }
    if (perms.subjectTeacherSubjectIds.size > 0 || perms.isReceptionist || perms.classTeacherClassIds.size > 0) {
      items.push({ label: "Daily Attendance", href: "/attendance", icon: "fact_check" });
    }
    if (perms.classTeacherClassIds.size > 0) {
      items.push({ label: "Students", href: "/students?view=teacher", icon: "group" });
      items.push({
        label: "Results", icon: "analytics", children: [
          { label: "Result", href: "/results", icon: "analytics" },
          { label: "Attendance", href: "/results/attendance", icon: "fact_check" },
          { label: "Remarks", href: "/results/remarks", icon: "rate_review" },
          { label: "Broadsheet", href: "/broadsheet", icon: "table_chart" },
        ],
      });
    }
    if (perms.isFeeStatusManager) {
      items.push({ label: "Fee Status", href: "/fee-status", icon: "account_balance_wallet" });
    }
    items.push({ label: "Messages", href: "/messages", icon: "chat" });
  }

  // Profile link for all school users
  items.push({ label: "My Profile", href: "/settings/profile", icon: "person" });

  return items;
}
