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
): NavItem[] {
  const items: NavItem[] = [{ label: "Dashboard", href: "/dashboard", icon: "overview" }];

  if (user.role === "super_admin" || user.role === "platform_owner") {
    items.push(
      { label: "Schools", href: "/schools", icon: "domain" },
      { label: "AI Provider", href: "/settings/ai", icon: "settings" },
      { label: "Audit Log", href: "/audit-log", icon: "history" },
    );
    return items;
  }

  const admin = perms.isSuperAdmin || perms.isSchoolAdmin;

  if (admin) {
    items.push(
      { label: "Academics", icon: "school", children: [
        { label: "Sessions & Terms", href: "/sessions", icon: "calendar_today" },
        { label: "Classes", href: "/classes", icon: "school" },
        { label: "Subjects", href: "/subjects", icon: "book" },
        { label: "Class–Subject Links", href: "/class-subjects", icon: "link" },
        { label: "Curriculum", href: "/curriculum", icon: "menu_book" },
      ]},
      { label: "People", icon: "group", children: [
        { label: "Staff", href: "/staff", icon: "badge" },
        { label: "Students", href: "/students", icon: "group" },
      ]},
      { label: "Assessments", icon: "quiz", children: [
        { label: "Lesson Notes", href: "/lesson-notes", icon: "note" },
        { label: "Question Bank", href: "/questions", icon: "quiz" },
        { label: "Essay Grading", href: "/essay-grading", icon: "rate_review" },
        { label: "Assessment Weights", href: "/assessment-weightings", icon: "tune" },
        { label: "Exams", href: "/exams", icon: "quiz" },
        { label: "Timetable", href: "/timetable", icon: "calendar_view_week" },
      ]},
      { label: "Results", icon: "analytics", children: [
        { label: "Result", href: "/results", icon: "analytics" },
        { label: "Psychomotor", href: "/results/psychomotor", icon: "psychology" },
        { label: "Attendance", href: "/results/attendance", icon: "fact_check" },
        { label: "Remarks", href: "/results/remarks", icon: "rate_review" },
        { label: "Broadsheet", href: "/broadsheet", icon: "table_chart" },
      ]},
      { label: "Billing", icon: "payments", children: [
        { label: "Billing & License", href: "/billing", icon: "account_balance_wallet" },
      ]},
      { label: "System", icon: "settings", children: [
        { label: "Announcements", href: "/announcements", icon: "campaign" },
        { label: "Audit Log", href: "/audit-log", icon: "history" },
        { label: "Fee Status", href: "/fee-status", icon: "account_balance_wallet" },
        { label: "Settings", href: "/settings/school", icon: "settings" },
      ]},
    );
  } else if (user.role === "parent") {
    items.push(
      { label: "My Wards", href: "/parent", icon: "family_history" },
    );
  } else if (user.role === "student") {
    items.push(
      { label: "My Exams", href: "/my-exams", icon: "quiz" },
      { label: "My Results", href: "/my-results", icon: "analytics" },
      { label: "My Timetable", href: "/my-timetable", icon: "calendar_view_week" },
      { label: "Fee Status", href: "/fee-status", icon: "account_balance_wallet" },
    );
  } else {
    if (
      perms.subjectTeacherClassIds.size > 0 ||
      perms.classTeacherClassIds.size > 0
    ) {
      items.push({ label: "My Classes", href: "/my-classes", icon: "school" });
    }
    if (perms.subjectTeacherSubjectIds.size > 0) {
      items.push({ label: "Lesson Notes", href: "/lesson-notes", icon: "note" });
    }
    if (perms.classTeacherClassIds.size > 0) {
      items.push({ label: "Students", href: "/students", icon: "group" });
    }
    if (perms.isFeeStatusManager) {
      items.push({ label: "Fee Status", href: "/fee-status", icon: "account_balance_wallet" });
    }
  }

  // Profile link for all school users
  items.push({ label: "My Profile", href: "/settings/profile", icon: "person" });

  return items;
}
