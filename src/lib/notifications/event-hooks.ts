import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { queueEventNotification, fillTemplate } from "./provider-actions";

const NOTIFY_ADDON = "Notifications (WhatsApp & SMS)";

async function getSchoolConfig(schoolId: string) {
  const config = await prisma.schoolNotificationConfig.findUnique({
    where: { schoolId },
    select: { smsActive: true, whatsappActive: true, enabledEvents: true },
  });
  if (!config) return null;
  return { smsActive: config.smsActive, whatsappActive: config.whatsappActive, enabledEvents: (config.enabledEvents as string[]) ?? [] };
}

async function getTemplatesForEvent(eventType: string) {
  return prisma.notificationTemplate.findMany({
    where: { eventType, isActive: true },
    select: { id: true, channel: true, body: true },
  });
}

function channelActive(config: { smsActive: boolean; whatsappActive: boolean }, channel: string): boolean {
  if (channel === "sms") return config.smsActive;
  if (channel === "whatsapp") return config.whatsappActive;
  return false;
}

async function getGuardianPhones(studentId: string): Promise<{ fullName: string; phone: string }[]> {
  const guardians = await prisma.guardian.findMany({
    where: { studentId },
    select: { fullName: true, phone: true },
  });
  return guardians.filter((g) => g.phone) as { fullName: string; phone: string }[];
}

async function getSchoolName(schoolId: string): Promise<string> {
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } });
  return school?.name ?? "School";
}

// ── Hook: Student marked absent ───────────────────────────────────────────

export async function hookAttendanceAbsent(
  schoolId: string, studentId: string, studentName: string, className: string, dateStr: string,
) {
  const active = await isAddonActive(schoolId, NOTIFY_ADDON);
  if (!active) return;

  const config = await getSchoolConfig(schoolId);
  if (!config) return;
  if (!config.enabledEvents.includes("attendance_marked_absent")) return;

  const channels: string[] = [];
  if (channelActive(config, "sms")) channels.push("sms");
  if (channelActive(config, "whatsapp")) channels.push("whatsapp");
  if (channels.length === 0) return;

  const templates = await getTemplatesForEvent("attendance_marked_absent");
  if (templates.length === 0) return;

  const guardians = await getGuardianPhones(studentId);
  if (guardians.length === 0) return;

  const schoolName = await getSchoolName(schoolId);

  for (const channel of channels) {
    const template = templates.find((t) => t.channel === channel);
    if (!template) continue;

    for (const guardian of guardians) {
      const message = await fillTemplate(template.body, {
        studentName,
        guardianName: guardian.fullName,
        className,
        schoolName,
        date: dateStr,
      });
      await queueEventNotification(schoolId, "attendance_marked_absent", guardian.phone, channel, message);
    }
  }
}

// ── Hook: Result published ────────────────────────────────────────────────

export async function hookResultPublished(
  schoolId: string, termId: string, termName: string, studentIds: string[],
) {
  const active = await isAddonActive(schoolId, NOTIFY_ADDON);
  if (!active) return;

  const config = await getSchoolConfig(schoolId);
  if (!config) return;
  if (!config.enabledEvents.includes("result_published")) return;

  const channels: string[] = [];
  if (channelActive(config, "sms")) channels.push("sms");
  if (channelActive(config, "whatsapp")) channels.push("whatsapp");
  if (channels.length === 0) return;

  const templates = await getTemplatesForEvent("result_published");
  if (templates.length === 0) return;

  const schoolName = await getSchoolName(schoolId);
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds } },
    select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true } } },
  });

  for (const student of students) {
    const guardians = await getGuardianPhones(student.id);
    if (guardians.length === 0) continue;

    const studentName = `${student.firstName} ${student.lastName}`;
    const className = student.currentClass?.name ?? "";

    for (const channel of channels) {
      const template = templates.find((t) => t.channel === channel);
      if (!template) continue;

      for (const guardian of guardians) {
        const message = await fillTemplate(template.body, {
          studentName,
          guardianName: guardian.fullName,
          className,
          schoolName,
          termName,
        });
        await queueEventNotification(schoolId, "result_published", guardian.phone, channel, message);
      }
    }
  }
}

// ── Hook: Exam scheduled ──────────────────────────────────────────────────

export async function hookExamScheduled(
  schoolId: string, examName: string, subjectName: string, className: string,
) {
  const active = await isAddonActive(schoolId, NOTIFY_ADDON);
  if (!active) return;

  const config = await getSchoolConfig(schoolId);
  if (!config) return;
  if (!config.enabledEvents.includes("exam_scheduled")) return;

  const channels: string[] = [];
  if (channelActive(config, "sms")) channels.push("sms");
  if (channelActive(config, "whatsapp")) channels.push("whatsapp");
  if (channels.length === 0) return;

  const templates = await getTemplatesForEvent("exam_scheduled");
  if (templates.length === 0) return;

  const schoolName = await getSchoolName(schoolId);
  const classObj = await prisma.class.findFirst({
    where: { schoolId, name: className },
    select: { id: true },
  });
  if (!classObj) return;

  const students = await prisma.student.findMany({
    where: { schoolId, currentClassId: classObj.id, status: "active" },
    select: { id: true, firstName: true, lastName: true },
  });

  for (const student of students) {
    const guardians = await getGuardianPhones(student.id);
    if (guardians.length === 0) continue;

    const studentName = `${student.firstName} ${student.lastName}`;

    for (const channel of channels) {
      const template = templates.find((t) => t.channel === channel);
      if (!template) continue;

      for (const guardian of guardians) {
        const message = await fillTemplate(template.body, {
          studentName,
          guardianName: guardian.fullName,
          className,
          schoolName,
          examName,
          subjectName,
        });
        await queueEventNotification(schoolId, "exam_scheduled", guardian.phone, channel, message);
      }
    }
  }
}
