export interface ProviderConfigVM {
  id: string;
  channel: string;
  provider: string;
  label: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface TemplateVM {
  id: string;
  eventType: string;
  channel: string;
  label: string | null;
  body: string;
  isActive: boolean;
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  attendance_marked_absent: "Absent from Class",
  student_signed_in: "Student Signed In",
  student_signed_out: "Student Signed Out",
  staff_signed_in: "Staff Signed In",
  staff_signed_out: "Staff Signed Out",
  result_published: "Result Published",
  exam_scheduled: "Exam Scheduled",
  fee_reminder: "Fee Reminder",
  general_notice: "General Notice",
};

export interface SchoolNotifConfigVM {
  smsActive: boolean;
  whatsappActive: boolean;
  enabledEvents: string[];
}

export interface LogEntryVM {
  id: string;
  channel: string;
  eventType: string;
  recipient: string;
  message: string;
  status: string;
  provider: string | null;
  error: string | null;
  sentAt: Date;
}

export interface QueueItemVM {
  id: string;
  channel: string;
  eventType: string;
  recipient: string;
  message: string;
  status: string;
  scheduledAt: Date;
  error: string | null;
}
