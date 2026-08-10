-- Offline exam sync (Phase 1)
CREATE TYPE "HubStatus" AS ENUM ('active', 'revoked');

CREATE TABLE "hubs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "apiKeyHash" TEXT NOT NULL,
  "signingSecret" TEXT NOT NULL,
  "invigilatorCodeHash" TEXT NOT NULL,
  "status" "HubStatus" NOT NULL DEFAULT 'active',
  "lastSeenAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hubs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offline_bundles" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "payload" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "offline_bundles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "exam_pins" (
  "id" TEXT NOT NULL,
  "bundleId" TEXT NOT NULL,
  "examId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "pinHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "exam_pins_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "exams" ADD COLUMN "offlineStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "exam_attempts" ADD COLUMN "hubId" TEXT, ADD COLUMN "hubAttemptId" TEXT;
ALTER TABLE "student_answers" ADD COLUMN "checksumFlagged" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "hubs" ADD CONSTRAINT "hubs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offline_bundles" ADD CONSTRAINT "offline_bundles_examId_fkey" FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offline_bundles" ADD CONSTRAINT "offline_bundles_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "offline_bundles" ADD CONSTRAINT "offline_bundles_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_pins" ADD CONSTRAINT "exam_pins_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "offline_bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_hubId_fkey" FOREIGN KEY ("hubId") REFERENCES "hubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "offline_bundles_bundleId_key" ON "offline_bundles"("bundleId");
CREATE INDEX "offline_bundles_hubId_idx" ON "offline_bundles"("hubId");
CREATE INDEX "offline_bundles_examId_idx" ON "offline_bundles"("examId");
CREATE UNIQUE INDEX "exam_pins_bundleId_studentId_key" ON "exam_pins"("bundleId", "studentId");
CREATE INDEX "exam_pins_examId_idx" ON "exam_pins"("examId");
CREATE INDEX "hubs_schoolId_idx" ON "hubs"("schoolId");
CREATE UNIQUE INDEX "exam_attempts_hubId_hubAttemptId_key" ON "exam_attempts"("hubId", "hubAttemptId");
