-- Add Huawei Push Kit (HMS) support to PushDevice.
-- fcmToken becomes nullable so Huawei-without-GMS devices (no FCM token) can register.
ALTER TABLE "PushDevice" ALTER COLUMN "fcmToken" DROP NOT NULL;
ALTER TABLE "PushDevice" ADD COLUMN IF NOT EXISTS "hmsToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "PushDevice_hmsToken_key" ON "PushDevice"("hmsToken");
