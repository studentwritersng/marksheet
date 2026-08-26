-- fee items
CREATE TABLE "fee_items" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "fee_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "student_payments" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "termId" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'cash',
  "note" TEXT,
  "recordedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_payments_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "fee_reminder_configs" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "weeklyEnabled" BOOLEAN NOT NULL DEFAULT false,
  "dayOfWeek" INTEGER NOT NULL DEFAULT 1,
  "lastSentAt" TIMESTAMP(3),
  CONSTRAINT "fee_reminder_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "fee_items_termId_level_name_key" ON "fee_items"("termId","level","name");
CREATE INDEX "fee_items_schoolId_termId_idx" ON "fee_items"("schoolId","termId");
CREATE INDEX "student_payments_studentId_termId_idx" ON "student_payments"("studentId","termId");
CREATE INDEX "student_payments_schoolId_termId_idx" ON "student_payments"("schoolId","termId");
CREATE UNIQUE INDEX "fee_reminder_configs_schoolId_key" ON "fee_reminder_configs"("schoolId");
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_items" ADD CONSTRAINT "fee_items_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_payments" ADD CONSTRAINT "student_payments_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fee_reminder_configs" ADD CONSTRAINT "fee_reminder_configs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
