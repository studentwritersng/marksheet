-- CreateTable: PushDevice
-- FCM push registration tokens for Android APK push notifications (Task 1/4/6).
CREATE TABLE "push_devices" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "fcmToken"   TEXT NOT NULL,
    "schoolId"   TEXT,
    "platform"   TEXT NOT NULL DEFAULT 'android',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_fcmToken_key" ON "push_devices"("fcmToken");

CREATE INDEX "push_devices_userId_idx" ON "push_devices"("userId");

-- AddForeignKey
ALTER TABLE "push_devices"
    ADD CONSTRAINT "push_devices_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
