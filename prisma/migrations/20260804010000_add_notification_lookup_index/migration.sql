-- AlterTable
-- Replace the two-column recipient index with a composite that also covers
-- ORDER BY sentAt DESC (recent-notifications list and unread count lookups).
DROP INDEX "notifications_recipientType_recipientId_idx";

-- CreateIndex
CREATE INDEX "notifications_recipientType_recipientId_sentAt_idx" ON "notifications"("recipientType", "recipientId", "sentAt");
