-- AlterEnum: add 'proprietor' to UserRole
ALTER TYPE "UserRole" ADD VALUE 'proprietor';

-- Add proprietor fields + group relation to User
ALTER TABLE "users" ADD COLUMN "proprietorGroupId" TEXT;
ALTER TABLE "users" ADD COLUMN "proprietorPermissionLevel" TEXT;
CREATE INDEX "users_proprietorGroupId_idx" ON "users"("proprietorGroupId");

-- Add stage-specific prices to Addon
ALTER TABLE "addons" ADD COLUMN "basicPrice" DECIMAL(65,30);
ALTER TABLE "addons" ADD COLUMN "standardPrice" DECIMAL(65,30);
ALTER TABLE "addons" ADD COLUMN "premiumPrice" DECIMAL(65,30);

-- CreateTable: SchoolGroup
CREATE TABLE "school_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "feeGroupStage" "LicenseStageName",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "school_groups_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "school_groups_name_key" ON "school_groups"("name");

-- CreateTable: GroupMembership
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedBy" TEXT,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "group_memberships_schoolId_key" ON "group_memberships"("schoolId");
CREATE INDEX "group_memberships_groupId_idx" ON "group_memberships"("groupId");

-- CreateTable: GroupAddonSubscription
CREATE TABLE "group_addon_subscriptions" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "paymentReference" TEXT,
    "setBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "group_addon_subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "group_addon_subscriptions_groupId_addonId_key" ON "group_addon_subscriptions"("groupId", "addonId");
CREATE INDEX "group_addon_subscriptions_groupId_idx" ON "group_addon_subscriptions"("groupId");

-- CreateTable: GroupStudentTransferRecord
CREATE TABLE "group_student_transfer_records" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "originSchoolId" TEXT NOT NULL,
    "originStudentId" TEXT NOT NULL,
    "destinationSchoolId" TEXT NOT NULL,
    "destinationStudentId" TEXT NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "group_student_transfer_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "group_student_transfer_records_groupId_idx" ON "group_student_transfer_records"("groupId");
CREATE INDEX "group_student_transfer_records_originSchoolId_idx" ON "group_student_transfer_records"("originSchoolId");
CREATE INDEX "group_student_transfer_records_destinationSchoolId_idx" ON "group_student_transfer_records"("destinationSchoolId");
CREATE INDEX "group_student_transfer_records_originStudentId_idx" ON "group_student_transfer_records"("originStudentId");
CREATE INDEX "group_student_transfer_records_destinationStudentId_idx" ON "group_student_transfer_records"("destinationStudentId");

-- AddForeignKey: User.proprietorGroupId -> SchoolGroup.id
ALTER TABLE "users" ADD CONSTRAINT "users_proprietorGroupId_fkey" FOREIGN KEY ("proprietorGroupId") REFERENCES "school_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: GroupMembership.groupId -> SchoolGroup.id
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GroupMembership.schoolId -> School.id
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GroupAddonSubscription.groupId -> SchoolGroup.id
ALTER TABLE "group_addon_subscriptions" ADD CONSTRAINT "group_addon_subscriptions_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GroupAddonSubscription.addonId -> Addon.id
ALTER TABLE "group_addon_subscriptions" ADD CONSTRAINT "group_addon_subscriptions_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GroupStudentTransferRecord.groupId -> SchoolGroup.id
ALTER TABLE "group_student_transfer_records" ADD CONSTRAINT "group_student_transfer_records_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "school_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: GroupStudentTransferRecord.originSchoolId -> School.id
ALTER TABLE "group_student_transfer_records" ADD CONSTRAINT "group_student_transfer_records_originSchoolId_fkey" FOREIGN KEY ("originSchoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: GroupStudentTransferRecord.originStudentId -> Student.id
ALTER TABLE "group_student_transfer_records" ADD CONSTRAINT "group_student_transfer_records_originStudentId_fkey" FOREIGN KEY ("originStudentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: GroupStudentTransferRecord.destinationSchoolId -> School.id
ALTER TABLE "group_student_transfer_records" ADD CONSTRAINT "group_student_transfer_records_destinationSchoolId_fkey" FOREIGN KEY ("destinationSchoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: GroupStudentTransferRecord.destinationStudentId -> Student.id
ALTER TABLE "group_student_transfer_records" ADD CONSTRAINT "group_student_transfer_records_destinationStudentId_fkey" FOREIGN KEY ("destinationStudentId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
