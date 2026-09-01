-- AlterTable: add useSingleLicense to school_groups
ALTER TABLE "school_groups" ADD COLUMN "useSingleLicense" BOOLEAN NOT NULL DEFAULT false;
