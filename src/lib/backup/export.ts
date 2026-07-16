import { prisma } from "@/lib/prisma";
import type { BackupMode, BackupExport } from "./types";

async function imageToBase64(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return url;
  }
}

export async function exportSchoolData(schoolId: string, mode: BackupMode): Promise<BackupExport> {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) throw new Error("School not found");

  const [logo, signature, stamp] = await Promise.all([
    imageToBase64(school.logo),
    imageToBase64(school.signature),
    imageToBase64(school.stamp),
  ]);

  const sessions = await prisma.session.findMany({ where: { schoolId } });
  const terms = await prisma.term.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } } });
  const classes = await prisma.class.findMany({ where: { schoolId } });
  const subjects = await prisma.subject.findMany({ where: { schoolId } });
  const classSubjects = await prisma.classSubject.findMany({ where: { schoolId } });
  const staff = await prisma.staff.findMany({ where: { schoolId } });
  const users = await prisma.user.findMany({ where: { schoolId } });
  const assignments = await prisma.assignment.findMany({ where: { schoolId } });

  // Config-only data
  const assessmentTypes = await prisma.assessmentType.findMany({ where: { schoolId } });
  const assessmentWeightings = await prisma.assessmentWeighting.findMany({ where: { schoolId } });
  const reportCardTemplates = await prisma.reportCardTemplate.findMany({ where: { schoolId } });
  const timetablePeriods = await prisma.timetablePeriod.findMany({ where: { schoolId } });
  const timetableEntries = await prisma.timetableEntry.findMany({ where: { schoolId } });
  const subjectRequirements = await prisma.subjectTimetableRequirement.findMany({ where: { schoolId } });
  const staffAvailabilities = await prisma.staffAvailability.findMany({ where: { schoolId } });
  const timetableTemplates = await prisma.timetableTemplate.findMany({ where: { schoolId } });
  const templateIds = timetableTemplates.map((t) => t.id);
  const schoolDays = await prisma.schoolDay.findMany({ where: { templateId: { in: templateIds } } });
  const addonPeriods = await prisma.addonPeriod.findMany({ where: { templateId: { in: templateIds } } });
  const schoolTimetableRules = await prisma.schoolTimetableRule.findMany({ where: { schoolId } });
  const roomTypes = await prisma.roomType.findMany({ where: { schoolId } });
  const rooms = await prisma.room.findMany({ where: { schoolId } });
  const addonTimetables = await prisma.addonTimetable.findMany({ where: { schoolId } });
  const addonTTIds = addonTimetables.map((t) => t.id);
  const addonTimetableEntries = await prisma.addonTimetableEntry.findMany({ where: { timetableId: { in: addonTTIds } } });
  const timetableGenerationRuns = await prisma.timetableGenerationRun.findMany({ where: { timetableId: { in: addonTTIds } } });
  const schoolAddons = await prisma.schoolAddon.findMany({ where: { schoolId } });
  const announcements = await prisma.announcement.findMany({ where: { schoolId } });

  // Full-mode data
  let students: Awaited<ReturnType<typeof prisma.student.findMany>> = [];
  let guardians: Awaited<ReturnType<typeof prisma.guardian.findMany>> = [];
  let syllabus: Awaited<ReturnType<typeof prisma.syllabus.findMany>> = [];
  let lessonNotes: Awaited<ReturnType<typeof prisma.lessonNote.findMany>> = [];
  let questions: Awaited<ReturnType<typeof prisma.question.findMany>> = [];
  let mcqOptions: Awaited<ReturnType<typeof prisma.mcqOption.findMany>> = [];
  let essayGradingSpecs: Awaited<ReturnType<typeof prisma.essayGradingSpec.findMany>> = [];
  let exams: Awaited<ReturnType<typeof prisma.exam.findMany>> = [];
  let examClasses: Awaited<ReturnType<typeof prisma.examClass.findMany>> = [];
  let examQuestions: Awaited<ReturnType<typeof prisma.examQuestion.findMany>> = [];
  let examAttempts: Awaited<ReturnType<typeof prisma.examAttempt.findMany>> = [];
  let studentAnswers: Awaited<ReturnType<typeof prisma.studentAnswer.findMany>> = [];
  let subjectResults: Awaited<ReturnType<typeof prisma.subjectResult.findMany>> = [];
  let termResults: Awaited<ReturnType<typeof prisma.termResult.findMany>> = [];
  let verificationCodes: Awaited<ReturnType<typeof prisma.verificationCode.findMany>> = [];
  let feeStatuses: Awaited<ReturnType<typeof prisma.feeStatus.findMany>> = [];
  let taughtTopics: Awaited<ReturnType<typeof prisma.taughtTopic.findMany>> = [];
  let tickets: Awaited<ReturnType<typeof prisma.ticket.findMany>> = [];
  let ticketMessages: Awaited<ReturnType<typeof prisma.ticketMessage.findMany>> = [];
  let notifications: Awaited<ReturnType<typeof prisma.notification.findMany>> = [];
  let consentRecords: Awaited<ReturnType<typeof prisma.consentRecord.findMany>> = [];

  if (mode === "full") {
    students = await prisma.student.findMany({ where: { schoolId } });
    const studentIds = students.map((s) => s.id);
    guardians = await prisma.guardian.findMany({ where: { studentId: { in: studentIds } } });
    syllabus = await prisma.syllabus.findMany({ where: { schoolId } });
    lessonNotes = await prisma.lessonNote.findMany({ where: { schoolId } });
    questions = await prisma.question.findMany({ where: { schoolId } });
    const questionIds = questions.map((q) => q.id);
    const examIdsForLookup = (await prisma.exam.findMany({ where: { schoolId }, select: { id: true } })).map((e) => e.id);
    mcqOptions = await prisma.mcqOption.findMany({ where: { questionId: { in: questionIds } } });
    essayGradingSpecs = await prisma.essayGradingSpec.findMany({ where: { questionId: { in: questionIds } } });
    exams = await prisma.exam.findMany({ where: { schoolId } });
    examClasses = await prisma.examClass.findMany({ where: { examId: { in: examIdsForLookup } } });
    examQuestions = await prisma.examQuestion.findMany({ where: { examId: { in: examIdsForLookup } } });
    examAttempts = await prisma.examAttempt.findMany({ where: { examId: { in: examIdsForLookup } } });
    const attemptIds = examAttempts.map((a) => a.id);
    studentAnswers = await prisma.studentAnswer.findMany({ where: { attemptId: { in: attemptIds } } });
    const termIds = terms.map((t) => t.id);
    subjectResults = await prisma.subjectResult.findMany({ where: { termId: { in: termIds } } });
    termResults = await prisma.termResult.findMany({ where: { termId: { in: termIds } } });
    const termResultIds = termResults.map((tr) => tr.id);
    verificationCodes = await prisma.verificationCode.findMany({ where: { termResultId: { in: termResultIds } } });
    feeStatuses = await prisma.feeStatus.findMany({ where: { studentId: { in: studentIds } } });
    taughtTopics = await prisma.taughtTopic.findMany({ where: { schoolId } });
    tickets = await prisma.ticket.findMany({ where: { schoolId } });
    const ticketIds = tickets.map((t) => t.id);
    ticketMessages = await prisma.ticketMessage.findMany({ where: { ticketId: { in: ticketIds } } });
    notifications = await prisma.notification.findMany({ where: { schoolId } });
    consentRecords = await prisma.consentRecord.findMany({ where: { schoolId } });
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    schoolName: school.name,
    mode,
    data: {
      school: {
        name: school.name,
        address: school.address,
        logo,
        signature,
        stamp,
        phone: school.phone,
        email: school.email,
        motto: school.motto,
        letterheadSettings: school.letterheadSettings,
        gradingScale: school.gradingScale,
        admissionFormat: school.admissionFormat,
        shortcode: school.shortcode,
        studentSequence: school.studentSequence,
        maintenanceMode: school.maintenanceMode,
        feeGateExams: school.feeGateExams,
        feeGateResults: school.feeGateResults,
        stage: school.stage,
      },
      sessions: sessions.map((s) => ({ id: s.id, label: s.label, isCurrent: s.isCurrent, status: s.status, createdAt: s.createdAt.toISOString() })),
      terms: terms.map((t) => ({ id: t.id, sessionId: t.sessionId, name: t.name, startDate: t.startDate?.toISOString() ?? null, endDate: t.endDate?.toISOString() ?? null, isCurrent: t.isCurrent })),
      classes: classes.map((c) => ({ id: c.id, sessionId: c.sessionId, name: c.name, level: c.level, section: c.section, department: c.department, archived: c.archived })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name, code: s.code })),
      classSubjects: classSubjects.map((cs) => ({ id: cs.id, classId: cs.classId, subjectId: cs.subjectId, department: cs.department })),
      staff: staff.map((s) => ({ id: s.id, fullName: s.fullName, email: s.email, phone: s.phone, image: s.image, signature: s.signature, bioData: s.bioData, accountStatus: s.accountStatus })),
      users: users.map((u) => ({ id: u.id, email: u.email, passwordHash: u.passwordHash, role: u.role, staffId: u.staffId, isActive: u.isActive, mustChangePassword: u.mustChangePassword })),
      assignments: assignments.map((a) => ({ id: a.id, staffId: a.staffId, assignmentType: a.assignmentType, subjectId: a.subjectId, classId: a.classId, sessionId: a.sessionId, termId: a.termId, isTemporary: a.isTemporary, startDate: a.startDate?.toISOString() ?? null, endDate: a.endDate?.toISOString() ?? null, createdBy: a.createdBy })),
      students: students.map((s) => ({ id: s.id, admissionNumber: s.admissionNumber, firstName: s.firstName, middleName: s.middleName, lastName: s.lastName, email: s.email, dateOfBirth: s.dateOfBirth?.toISOString() ?? null, ethnicity: s.ethnicity, religion: s.religion, gender: s.gender, passportPhoto: s.passportPhoto, currentClassId: s.currentClassId, admissionDate: s.admissionDate?.toISOString() ?? null, status: s.status, userId: s.userId, bioData: s.bioData, isClassCaptain: s.isClassCaptain, isViceClassCaptain: s.isViceClassCaptain })),
      guardians: guardians.map((g) => ({ id: g.id, studentId: g.studentId, relationship: g.relationship, fullName: g.fullName, phone: g.phone, email: g.email, address: g.address, isPrimaryContact: g.isPrimaryContact, parentUserId: g.parentUserId })),
      assessmentTypes: assessmentTypes.map((at) => ({ id: at.id, name: at.name, code: at.code, parentId: at.parentId, sortOrder: at.sortOrder })),
      assessmentWeightings: assessmentWeightings.map((aw) => ({ id: aw.id, subjectId: aw.subjectId, assessmentTypeId: aw.assessmentTypeId, weightPercentage: aw.weightPercentage })),
      reportCardTemplates: reportCardTemplates.map((rt) => ({ id: rt.id, appliesTo: rt.appliesTo, layoutConfig: rt.layoutConfig, sessionId: rt.sessionId })),
      syllabus: syllabus.map((sy) => ({ id: sy.id, subjectId: sy.subjectId, classLevel: sy.classLevel, sessionId: sy.sessionId, file: sy.file, parsedTopics: sy.parsedTopics })),
      lessonNotes: lessonNotes.map((ln) => ({ id: ln.id, subjectId: ln.subjectId, classId: ln.classId, termId: ln.termId, syllabusId: ln.syllabusId, topic: ln.topic, themeOrAspect: ln.themeOrAspect, duration: ln.duration, referenceBooks: ln.referenceBooks, instructionalMaterials: ln.instructionalMaterials, previousKnowledge: ln.previousKnowledge, introduction: ln.introduction, behaviouralObjectives: ln.behaviouralObjectives, content: ln.content, objectiveCoverageMap: ln.objectiveCoverageMap, presentationSteps: ln.presentationSteps, evaluation: ln.evaluation, summary: ln.summary, assignment: ln.assignment, source: ln.source, status: ln.status, createdBy: ln.createdBy })),
      questions: questions.map((q) => ({ id: q.id, subjectId: q.subjectId, classLevel: q.classLevel, topic: q.topic, type: q.type, questionGroupId: q.questionGroupId, text: q.text, marks: q.marks, difficulty: q.difficulty, source: q.source, status: q.status, createdBy: q.createdBy, lessonNoteId: q.lessonNoteId })),
      mcqOptions: mcqOptions.map((mo) => ({ id: mo.id, questionId: mo.questionId, optionText: mo.optionText, isCorrect: mo.isCorrect })),
      essayGradingSpecs: essayGradingSpecs.map((eg) => ({ id: eg.id, questionId: eg.questionId, modelAnswer: eg.modelAnswer, rubricPoints: eg.rubricPoints, gradingPrompt: eg.gradingPrompt })),
      exams: exams.map((ex) => ({ id: ex.id, subjectId: ex.subjectId, classId: ex.classId, termId: ex.termId, assessmentTypeId: ex.assessmentTypeId, durationMinutes: ex.durationMinutes, shuffleEnabled: ex.shuffleEnabled, status: ex.status, attemptType: ex.attemptType, originalExamId: ex.originalExamId, subAssessmentWeights: ex.subAssessmentWeights })),
      examClasses: examClasses.map((ec) => ({ id: ec.id, examId: ec.examId, classId: ec.classId })),
      examQuestions: examQuestions.map((eq) => ({ id: eq.id, examId: eq.examId, questionId: eq.questionId })),
      examAttempts: examAttempts.map((ea) => ({ id: ea.id, examId: ea.examId, studentId: ea.studentId, startedAt: ea.startedAt.toISOString(), submittedAt: ea.submittedAt?.toISOString() ?? null, status: ea.status, syncStatus: ea.syncStatus, shuffledQuestionIds: ea.shuffledQuestionIds, shuffledOptionOrder: ea.shuffledOptionOrder, endsAt: ea.endsAt?.toISOString() ?? null })),
      studentAnswers: studentAnswers.map((sa) => ({ id: sa.id, attemptId: sa.attemptId, questionId: sa.questionId, mcqSelectedOptionId: sa.mcqSelectedOptionId, essayResponseText: sa.essayResponseText, localChecksum: sa.localChecksum, gradedScore: sa.gradedScore, aiSuggestedScore: sa.aiSuggestedScore, aiReasoning: sa.aiReasoning, rubricPointMatches: sa.rubricPointMatches, finalScore: sa.finalScore, gradedBy: sa.gradedBy, gradingStatus: sa.gradingStatus })),
      subjectResults: subjectResults.map((sr) => ({ id: sr.id, studentId: sr.studentId, subjectId: sr.subjectId, termId: sr.termId, assessmentScores: sr.assessmentScores, totalScore: sr.totalScore, grade: sr.grade, subjectPosition: sr.subjectPosition })),
      termResults: termResults.map((tr) => ({ id: tr.id, studentId: tr.studentId, termId: tr.termId, overallAverage: tr.overallAverage, overallPosition: tr.overallPosition, attendanceSummary: tr.attendanceSummary, affectiveRatings: tr.affectiveRatings, teacherComment: tr.teacherComment, principalComment: tr.principalComment, cumulativeAverage: tr.cumulativeAverage, status: tr.status, finalizedAt: tr.finalizedAt?.toISOString() ?? null })),
      verificationCodes: verificationCodes.map((vc) => ({ id: vc.id, termResultId: vc.termResultId, code: vc.code, status: vc.status, regeneratedReason: vc.regeneratedReason })),
      feeStatuses: feeStatuses.map((fs) => ({ id: fs.id, studentId: fs.studentId, termId: fs.termId, status: fs.status, setBy: fs.setBy, notes: fs.notes })),
      taughtTopics: taughtTopics.map((tt) => ({ id: tt.id, classId: tt.classId, subjectId: tt.subjectId, curriculumTopicId: tt.curriculumTopicId, termId: tt.termId, teacherId: tt.teacherId, teacherMarked: tt.teacherMarked, captainMarked: tt.captainMarked, studentId: tt.studentId, teacherMarkedAt: tt.teacherMarkedAt?.toISOString() ?? null, captainMarkedAt: tt.captainMarkedAt?.toISOString() ?? null })),
      timetablePeriods: timetablePeriods.map((tp) => ({ id: tp.id, name: tp.name, startTime: tp.startTime, endTime: tp.endTime })),
      timetableEntries: timetableEntries.map((te) => ({ id: te.id, classId: te.classId, periodId: te.periodId, subjectId: te.subjectId, staffId: te.staffId, dayOfWeek: te.dayOfWeek })),
      subjectTimetableRequirements: subjectRequirements.map((sr) => ({ id: sr.id, subjectId: sr.subjectId, classId: sr.classId, classLevel: sr.classLevel, weeklyPeriodsRequired: sr.weeklyPeriodsRequired, doublePeriodAllowed: sr.doublePeriodAllowed, preferredTimeOfDay: sr.preferredTimeOfDay, isPractical: sr.isPractical, requiresRoomTypeId: sr.requiresRoomTypeId })),
      staffAvailabilities: staffAvailabilities.map((sa) => ({ id: sa.id, staffId: sa.staffId, day: sa.day, availablePeriodIds: sa.availablePeriodIds, maxPeriodsPerDay: sa.maxPeriodsPerDay, maxPeriodsPerWeek: sa.maxPeriodsPerWeek })),
      timetableTemplates: timetableTemplates.map((tt) => ({ id: tt.id, name: tt.name, appliesTo: tt.appliesTo })),
      schoolDays: schoolDays.map((sd) => ({ id: sd.id, templateId: sd.templateId, dayName: sd.dayName, dayIndex: sd.dayIndex, isTeachingDay: sd.isTeachingDay })),
      addonPeriods: addonPeriods.map((ap) => ({ id: ap.id, templateId: ap.templateId, periodNumber: ap.periodNumber, startTime: ap.startTime, endTime: ap.endTime, periodType: ap.periodType })),
      schoolTimetableRules: schoolTimetableRules.map((str) => ({ id: str.id, ruleType: str.ruleType, parameters: str.parameters, isHard: str.isHard, weight: str.weight })),
      roomTypes: roomTypes.map((rt) => ({ id: rt.id, name: rt.name })),
      rooms: rooms.map((r) => ({ id: r.id, name: r.name, roomTypeId: r.roomTypeId, capacity: r.capacity })),
      addonTimetables: addonTimetables.map((at) => ({ id: at.id, sessionId: at.sessionId, termId: at.termId, templateId: at.templateId, status: at.status, generatedAt: at.generatedAt.toISOString(), generationScore: at.generationScore })),
      addonTimetableEntries: addonTimetableEntries.map((ate) => ({ id: ate.id, timetableId: ate.timetableId, classId: ate.classId, periodId: ate.periodId, day: ate.day, subjectId: ate.subjectId, staffId: ate.staffId, roomId: ate.roomId, isLocked: ate.isLocked })),
      timetableGenerationRuns: timetableGenerationRuns.map((tgr) => ({ id: tgr.id, timetableId: tgr.timetableId, triggeredBy: tgr.triggeredBy, startedAt: tgr.startedAt.toISOString(), completedAt: tgr.completedAt?.toISOString() ?? null, status: tgr.status, finalScore: tgr.finalScore, hardConstraintViolations: tgr.hardConstraintViolations, iterationsRun: tgr.iterationsRun })),
      schoolAddons: schoolAddons.map((sa) => ({ id: sa.id, addonId: sa.addonId, status: sa.status, activatedAt: sa.activatedAt.toISOString(), expiresAt: sa.expiresAt?.toISOString() ?? null, activatedVia: sa.activatedVia, activationCode: sa.activationCode, paymentId: sa.paymentId })),
      announcements: announcements.map((a) => ({ id: a.id, title: a.title, content: a.content, targetRoles: a.targetRoles, isSticky: a.isSticky, publishedAt: a.publishedAt?.toISOString() ?? null, expiresAt: a.expiresAt?.toISOString() ?? null })),
      tickets: tickets.map((t) => ({ id: t.id, title: t.title, description: t.description, status: t.status, priority: t.priority, category: t.category, createdById: t.createdById, assignedToId: t.assignedToId })),
      ticketMessages: ticketMessages.map((tm) => ({ id: tm.id, ticketId: tm.ticketId, userId: tm.userId, content: tm.content, createdAt: tm.createdAt.toISOString() })),
      notifications: notifications.map((n) => ({ id: n.id, schoolId: n.schoolId, recipientType: n.recipientType, recipientId: n.recipientId, channel: n.channel, eventType: n.eventType, title: n.title, content: n.content, isRead: n.isRead, readAt: n.readAt?.toISOString() ?? null, sentAt: n.sentAt.toISOString(), deliveryStatus: n.deliveryStatus })),
      consentRecords: consentRecords.map((cr) => ({ id: cr.id, studentId: cr.studentId, guardianId: cr.guardianId, consentType: cr.consentType, consentedAt: cr.consentedAt.toISOString(), consentMethod: cr.consentMethod })),
    },
  };
}
