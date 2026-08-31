/**
 * Shared template variable system for admin messaging + fee reminders.
 * Syntax: {{variable_name}}  (case-insensitive, whitespace tolerated)
 *
 * renderTemplate does a simple string replace — unknown keys left as-is
 * so the sender can preview what will be sent.
 */

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
  description: string;
  contexts: string[]; // e.g. ["message:teachers","message:students","fee_reminder"]
}

export const MESSAGE_VARIABLES: TemplateVariable[] = [
  { key: "student_name", label: "Student Name", example: "Chiamaka Okafor", description: "Full name of the student", contexts: ["message:students","message:parents","fee_reminder"] },
  { key: "student_first_name", label: "Student First Name", example: "Chiamaka", description: "First name only", contexts: ["message:students","message:parents","fee_reminder"] },
  { key: "admission_number", label: "Admission No.", example: "MAR/2024/0123", description: "Student admission number", contexts: ["message:students","message:parents"] },
  { key: "class", label: "Class", example: "JSS2A", description: "Student class name", contexts: ["message:students","message:parents","fee_reminder"] },
  { key: "guardian_name", label: "Guardian Name", example: "Mr. Okafor", description: "Guardian / parent full name", contexts: ["message:parents","fee_reminder","message:teachers"] },
  { key: "parent_name", label: "Parent Name", example: "Mr. Okafor", description: "Alias of guardian_name", contexts: ["message:parents","fee_reminder"] },
  { key: "recipient_name", label: "Recipient Name", example: "Mrs. Adeyemi", description: "Name of the message recipient (teacher/student/parent)", contexts: ["message:teachers","message:students","message:parents"] },
  { key: "school_name", label: "School Name", example: "Lagos Academy", description: "School name", contexts: ["message:teachers","message:students","message:parents","fee_reminder"] },
  { key: "subject", label: "Subject", example: "Mathematics", description: "Subject name (when relevant)", contexts: ["message:teachers","message:students","message:parents"] },
  { key: "term", label: "Term", example: "First Term", description: "Current term name", contexts: ["message:students","message:parents","fee_reminder"] },
  { key: "session", label: "Session", example: "2025/2026", description: "Academic session label", contexts: ["message:students","message:parents","fee_reminder"] },
  { key: "date", label: "Date", example: "31/08/2026", description: "Current date (DD/MM/YYYY)", contexts: ["message:teachers","message:students","message:parents","fee_reminder"] },
  { key: "time", label: "Time", example: "14:30", description: "Current time (HH:MM)", contexts: ["message:teachers","message:students","message:parents","fee_reminder"] },
  { key: "datetime", label: "Date & Time", example: "31/08/2026 14:30", description: "Current date and time", contexts: ["message:teachers","message:students","message:parents","fee_reminder"] },
];

export const FEE_REMINDER_VARIABLES: TemplateVariable[] = [
  { key: "guardian_name", label: "Guardian Name", example: "Mr. Okafor", description: "Guardian full name", contexts: ["fee_reminder"] },
  { key: "student_name", label: "Student Name", example: "Chiamaka Okafor", description: "First ward's student name (or sole ward)", contexts: ["fee_reminder"] },
  { key: "class", label: "Class", example: "JSS2A", description: "First ward's class", contexts: ["fee_reminder"] },
  { key: "balance", label: "Balance", example: "₦30,000", description: "Outstanding balance of first ward", contexts: ["fee_reminder"] },
  { key: "expected", label: "Expected Amount", example: "₦50,000", description: "Total expected for first ward", contexts: ["fee_reminder"] },
  { key: "paid", label: "Amount Paid", example: "₦20,000", description: "Amount paid for first ward", contexts: ["fee_reminder"] },
  { key: "total_balance", label: "Total Balance (all wards)", example: "₦55,000", description: "Sum of balances across all wards", contexts: ["fee_reminder"] },
  { key: "ward_list", label: "Ward List", example: "Chiamaka Okafor (JSS1A): Balance ₦30,000\nEmeka Okafor (JSS3B): Balance ₦25,000", description: "Formatted list of all wards with balances", contexts: ["fee_reminder"] },
  { key: "term", label: "Term", example: "First Term", description: "Term name", contexts: ["fee_reminder"] },
  { key: "session", label: "Session", example: "2025/2026", description: "Session label", contexts: ["fee_reminder"] },
  { key: "school_name", label: "School Name", example: "Lagos Academy", description: "School name", contexts: ["fee_reminder"] },
  { key: "date", label: "Date", example: "31/08/2026", description: "Current date", contexts: ["fee_reminder"] },
  { key: "time", label: "Time", example: "14:30", description: "Current time", contexts: ["fee_reminder"] },
  { key: "datetime", label: "Date & Time", example: "31/08/2026 14:30", description: "Current date & time", contexts: ["fee_reminder"] },
];

export const DEFAULT_FEE_REMINDER_TEMPLATE =
  "Dear {{guardian_name}},\n\nThis is a friendly fee reminder from {{school_name}} for {{term}} ({{session}}) as of {{date}}.\n\n{{ward_list}}\n\nPlease settle the outstanding balance at your earliest convenience. For enquiries, contact the bursary.\n\nThank you.";

export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  if (!template) return "";
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, rawKey: string) => {
    const key = rawKey.toLowerCase();
    // allow alias: parent_name -> guardian_name, class_name -> class, etc.
    const aliases: Record<string, string> = {
      parent_name: "guardian_name",
      class_name: "class",
      admission_no: "admission_number",
    };
    const canonical = aliases[key] ?? key;
    const val = vars[canonical] ?? vars[key];
    if (val === null || val === undefined || val === "") {
      // leave unknown untouched so sender sees it; but for alias we already resolved
      // If variable not provided, keep placeholder (will be visible) rather than blank.
      // For known global vars that are empty, return empty string.
      const known = new Set([...MESSAGE_VARIABLES, ...FEE_REMINDER_VARIABLES].map((v) => v.key));
      if (known.has(canonical) || known.has(key)) return String(val ?? "");
      return `{{${rawKey}}}`;
    }
    return String(val);
  });
}

export function formatDate(d = new Date()): string {
  return d.toLocaleDateString("en-NG");
}
export function formatTime(d = new Date()): string {
  return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
}
export function formatDateTime(d = new Date()): string {
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** Build vars for a general message recipient */
export interface MessageContextVars {
  recipient_name?: string;
  student_name?: string;
  student_first_name?: string;
  admission_number?: string;
  class?: string;
  guardian_name?: string;
  school_name?: string;
  subject?: string;
  term?: string;
  session?: string;
  date?: string;
  time?: string;
  datetime?: string;
}

/** Build vars for fee reminder */
export interface FeeReminderVars {
  guardian_name?: string;
  student_name?: string;
  class?: string;
  balance?: string;
  expected?: string;
  paid?: string;
  total_balance?: string;
  ward_list?: string;
  term?: string;
  session?: string;
  school_name?: string;
  date?: string;
  time?: string;
  datetime?: string;
}
