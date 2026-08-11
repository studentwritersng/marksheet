"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { canReviewExams } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { generateRandomBytes } from "./crypto";
import { fetchExamDataForBundle, serializeBundle, generatePin, hashPin, type OfflineBundleV1 } from "./bundle";

export interface OfflineActionResult {
  error?: string;
  success?: string;
  data?: {
    apiKey?: string;
    signingSecret?: string;
    invigilatorCode?: string;
    examTitle?: string;
    studentCount?: number;
    questionCount?: number;
  };
}

export async function registerHubAction(
  _prev: OfflineActionResult,
  formData: FormData,
): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) return { error: "Not authorised." };

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Hub name is required." };

  const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
  if (!school) return { error: "School not found." };

  const apiKey = `mk_hub_${generateRandomBytes(24)}`;
  const signingSecret = generateRandomBytes(32);
  const invigilatorCode = Math.floor(100000 + Math.random() * 900000).toString();
  const bcrypt = (await import("bcryptjs")).default;

  const hub = await prisma.hub.create({
    data: {
      schoolId: user.schoolId,
      name,
      apiKeyHash: await bcrypt.hash(apiKey, 10),
      signingSecret,
      invigilatorCodeHash: await bcrypt.hash(invigilatorCode, 10),
    },
  });

  revalidatePath("/offline-hubs");
  revalidatePath("/console/offline-hubs");
  return {
    success: `Hub "${name}" registered.`,
    data: { apiKey, signingSecret, invigilatorCode },
  };
}

export async function revokeHubAction(
  _prev: OfflineActionResult,
  formData: FormData,
): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms)) return { error: "Not authorised." };

  const hubId = (formData.get("hubId") as string)?.trim();
  if (!hubId) return { error: "Hub id is required." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId } });
  if (!hub) return { error: "Hub not found." };

  const bundles = await prisma.offlineBundle.findMany({ where: { hubId }, select: { examId: true } });
  const examIds = [...new Set(bundles.map((b) => b.examId))];
  for (const examId of examIds) {
    const synced = await prisma.examAttempt.count({ where: { examId, hubAttemptId: { not: null } } });
    if (synced > 0) continue;
    const otherActive = await prisma.offlineBundle.count({
      where: { examId, hubId: { not: hubId }, hub: { status: "active" } },
    });
    if (otherActive > 0) continue;
    await prisma.exam.update({ where: { id: examId }, data: { offlineStatus: "none" } });
  }

  await prisma.hub.update({ where: { id: hubId }, data: { status: "revoked" } });
  revalidatePath("/offline-hubs");
  revalidatePath("/console/offline-hubs");
  return { success: "Hub revoked." };
}

export async function cancelReleaseToHubAction(examId: string): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) && !canReviewExams(perms)) return { error: "Not authorised." };

  const exam = await prisma.exam.findFirst({ where: { id: examId, schoolId: user.schoolId } });
  if (!exam) return { error: "Exam not found." };

  const synced = await prisma.examAttempt.count({ where: { examId, hubAttemptId: { not: null } } });
  if (synced > 0) return { error: "Exam attempts have already synced back from a hub; release cannot be cancelled." };

  await prisma.$transaction(async (tx) => {
    await tx.offlineBundle.deleteMany({ where: { examId } });
    await tx.exam.update({ where: { id: examId }, data: { offlineStatus: "none" } });
  });

  revalidatePath(`/exams/${examId}`);
  return { success: "Exam release cancelled." };
}

export async function releaseExamToHub(examId: string, hubId: string): Promise<OfflineActionResult> {
  const user = await getCurrentUser();
  if (!user?.schoolId) return { error: "Not authorised." };
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) && !canReviewExams(perms)) return { error: "Not authorised." };

  const hub = await prisma.hub.findFirst({ where: { id: hubId, schoolId: user.schoolId, status: "active" } });
  if (!hub) return { error: "Active hub not found for this school." };

  let examData;
  try {
    examData = await fetchExamDataForBundle(examId, user.schoolId);
  } catch {
    return { error: "Exam not found or not ready to release." };
  }
  const bundleId = `b-${generateRandomBytes(8)}`;
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const roster = examData.students.map((s) => ({
    studentId: s.id,
    admissionNumber: s.admissionNumber,
    firstName: s.firstName,
    lastName: s.lastName,
    pin: generatePin(),
  }));

  const bundle: OfflineBundleV1 = {
    schemaVersion: 1,
    bundleId,
    examId,
    schoolId: examData.exam.schoolId,
    issuedAt,
    expiresAt,
    durationMinutes: examData.exam.durationMinutes,
    shuffleEnabled: examData.exam.shuffleEnabled,
    exam: {
      subjectName: examData.exam.subjectName,
      classNames: examData.exam.classNames,
      termLabel: examData.exam.termLabel,
    },
    questions: examData.questions,
    roster,
  };

  const payload = serializeBundle(bundle, hub.signingSecret, bundleId);

  const created = await prisma.$transaction(async (tx) => {
    const offline = await tx.offlineBundle.create({
      data: {
        bundleId,
        examId,
        hubId: hub.id,
        schoolId: hub.schoolId,
        payload,
        issuedAt: new Date(issuedAt),
        expiresAt: new Date(expiresAt),
      },
    });
    await tx.examPin.createMany({
      data: roster.map((r) => ({
        bundleId: offline.id, // FK to offline_bundles.id
        examId,
        studentId: r.studentId,
        pinHash: hashPin(r.pin),
      })),
      skipDuplicates: true,
    });
    await tx.exam.update({ where: { id: examId }, data: { offlineStatus: "released" } });
    return offline;
  });

  revalidatePath(`/exams/${examId}`);
  return {
    success: `Exam released to hub "${hub.name}".`,
    data: { examTitle: `${examData.exam.subjectName}`, studentCount: roster.length, questionCount: examData.questions.length },
  };
}