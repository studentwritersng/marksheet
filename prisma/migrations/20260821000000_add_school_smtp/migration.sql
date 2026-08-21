-- Per-school SMTP sender (School Email Sender)
-- Adds nullable SMTP config columns to School. Existing rows default to
-- smtpEnabled = false (mail hard-blocked) until the console owner configures them.

ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpHost" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpPort" INTEGER;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpUser" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpPassEnc" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpFrom" TEXT;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpSecure" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "School" ADD COLUMN IF NOT EXISTS "smtpEnabled" BOOLEAN NOT NULL DEFAULT false;
