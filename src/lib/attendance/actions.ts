"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions } from "@/lib/auth/permissions";
import { guardActiveLicense } from "@/lib/license";
import { recordAudit } from "@/lib/audit";
import { isAddonActive } from "@/lib/addons/check";
import { hookAttendanceAbsent } from "@/lib/notifications/event-hooks";

export interface ActionState { error?: string; success?: string }

const ATTENDANCE_ADDON = "Daily Attendance";
export type AttendanceStatus = "present" | "absent" | "late" | "excused";

async function guardAddon(schoolId: string) {
  try { await guardActiveLicense(schoolId); } catch (e: unknown) { throw new Error(e instanceof Error ? e.message : "License error"); }
  if (!(await isAddonActive(schoolId, ATTENDANCE_ADDON))) throw new Error("Daily Attendance addon not active.");
}

export interface StudentAttendanceRow {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  status: AttendanceStatus | null;
  recordId: string | null;
}

export async function getStudentsWithAttendance(
  schoolId: string, classId: string, dateStr: string, periodId?: string,
): Promise<{ students: StudentAttendanceRow[] }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");

  const date = new Date(dateStr + "T00:00:00");

  const [students, records] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, currentClassId: classId, status: "active" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, admissionNumber: true, firstName: true, lastName: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { schoolId, classId, date, periodId: periodId ?? null },
      select: { id: true, studentId: true, status: true },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.studentId, r]));

  return {
    students: students.map((s) => {
      const record = recordMap.get(s.id);
      return {
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        fullName: `${s.firstName} ${s.lastName}`,
        status: (record?.status as AttendanceStatus) ?? null,
        recordId: record?.id ?? null,
      };
    }),
  };
}

export async function takeStudentAttendanceAction(
  schoolId: string, classId: string, dateStr: string,
  entries: { studentId: string; status: AttendanceStatus }[],
  periodId?: string,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.staffId) return { error: "Not authorised." };
    const perms = await resolvePermissions(user);
    if (!perms.isSchoolAdmin && !perms.isSuperAdmin && !perms.classTeacherClassIds.has(classId) && !perms.subjectTeacherClassIds.has(classId)) {
      return { error: "Not assigned to this class." };
    }
    await guardAddon(schoolId);

    const date = new Date(dateStr + "T00:00:00");

    const existingRecords = await prisma.attendanceRecord.findMany({
      where: { schoolId, classId, date, studentId: { in: entries.map((e) => e.studentId) }, periodId: periodId ?? null },
      select: { id: true, studentId: true },
    });
    const existingMap = new Map(existingRecords.map((r) => [r.studentId, r.id]));

    const absentIds: string[] = [];

    for (const entry of entries) {
      const existingId = existingMap.get(entry.studentId);
      const data = { status: entry.status as string, scannedBy: user.staffId, scannedAt: new Date(), periodId: periodId ?? null };
      if (existingId) {
        await prisma.attendanceRecord.update({ where: { id: existingId }, data });
      } else {
        await prisma.attendanceRecord.create({
          data: { schoolId, studentId: entry.studentId, classId, date, ...data },
        });
      }
      if (entry.status === "absent") absentIds.push(entry.studentId);
    }

    // Fire absent notification hook
    if (absentIds.length > 0) {
      const absentStudents = await prisma.student.findMany({
        where: { id: { in: absentIds } },
        select: { id: true, firstName: true, lastName: true, currentClass: { select: { name: true } } },
      });
      const className = absentStudents[0]?.currentClass?.name ?? "";
      for (const s of absentStudents) {
        hookAttendanceAbsent(schoolId, s.id, `${s.firstName} ${s.lastName}`, className, dateStr);
      }
    }

    await recordAudit({ schoolId, actorId: user.userId, action: "take_attendance", entityType: "attendance" });
    revalidatePath("/attendance");
    return { success: `${entries.length} attendance records saved.` };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

export interface StaffAttendanceRow {
  staffId: string;
  fullName: string;
  status: AttendanceStatus | null;
  recordId: string | null;
}

