-- AlterTable
ALTER TABLE "schools" ADD COLUMN "customDomain" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "schools_customDomain_key" ON "schools"("customDomain");

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "customDomainVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN "customDomainToken" TEXT;
