import { prisma } from "@/lib/prisma";
import type { BackupExport } from "./types";

type IdMap = Map<string, string>;

export interface ImportResult {
  success: boolean;
  entitiesCreated: number;
  errors: string[];
}

export async function importSchoolData(schoolId: string, backup: BackupExport): Promise<ImportResult> {
  const errors: string[] = [];
  let totalCreated = 0;
  const idMap: IdMap = new Map();

  const existingSchool = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!existingSchool) return { success: false, entitiesCreated: 0, errors: ["Target school not found."] };

  const track = <T extends { id: string }>(records: T[], fn: (item: T) => Promise<unknown>) =>
    Promise.all(records.map(async (r) => {
      try {
        await fn(r);
        idMap.set(r.id, r.id);
        totalCreated++;
      } catch (e: any) {
        errors.push(`Error creating ${r.constructor?.name ?? "record"} ${r.id}: ${e.message}`);
      }
    }));

  const remap = (oldId: string | null | undefined): string | null | undefined => {
    if (!oldId) return oldId;
    return idMap.get(oldId) ?? oldId;
  };

  // 0. School config
  if (backup.data.school) {
    try {
      const { logo, signature, stamp, ...schoolFields } = backup.data.school;
      await prisma.school.update({
        where: { id: schoolId },
        data: {
          name: schoolFields.name,
          address: schoolFields.address,
          phone: schoolFields.phone,
          email: schoolFields.email,
          motto: schoolFields.motto,
          letterheadSettings: schoolFields.letterheadSettings as any,
          gradingScale: schoolFields.gradingScale as any,
          admissionFormat: schoolFields.admissionFormat,
          shortcode: schoolFields.shortcode,
          studentSequence: schoolFields.studentSequence,
          maintenanceMode: schoolFields.maintenanceMode,
          feeGateExams: schoolFields.feeGateExams,
          feeGateResults: schoolFields.feeGateResults,
          stage: schoolFields.stage as any,
          logo: logo ?? existingSchool.logo,
          signature: signature ?? existingSchool.signature,
          stamp: stamp ?? existingSchool.stamp,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error updating school: ${e.message}`);
    }
  }

  // 1. Sessions
  for (const s of backup.data.sessions) {
    try {
      const created = await prisma.session.create({
        data: {
          schoolId,
          label: s.label,
          isCurrent: s.isCurrent,
          status: s.status as any,
          createdAt: new Date(s.createdAt),
        },
      });
      idMap.set(s.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating session ${s.label}: ${e.message}`);
    }
  }

  // 2. Terms
  for (const t of backup.data.terms) {
    try {
      const created = await prisma.term.create({
        data: {
          sessionId: remap(t.sessionId)!,
          name: t.name as any,
          startDate: t.startDate ? new Date(t.startDate) : null,
          endDate: t.endDate ? new Date(t.endDate) : null,
          isCurrent: t.isCurrent,
        },
      });
      idMap.set(t.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating term: ${e.message}`);
    }
  }

  // 3. AssessmentTypes (need to handle parentId self-ref, do in two passes)
  const assessmentTypeMap: IdMap = new Map();
  for (const at of backup.data.assessmentTypes) {
    try {
      const created = await prisma.assessmentType.create({
        data: { schoolId, name: at.name, code: at.code, parentId: null, sortOrder: at.sortOrder },
      });
      assessmentTypeMap.set(at.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating assessment type ${at.name}: ${e.message}`);
    }
  }
  for (const at of backup.data.assessmentTypes) {
    if (at.parentId) {
      const newParentId = assessmentTypeMap.get(at.parentId);
      if (newParentId) {
        try {
          await prisma.assessmentType.update({
            where: { id: assessmentTypeMap.get(at.id)! },
            data: { parentId: newParentId },
          });
        } catch (e: any) {
          errors.push(`Error linking parent for assessment type ${at.name}: ${e.message}`);
        }
      }
    }
    idMap.set(at.id, assessmentTypeMap.get(at.id) ?? at.id);
  }

  // 4. Classes
  for (const c of backup.data.classes) {
    try {
      const created = await prisma.class.create({
        data: {
          schoolId,
          sessionId: remap(c.sessionId)!,
          name: c.name,
          level: c.level,
          section: c.section,
          department: c.department,
          archived: c.archived,
        },
      });
      idMap.set(c.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating class ${c.name}: ${e.message}`);
    }
  }

  // 5. Subjects
  for (const s of backup.data.subjects) {
    try {
      const created = await prisma.subject.create({
        data: { schoolId, name: s.name, code: s.code },
      });
      idMap.set(s.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating subject ${s.name}: ${e.message}`);
    }
  }

  // 6. Staff
  for (const s of backup.data.staff) {
    try {
      const created = await prisma.staff.create({
        data: { schoolId, fullName: s.fullName, email: s.email, phone: s.phone, image: s.image, signature: s.signature, bioData: s.bioData as any, accountStatus: s.accountStatus },
      });
      idMap.set(s.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating staff ${s.fullName}: ${e.message}`);
    }
  }

  // 7. Users (skip if email already exists, link via staffId)
  for (const u of backup.data.users) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        idMap.set(u.id, existing.id);
        totalCreated++;
        continue;
      }
      const created = await prisma.user.create({
        data: {
          schoolId,
          email: u.email,
          passwordHash: u.passwordHash,
          role: u.role as any,
          staffId: remap(u.staffId) as string | undefined,
          isActive: u.isActive,
          mustChangePassword: u.mustChangePassword,
        },
      });
      idMap.set(u.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating user ${u.email}: ${e.message}`);
    }
  }

  // 8. Assignments
  for (const a of backup.data.assignments) {
    try {
      await prisma.assignment.create({
        data: {
          schoolId,
          staffId: remap(a.staffId)!,
          assignmentType: a.assignmentType as any,
          subjectId: remap(a.subjectId),
          classId: remap(a.classId),
          sessionId: remap(a.sessionId),
          termId: remap(a.termId),
          isTemporary: a.isTemporary,
          startDate: a.startDate ? new Date(a.startDate) : null,
          endDate: a.endDate ? new Date(a.endDate) : null,
          createdBy: remap(a.createdBy),
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating assignment: ${e.message}`);
    }
  }

  // 9. Students (skip if already exists by admissionNumber)
  for (const s of backup.data.students) {
    try {
      const existing = await prisma.student.findUnique({
        where: { schoolId_admissionNumber: { schoolId, admissionNumber: s.admissionNumber } },
      });
      if (existing) {
        idMap.set(s.id, existing.id);
        totalCreated++;
        continue;
      }
      const created = await prisma.student.create({
        data: {
          schoolId,
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          middleName: s.middleName,
          lastName: s.lastName,
          email: s.email,
          dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth) : null,
          ethnicity: s.ethnicity,
          religion: s.religion,
          gender: s.gender,
          passportPhoto: s.passportPhoto,
          currentClassId: remap(s.currentClassId),
          admissionDate: s.admissionDate ? new Date(s.admissionDate) : null,
          status: s.status as any,
          userId: remap(s.userId),
          bioData: s.bioData as any,
          isClassCaptain: s.isClassCaptain,
          isViceClassCaptain: s.isViceClassCaptain,
        },
      });
      idMap.set(s.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating student ${s.admissionNumber}: ${e.message}`);
    }
  }

  // 10. Guardians
  for (const g of backup.data.guardians) {
    try {
      await prisma.guardian.create({
        data: {
          studentId: remap(g.studentId)!,
          relationship: g.relationship,
          fullName: g.fullName,
          phone: g.phone || "",
          email: g.email,
          address: g.address,
          isPrimaryContact: g.isPrimaryContact,
          parentUserId: remap(g.parentUserId),
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating guardian: ${e.message}`);
    }
  }

  // 11. ClassSubjects
  for (const cs of backup.data.classSubjects) {
    try {
      await prisma.classSubject.create({
        data: {
          schoolId,
          classId: remap(cs.classId)!,
          subjectId: remap(cs.subjectId)!,
          department: cs.department,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating class-subject link: ${e.message}`);
    }
  }

  // 12. AssessmentWeightings
  for (const aw of backup.data.assessmentWeightings) {
    try {
      await prisma.assessmentWeighting.create({
        data: {
          schoolId,
          subjectId: remap(aw.subjectId),
          assessmentTypeId: aw.assessmentTypeId,
          weightPercentage: aw.weightPercentage,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating assessment weighting: ${e.message}`);
    }
  }

  // 13. Syllabus
  for (const sy of backup.data.syllabus) {
    try {
      await prisma.syllabus.create({
        data: {
          schoolId,
          subjectId: remap(sy.subjectId)!,
          classLevel: sy.classLevel,
          sessionId: remap(sy.sessionId)!,
          file: sy.file,
          parsedTopics: sy.parsedTopics as any,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating syllabus: ${e.message}`);
    }
  }

  // 14. ReportCardTemplates
  for (const rt of backup.data.reportCardTemplates) {
    try {
      await prisma.reportCardTemplate.create({
        data: { schoolId, appliesTo: rt.appliesTo, layoutConfig: rt.layoutConfig as any, sessionId: remap(rt.sessionId) },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating report card template: ${e.message}`);
    }
  }

  // 15. TimetableTemplates → SchoolDays, AddonPeriods
  for (const tt of backup.data.timetableTemplates) {
    try {
      const created = await prisma.timetableTemplate.create({
        data: { schoolId, name: tt.name, appliesTo: tt.appliesTo },
      });
      idMap.set(tt.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating timetable template: ${e.message}`);
    }
  }
  for (const sd of backup.data.schoolDays) {
    try {
      await prisma.schoolDay.create({
        data: { templateId: remap(sd.templateId)!, dayName: sd.dayName, dayIndex: sd.dayIndex, isTeachingDay: sd.isTeachingDay },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating school day: ${e.message}`);
    }
  }
  for (const ap of backup.data.addonPeriods) {
    try {
      await prisma.addonPeriod.create({
        data: { templateId: remap(ap.templateId)!, periodNumber: ap.periodNumber, startTime: ap.startTime, endTime: ap.endTime, periodType: ap.periodType },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating addon period: ${e.message}`);
    }
  }

  // 16. RoomTypes → Rooms
  for (const rt of backup.data.roomTypes) {
    try {
      const created = await prisma.roomType.create({
        data: { schoolId, name: rt.name },
      });
      idMap.set(rt.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating room type ${rt.name}: ${e.message}`);
    }
  }
  for (const r of backup.data.rooms) {
    try {
      await prisma.room.create({
        data: { schoolId, name: r.name, roomTypeId: remap(r.roomTypeId)!, capacity: r.capacity },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating room ${r.name}: ${e.message}`);
    }
  }

  // 17. Timetable periods, entries, subject requirements, staff availabilities
  for (const tp of backup.data.timetablePeriods) {
    try {
      const created = await prisma.timetablePeriod.create({
        data: { schoolId, name: tp.name, startTime: tp.startTime, endTime: tp.endTime },
      });
      idMap.set(tp.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating timetable period ${tp.name}: ${e.message}`);
    }
  }

  for (const te of backup.data.timetableEntries) {
    try {
      await prisma.timetableEntry.create({
        data: {
          schoolId,
          classId: remap(te.classId)!,
          periodId: remap(te.periodId)!,
          subjectId: remap(te.subjectId)!,
          staffId: remap(te.staffId)!,
          dayOfWeek: te.dayOfWeek,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating timetable entry: ${e.message}`);
    }
  }

  for (const sr of backup.data.subjectTimetableRequirements) {
    try {
      await prisma.subjectTimetableRequirement.create({
        data: {
          schoolId,
          subjectId: remap(sr.subjectId)!,
          classId: remap(sr.classId),
          classLevel: sr.classLevel,
          weeklyPeriodsRequired: sr.weeklyPeriodsRequired,
          doublePeriodAllowed: sr.doublePeriodAllowed,
          preferredTimeOfDay: sr.preferredTimeOfDay,
          isPractical: sr.isPractical,
          requiresRoomTypeId: remap(sr.requiresRoomTypeId),
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating subject requirement: ${e.message}`);
    }
  }

  for (const sa of backup.data.staffAvailabilities) {
    try {
      await prisma.staffAvailability.create({
        data: {
          schoolId,
          staffId: remap(sa.staffId)!,
          day: sa.day,
          availablePeriodIds: sa.availablePeriodIds,
          maxPeriodsPerDay: sa.maxPeriodsPerDay,
          maxPeriodsPerWeek: sa.maxPeriodsPerWeek,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating staff availability: ${e.message}`);
    }
  }

  // 18. SchoolTimetableRules
  for (const str of backup.data.schoolTimetableRules) {
    try {
      await prisma.schoolTimetableRule.create({
        data: { schoolId, ruleType: str.ruleType, parameters: str.parameters as any, isHard: str.isHard, weight: str.weight },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating timetable rule: ${e.message}`);
    }
  }

  // 19. SchoolAddons
  for (const sa of backup.data.schoolAddons) {
    try {
      await prisma.schoolAddon.create({
        data: {
          schoolId,
          addonId: sa.addonId,
          status: sa.status,
          activatedAt: new Date(sa.activatedAt),
          expiresAt: sa.expiresAt ? new Date(sa.expiresAt) : null,
          activatedVia: sa.activatedVia,
          activationCode: sa.activationCode,
          paymentId: sa.paymentId,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating school addon: ${e.message}`);
    }
  }

  // 20. LessonNotes
  for (const ln of backup.data.lessonNotes) {
    try {
      await prisma.lessonNote.create({
        data: {
          schoolId,
          subjectId: remap(ln.subjectId)!,
          classId: remap(ln.classId)!,
          termId: remap(ln.termId)!,
          syllabusId: remap(ln.syllabusId),
          topic: ln.topic,
          themeOrAspect: ln.themeOrAspect,
          duration: ln.duration,
          referenceBooks: ln.referenceBooks,
          instructionalMaterials: ln.instructionalMaterials,
          previousKnowledge: ln.previousKnowledge,
          introduction: ln.introduction,
          behaviouralObjectives: ln.behaviouralObjectives as any,
          content: ln.content,
          objectiveCoverageMap: ln.objectiveCoverageMap,
          presentationSteps: ln.presentationSteps as any,
          evaluation: ln.evaluation,
          summary: ln.summary,
          assignment: ln.assignment,
          source: ln.source,
          status: ln.status,
          createdBy: remap(ln.createdBy)!,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating lesson note: ${e.message}`);
    }
  }

  // 21. Questions → McqOptions, EssayGradingSpecs
  for (const q of backup.data.questions) {
    try {
      const created = await prisma.question.create({
        data: {
          schoolId,
          subjectId: remap(q.subjectId)!,
          classLevel: q.classLevel,
          topic: q.topic,
          type: q.type as any,
          questionGroupId: q.questionGroupId,
          text: q.text,
          marks: q.marks,
          difficulty: q.difficulty,
          source: q.source,
          status: q.status as any,
          createdBy: remap(q.createdBy)!,
          lessonNoteId: remap(q.lessonNoteId),
        },
      });
      idMap.set(q.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating question: ${e.message}`);
    }
  }
  for (const mo of backup.data.mcqOptions) {
    try {
      await prisma.mcqOption.create({
        data: { questionId: remap(mo.questionId)!, optionText: mo.optionText, isCorrect: mo.isCorrect },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating MCQ option: ${e.message}`);
    }
  }
  for (const eg of backup.data.essayGradingSpecs) {
    try {
      await prisma.essayGradingSpec.create({
        data: { questionId: remap(eg.questionId)!, modelAnswer: eg.modelAnswer, rubricPoints: eg.rubricPoints as any, gradingPrompt: eg.gradingPrompt },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating essay grading spec: ${e.message}`);
    }
  }

  // 22. Exams → ExamClasses, ExamQuestions, ExamAttempts → StudentAnswers
  for (const ex of backup.data.exams) {
    try {
      const created = await prisma.exam.create({
        data: {
          schoolId,
          subjectId: remap(ex.subjectId)!,
          classId: remap(ex.classId),
          termId: remap(ex.termId)!,
          assessmentTypeId: ex.assessmentTypeId,
          durationMinutes: ex.durationMinutes,
          shuffleEnabled: ex.shuffleEnabled,
          status: ex.status as any,
          attemptType: ex.attemptType as any,
          originalExamId: remap(ex.originalExamId),
          subAssessmentWeights: ex.subAssessmentWeights as any,
        },
      });
      idMap.set(ex.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating exam: ${e.message}`);
    }
  }
  for (const ec of backup.data.examClasses) {
    try {
      await prisma.examClass.create({
        data: { examId: remap(ec.examId)!, classId: remap(ec.classId)! },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating exam class: ${e.message}`);
    }
  }
  for (const eq of backup.data.examQuestions) {
    try {
      await prisma.examQuestion.create({
        data: { examId: remap(eq.examId)!, questionId: remap(eq.questionId)! },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating exam question: ${e.message}`);
    }
  }
  for (const ea of backup.data.examAttempts) {
    try {
      const created = await prisma.examAttempt.create({
        data: {
          examId: remap(ea.examId)!,
          studentId: remap(ea.studentId)!,
          startedAt: new Date(ea.startedAt),
          submittedAt: ea.submittedAt ? new Date(ea.submittedAt) : null,
          status: ea.status as any,
          syncStatus: ea.syncStatus as any,
          shuffledQuestionIds: ea.shuffledQuestionIds as any,
          shuffledOptionOrder: ea.shuffledOptionOrder as any,
          endsAt: ea.endsAt ? new Date(ea.endsAt) : null,
        },
      });
      idMap.set(ea.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating exam attempt: ${e.message}`);
    }
  }
  for (const sa of backup.data.studentAnswers) {
    try {
      await prisma.studentAnswer.create({
        data: {
          attemptId: remap(sa.attemptId)!,
          questionId: remap(sa.questionId)!,
          mcqSelectedOptionId: sa.mcqSelectedOptionId,
          essayResponseText: sa.essayResponseText,
          localChecksum: sa.localChecksum,
          gradedScore: sa.gradedScore,
          aiSuggestedScore: sa.aiSuggestedScore,
          aiReasoning: sa.aiReasoning,
          rubricPointMatches: sa.rubricPointMatches as any,
          finalScore: sa.finalScore,
          gradedBy: remap(sa.gradedBy),
          gradingStatus: sa.gradingStatus,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating student answer: ${e.message}`);
    }
  }

  // 23. SubjectResults
  for (const sr of backup.data.subjectResults) {
    try {
      await prisma.subjectResult.create({
        data: {
          studentId: remap(sr.studentId)!,
          subjectId: remap(sr.subjectId)!,
          termId: remap(sr.termId)!,
          assessmentScores: sr.assessmentScores as any,
          totalScore: sr.totalScore,
          grade: sr.grade,
          subjectPosition: sr.subjectPosition,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating subject result: ${e.message}`);
    }
  }

  // 24. TermResults → VerificationCodes
  for (const tr of backup.data.termResults) {
    try {
      const created = await prisma.termResult.create({
        data: {
          studentId: remap(tr.studentId)!,
          termId: remap(tr.termId)!,
          overallAverage: tr.overallAverage,
          overallPosition: tr.overallPosition,
          attendanceSummary: tr.attendanceSummary as any,
          affectiveRatings: tr.affectiveRatings as any,
          teacherComment: tr.teacherComment,
          principalComment: tr.principalComment,
          cumulativeAverage: tr.cumulativeAverage,
          status: tr.status,
          finalizedAt: tr.finalizedAt ? new Date(tr.finalizedAt) : null,
        },
      });
      idMap.set(tr.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating term result: ${e.message}`);
    }
  }
  for (const vc of backup.data.verificationCodes) {
    try {
      await prisma.verificationCode.create({
        data: {
          termResultId: remap(vc.termResultId)!,
          code: vc.code,
          status: vc.status,
          regeneratedReason: vc.regeneratedReason,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating verification code: ${e.message}`);
    }
  }

  // 25. FeeStatuses
  for (const fs of backup.data.feeStatuses) {
    try {
      await prisma.feeStatus.create({
        data: {
          studentId: remap(fs.studentId)!,
          termId: remap(fs.termId)!,
          status: fs.status,
          setBy: remap(fs.setBy),
          notes: fs.notes,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating fee status: ${e.message}`);
    }
  }

  // 26. TaughtTopics
  for (const tt of backup.data.taughtTopics) {
    try {
      await prisma.taughtTopic.create({
        data: {
          schoolId,
          classId: remap(tt.classId)!,
          subjectId: remap(tt.subjectId)!,
          curriculumTopicId: tt.curriculumTopicId,
          termId: remap(tt.termId),
          teacherId: remap(tt.teacherId)!,
          teacherMarked: tt.teacherMarked,
          captainMarked: tt.captainMarked,
          studentId: remap(tt.studentId),
          teacherMarkedAt: tt.teacherMarkedAt ? new Date(tt.teacherMarkedAt) : null,
          captainMarkedAt: tt.captainMarkedAt ? new Date(tt.captainMarkedAt) : null,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating taught topic: ${e.message}`);
    }
  }

  // 27. AddonTimetables → AddonTimetableEntries, TimetableGenerationRuns
  for (const at of backup.data.addonTimetables) {
    try {
      const created = await prisma.addonTimetable.create({
        data: {
          schoolId,
          sessionId: remap(at.sessionId)!,
          termId: remap(at.termId)!,
          templateId: remap(at.templateId)!,
          status: at.status,
          generatedAt: new Date(at.generatedAt),
          generationScore: at.generationScore,
        },
      });
      idMap.set(at.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating addon timetable: ${e.message}`);
    }
  }
  for (const ate of backup.data.addonTimetableEntries) {
    try {
      await prisma.addonTimetableEntry.create({
        data: {
          timetableId: remap(ate.timetableId)!,
          classId: remap(ate.classId)!,
          periodId: ate.periodId,
          day: ate.day,
          subjectId: remap(ate.subjectId)!,
          staffId: remap(ate.staffId),
          roomId: ate.roomId,
          isLocked: ate.isLocked,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating addon timetable entry: ${e.message}`);
    }
  }
  for (const tgr of backup.data.timetableGenerationRuns) {
    try {
      await prisma.timetableGenerationRun.create({
        data: {
          timetableId: remap(tgr.timetableId)!,
          triggeredBy: tgr.triggeredBy,
          startedAt: new Date(tgr.startedAt),
          completedAt: tgr.completedAt ? new Date(tgr.completedAt) : null,
          status: tgr.status,
          finalScore: tgr.finalScore,
          hardConstraintViolations: tgr.hardConstraintViolations,
          iterationsRun: tgr.iterationsRun,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating timetable generation run: ${e.message}`);
    }
  }

  // 28. Announcements
  for (const a of backup.data.announcements) {
    try {
      await prisma.announcement.create({
        data: {
          schoolId,
          title: a.title,
          content: a.content,
          targetRoles: a.targetRoles,
          isSticky: a.isSticky,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : null,
          expiresAt: a.expiresAt ? new Date(a.expiresAt) : null,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating announcement: ${e.message}`);
    }
  }

  // 29. Tickets → TicketMessages
  for (const t of backup.data.tickets) {
    try {
      const created = await prisma.ticket.create({
        data: {
          schoolId,
          title: t.title,
          description: t.description,
          status: t.status as any,
          priority: t.priority as any,
          category: t.category,
          createdById: remap(t.createdById)!,
          assignedToId: remap(t.assignedToId),
        },
      });
      idMap.set(t.id, created.id);
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating ticket: ${e.message}`);
    }
  }
  for (const tm of backup.data.ticketMessages) {
    try {
      await prisma.ticketMessage.create({
        data: {
          ticketId: remap(tm.ticketId)!,
          userId: remap(tm.userId)!,
          content: tm.content,
          createdAt: new Date(tm.createdAt),
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating ticket message: ${e.message}`);
    }
  }

  // 30. Notifications
  for (const n of backup.data.notifications) {
    try {
      await prisma.notification.create({
        data: {
          schoolId,
          recipientType: n.recipientType,
          recipientId: n.recipientId,
          channel: n.channel,
          eventType: n.eventType,
          title: n.title,
          content: n.content,
          isRead: n.isRead,
          readAt: n.readAt ? new Date(n.readAt) : null,
          sentAt: new Date(n.sentAt),
          deliveryStatus: n.deliveryStatus,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating notification: ${e.message}`);
    }
  }

  // 31. ConsentRecords
  for (const cr of backup.data.consentRecords) {
    try {
      await prisma.consentRecord.create({
        data: {
          schoolId,
          studentId: remap(cr.studentId)!,
          guardianId: remap(cr.guardianId),
          consentType: cr.consentType,
          consentedAt: new Date(cr.consentedAt),
          consentMethod: cr.consentMethod,
        },
      });
      totalCreated++;
    } catch (e: any) {
      errors.push(`Error creating consent record: ${e.message}`);
    }
  }

  return { success: errors.length === 0, entitiesCreated: totalCreated, errors };
}
