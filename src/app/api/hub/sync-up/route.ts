import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { authenticateHub } from "@/lib/offline/hub-auth";
import { processSyncUp, type SyncUpPayload, type AttemptKey, type AttemptRecord, type AnswerRecord, type IngestStore } from "@/lib/offline/ingest";
import { prisma } from "@/lib/prisma";

const store: IngestStore = {
  async findAttempt(key: AttemptKey) {
    const found = await prisma.examAttempt.findUnique({
      where: { hubId_hubAttemptId: { hubId: key.hubId, hubAttemptId: key.hubAttemptId } },
      select: { id: true },
    });
    return found !== null;
  },
  async createAttempt(record: AttemptRecord) {
    const created = await prisma.examAttempt.create({
      data: {
        hubId: record.hubId,
        hubAttemptId: record.hubAttemptId,
        studentId: record.studentId,
        examId: record.examId,
        startedAt: new Date(record.startedAt),
        submittedAt: record.submittedAt ? new Date(record.submittedAt) : null,
        status: record.status as "in_progress" | "submitted" | "absent",
        shuffledQuestionIds: record.shuffledQuestionIds as Prisma.InputJsonValue,
        shuffledOptionOrder: record.shuffledOptionOrder as Prisma.InputJsonValue,
        syncStatus: "synced",
      },
    });
    return created.id;
  },
  async createAnswers(records: AnswerRecord[]) {
    await prisma.studentAnswer.createMany({ data: records });
  },
};

export async function POST(request: Request) {
  const auth = await authenticateHub(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: SyncUpPayload;
  try {
    payload = (await request.json()) as SyncUpPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!payload || !payload.bundleId || !Array.isArray(payload.attempts)) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  const results = await processSyncUp(payload, { id: auth.hub.id, signingSecret: auth.hub.signingSecret }, store);
  return NextResponse.json({ results });
}