-- CreateTable: ManualScore
-- Teacher-entered raw scores for exam components not taken on-platform,
-- and for overriding platform-computed scores (e.g. essay AI grade override).
CREATE TABLE "manual_scores" (
    "id"                      TEXT NOT NULL,
    "examId"                  TEXT NOT NULL,
    "studentId"               TEXT NOT NULL,
    "subAssessmentTypeCode"   TEXT NOT NULL,
    "rawScore"                DOUBLE PRECISION NOT NULL,
    "maxRawScore"             DOUBLE PRECISION NOT NULL,
    "enteredBy"               TEXT NOT NULL,
    "note"                    TEXT,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "manual_scores_examId_studentId_subAssessmentTypeCode_key"
    ON "manual_scores"("examId", "studentId", "subAssessmentTypeCode");

CREATE INDEX "manual_scores_examId_idx" ON "manual_scores"("examId");
CREATE INDEX "manual_scores_studentId_idx" ON "manual_scores"("studentId");

-- AddForeignKey
ALTER TABLE "manual_scores"
    ADD CONSTRAINT "manual_scores_examId_fkey"
    FOREIGN KEY ("examId") REFERENCES "exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "manual_scores"
    ADD CONSTRAINT "manual_scores_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
