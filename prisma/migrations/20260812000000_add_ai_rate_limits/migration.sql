-- AlterTable
ALTER TABLE "ai_call_logs" ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "ai_rate_limit_settings" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "perUserDailyQuota" INTEGER NOT NULL DEFAULT 15,
    "perUserPerMinuteBurst" INTEGER NOT NULL DEFAULT 5,
    "perSchoolDailyCap" INTEGER NOT NULL DEFAULT 300,
    "resetsAtUtc" TEXT NOT NULL DEFAULT '00:00',
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rate_limit_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_rate_limit_buckets" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_rate_limit_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_rate_limit_buckets_key_key" ON "ai_rate_limit_buckets"("key");

-- CreateIndex
CREATE INDEX "ai_rate_limit_buckets_windowStart_idx" ON "ai_rate_limit_buckets"("windowStart");

