-- CreateTable: RemarkTemplate
CREATE TABLE "remark_templates" (
    "id"        TEXT NOT NULL,
    "schoolId"  TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "text"      TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remark_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "remark_templates_schoolId_type_idx" ON "remark_templates"("schoolId", "type");

ALTER TABLE "remark_templates"
    ADD CONSTRAINT "remark_templates_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
