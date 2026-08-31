-- Add editable template for fee reminders
ALTER TABLE "fee_reminder_configs" ADD COLUMN "messageTemplate" TEXT;