export async function getStaffForAttendance(
  schoolId: string, dateStr: string,
): Promise<{ staff: StaffAttendanceRow[]; myRecord: StaffAttendanceRow | null }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");

  const date = new Date(dateStr + "T00:00:00");

  const [allStaff, records] = await Promise.all([
    prisma.staff.findMany({
      where: { schoolId, accountStatus: "active" },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.staffAttendanceRecord.findMany({
      where: { schoolId, date },
      select: { id: true, staffId: true, status: true },
    }),
  ]);

  const recordMap = new Map(records.map((r) => [r.staffId, r]));
  const myRecord = user.staffId && recordMap.has(user.staffId)
    ? { staffId: user.staffId, fullName: "", status: recordMap.get(user.staffId)!.status as AttendanceStatus, recordId: recordMap.get(user.staffId)!.id }
    : null;

  return {
    staff: allStaff.map((s) => ({
      staffId: s.id,
      fullName: s.fullName,
      status: (recordMap.get(s.id)?.status as AttendanceStatus) ?? null,
      recordId: recordMap.get(s.id)?.id ?? null,
    })),
    myRecord,
  };
}

export async function takeStaffAttendanceAction(
  schoolId: string, dateStr: string, status: AttendanceStatus,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.staffId) return { error: "Not authorised." };
    await guardAddon(schoolId);

    const date = new Date(dateStr + "T00:00:00");

    await prisma.staffAttendanceRecord.upsert({
      where: { staffId_date: { staffId: user.staffId, date } },
      update: { status, scannedBy: user.staffId, scannedAt: new Date() },
      create: { schoolId, staffId: user.staffId, date, status, scannedBy: user.staffId },
    });

    revalidatePath("/attendance");
    return { success: `Checked in as "${status}".` };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

export async function adminSetStaffAttendanceAction(
  schoolId: string, dateStr: string, staffId: string, status: AttendanceStatus,
): Promise<ActionState> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.staffId) return { error: "Not authorised." };
    const perms = await resolvePermissions(user);
    if (!perms.isSchoolAdmin && !perms.isSuperAdmin) return { error: "Not authorised." };
    await guardAddon(schoolId);

    const date = new Date(dateStr + "T00:00:00");

    await prisma.staffAttendanceRecord.upsert({
      where: { staffId_date: { staffId, date } },
      update: { status, scannedBy: user.staffId, scannedAt: new Date() },
      create: { schoolId, staffId, date, status, scannedBy: user.staffId },
    });

    revalidatePath("/attendance");
    return { success: "Staff attendance updated." };
  } catch (e: unknown) { return { error: e instanceof Error ? e.message : "Unknown error" }; }
}

export interface AttendanceStats {
  totalStudents: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  staffPresent: number;
  staffTotal: number;
  percentage: number;
}

export async function getAttendanceStats(
  schoolId: string, dateStr: string,
): Promise<AttendanceStats> {
  const date = new Date(dateStr + "T00:00:00");

  const [studentRecords, staffRecords, totalStudents, totalStaff] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { schoolId, date }, select: { status: true } }),
    prisma.staffAttendanceRecord.findMany({ where: { schoolId, date }, select: { status: true } }),
    prisma.student.count({ where: { schoolId, status: "active" } }),
    prisma.staff.count({ where: { schoolId, accountStatus: "active" } }),
  ]);

  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  for (const r of studentRecords) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }

  return {
    totalStudents,
    present: counts.present,
    absent: counts.absent,
    late: counts.late,
    excused: counts.excused,
    staffPresent: staffRecords.filter((r) => r.status === "present").length,
    staffTotal: totalStaff,
    percentage: totalStudents > 0 ? Math.round((counts.present / totalStudents) * 100) : 0,
  };
}

export async function getStudentAttendanceHistory(
  schoolId: string, studentId: string, limit = 30,
): Promise<{ date: string; status: AttendanceStatus }[]> {
  const records = await prisma.attendanceRecord.findMany({
    where: { schoolId, studentId },
    orderBy: { date: "desc" },
    take: limit,
    select: { date: true, status: true },
  });
  return records.map((r) => ({ date: r.date.toISOString().split("T")[0], status: r.status as AttendanceStatus }));
}

export interface ClassAttendanceSummary {
  classId: string;
  className: string;
  totalStudents: number;
  present: number;
  percentage: number;
}

export async function getAllClassAttendanceSummary(
  schoolId: string, dateStr: string,
): Promise<ClassAttendanceSummary[]> {
  const date = new Date(dateStr + "T00:00:00");

  const classes = await prisma.class.findMany({
    where: { schoolId, archived: false },
    select: { id: true, name: true, level: true, section: true },
    orderBy: [{ level: "asc" }, { section: "asc" }],
  });

  const results: ClassAttendanceSummary[] = [];

  for (const cls of classes) {
    const [totalStudents, records] = await Promise.all([
      prisma.student.count({ where: { schoolId, currentClassId: cls.id, status: "active" } }),
      prisma.attendanceRecord.findMany({
        where: { schoolId, classId: cls.id, date },
        select: { status: true },
      }),
    ]);

    const present = records.filter((r) => r.status === "present" || r.status === "late").length;
    results.push({
      classId: cls.id,
      className: cls.name,
      totalStudents,
      present,
      percentage: totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0,
    });
  }

  return results;
}

import QRCode from "qrcode";
import type { Prisma } from "@prisma/client";

export interface StudentQrCard {
  studentId: string;
  admissionNumber: string;
  fullName: string;
  className: string;
  passportPhoto: string | null;
  qrDataUrl: string;
}

export async function getStudentQrCards(
  schoolId: string, classId?: string,
): Promise<{ cards: StudentQrCard[] }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated.");

  const where: Prisma.StudentWhereInput = { schoolId, status: "active" };
  if (classId) where.currentClassId = classId;

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ currentClass: { level: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      currentClass: { select: { name: true } },
    },
  });

  const cards: StudentQrCard[] = await Promise.all(
    students.map(async (s) => {
      const qrDataUrl = await QRCode.toDataURL(s.admissionNumber, {
        width: 200,
        margin: 2,
        color: { dark: "#002046", light: "#FFFFFF" },
      });
      return {
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        fullName: `${s.firstName} ${s.lastName}`,
        className: s.currentClass?.name ?? "—",
        passportPhoto: s.passportPhoto,
        qrDataUrl,
      };
    }),
  );

  return { cards };
}
