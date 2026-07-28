-- CreateTable
CREATE TABLE "school_registrations" (
    "id" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "schoolAddress" TEXT,
    "schoolPhone" TEXT,
    "schoolEmail" TEXT,
    "schoolLogo" TEXT,
    "principalFirstName" TEXT NOT NULL,
    "principalLastName" TEXT NOT NULL,
    "principalEmail" TEXT NOT NULL,
    "principalPhone" TEXT,
    "referralCode" TEXT,
    "referralId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_registrations_status_idx" ON "school_registrations"("status");

-- AddForeignKey
ALTER TABLE "school_registrations" ADD CONSTRAINT "school_registrations_referralId_fkey" FOREIGN KEY ("referralId") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
