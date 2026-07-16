export type BackupMode = "config" | "full";

export interface BackupExport {
  version: 1;
  exportedAt: string;
  schoolName: string;
  mode: BackupMode;
  data: BackupData;
}

export interface BackupData {
  school: SchoolBackup | null;
  sessions: SessionBackup[];
  terms: TermBackup[];
  classes: ClassBackup[];
  subjects: SubjectBackup[];
  classSubjects: ClassSubjectBackup[];
  staff: StaffBackup[];
  users: UserBackup[];
  assignments: AssignmentBackup[];
  students: StudentBackup[];
  guardians: GuardianBackup[];
  assessmentTypes: AssessmentTypeBackup[];
  assessmentWeightings: AssessmentWeightingBackup[];
  reportCardTemplates: ReportCardTemplateBackup[];
  syllabus: SyllabusBackup[];
  lessonNotes: LessonNoteBackup[];
  questions: QuestionBackup[];
  mcqOptions: McqOptionBackup[];
  essayGradingSpecs: EssayGradingSpecBackup[];
  exams: ExamBackup[];
  examClasses: ExamClassBackup[];
  examQuestions: ExamQuestionBackup[];
  examAttempts: ExamAttemptBackup[];
  studentAnswers: StudentAnswerBackup[];
  subjectResults: SubjectResultBackup[];
  termResults: TermResultBackup[];
  verificationCodes: VerificationCodeBackup[];
  feeStatuses: FeeStatusBackup[];
  taughtTopics: TaughtTopicBackup[];
  timetablePeriods: TimetablePeriodBackup[];
  timetableEntries: TimetableEntryBackup[];
  subjectTimetableRequirements: SubjectTimetableRequirementBackup[];
  staffAvailabilities: StaffAvailabilityBackup[];
  timetableTemplates: TimetableTemplateBackup[];
  schoolDays: SchoolDayBackup[];
  addonPeriods: AddonPeriodBackup[];
  schoolTimetableRules: SchoolTimetableRuleBackup[];
  roomTypes: RoomTypeBackup[];
  rooms: RoomBackup[];
  addonTimetables: AddonTimetableBackup[];
  addonTimetableEntries: AddonTimetableEntryBackup[];
  timetableGenerationRuns: TimetableGenerationRunBackup[];
  schoolAddons: SchoolAddonBackup[];
  announcements: AnnouncementBackup[];
  tickets: TicketBackup[];
  ticketMessages: TicketMessageBackup[];
  notifications: NotificationBackup[];
  consentRecords: ConsentRecordBackup[];
}

export interface SchoolBackup {
  name: string;
  address: string | null;
  logo: string | null;
  signature: string | null;
  stamp: string | null;
  phone: string | null;
  email: string | null;
  motto: string | null;
  letterheadSettings: any;
  gradingScale: any;
  admissionFormat: string | null;
  shortcode: string | null;
  studentSequence: number;
  maintenanceMode: boolean;
  feeGateExams: boolean;
  feeGateResults: boolean;
  stage: string;
}

export interface SessionBackup { id: string; label: string; isCurrent: boolean; status: string; createdAt: string; }
export interface TermBackup { id: string; sessionId: string; name: string; startDate: string | null; endDate: string | null; isCurrent: boolean; }
export interface ClassBackup { id: string; sessionId: string; name: string; level: string; section: string; department: string; archived: boolean; }
export interface SubjectBackup { id: string; name: string; code: string | null; }
export interface ClassSubjectBackup { id: string; classId: string; subjectId: string; department: string; }
export interface StaffBackup { id: string; fullName: string; email: string; phone: string | null; image: string | null; signature: string | null; bioData: any; accountStatus: string; }
export interface UserBackup { id: string; email: string; passwordHash: string; role: string; staffId: string | null; isActive: boolean; mustChangePassword: boolean; }
export interface AssignmentBackup { id: string; staffId: string; assignmentType: string; subjectId: string | null; classId: string | null; sessionId: string | null; termId: string | null; isTemporary: boolean; startDate: string | null; endDate: string | null; createdBy: string | null; }
export interface StudentBackup { id: string; admissionNumber: string; firstName: string; middleName: string | null; lastName: string; email: string | null; dateOfBirth: string | null; ethnicity: string | null; religion: string | null; gender: string | null; passportPhoto: string | null; currentClassId: string | null; admissionDate: string | null; status: string; userId: string | null; bioData: any; isClassCaptain: boolean; isViceClassCaptain: boolean; }
export interface GuardianBackup { id: string; studentId: string; relationship: string; fullName: string; phone: string | null; email: string | null; address: string | null; isPrimaryContact: boolean; parentUserId: string | null; }
export interface AssessmentTypeBackup { id: string; name: string; code: string; parentId: string | null; sortOrder: number; }
export interface AssessmentWeightingBackup { id: string; subjectId: string | null; assessmentTypeId: string; weightPercentage: number; }
export interface ReportCardTemplateBackup { id: string; appliesTo: string | null; layoutConfig: any; sessionId: string | null; }
export interface SyllabusBackup { id: string; subjectId: string; classLevel: string; sessionId: string; file: string | null; parsedTopics: any; }
export interface LessonNoteBackup { id: string; subjectId: string; classId: string; termId: string; syllabusId: string | null; topic: string; themeOrAspect: string | null; duration: string | null; referenceBooks: string | null; instructionalMaterials: string | null; previousKnowledge: string | null; introduction: string | null; behaviouralObjectives: any; content: string | null; objectiveCoverageMap: string | null; presentationSteps: any; evaluation: string | null; summary: string | null; assignment: string | null; source: string; status: string; createdBy: string; }
export interface QuestionBackup { id: string; subjectId: string; classLevel: string | null; topic: string | null; type: string; questionGroupId: string | null; text: string; marks: number; difficulty: string | null; source: string; status: string; createdBy: string; lessonNoteId: string | null; }
export interface McqOptionBackup { id: string; questionId: string; optionText: string; isCorrect: boolean; }
export interface EssayGradingSpecBackup { id: string; questionId: string; modelAnswer: string; rubricPoints: any; gradingPrompt: string | null; }
export interface ExamBackup { id: string; subjectId: string; classId: string | null; termId: string; assessmentTypeId: string; durationMinutes: number; shuffleEnabled: boolean; status: string; attemptType: string; originalExamId: string | null; subAssessmentWeights: any; }
export interface ExamClassBackup { id: string; examId: string; classId: string; }
export interface ExamQuestionBackup { id: string; examId: string; questionId: string; }
export interface ExamAttemptBackup { id: string; examId: string; studentId: string; startedAt: string; submittedAt: string | null; status: string; syncStatus: string; shuffledQuestionIds: any; shuffledOptionOrder: any; endsAt: string | null; }
export interface StudentAnswerBackup { id: string; attemptId: string; questionId: string; mcqSelectedOptionId: string | null; essayResponseText: string | null; localChecksum: string | null; gradedScore: number | null; aiSuggestedScore: number | null; aiReasoning: string | null; rubricPointMatches: any; finalScore: number | null; gradedBy: string | null; gradingStatus: string; }
export interface SubjectResultBackup { id: string; studentId: string; subjectId: string; termId: string; assessmentScores: any; totalScore: number | null; grade: string | null; subjectPosition: number | null; }
export interface TermResultBackup { id: string; studentId: string; termId: string; overallAverage: number | null; overallPosition: number | null; attendanceSummary: any; affectiveRatings: any; teacherComment: string | null; principalComment: string | null; cumulativeAverage: number | null; status: string; finalizedAt: string | null; }
export interface VerificationCodeBackup { id: string; termResultId: string; code: string; status: string; regeneratedReason: string | null; }
export interface FeeStatusBackup { id: string; studentId: string; termId: string; status: string; setBy: string | null; notes: string | null; }
export interface TaughtTopicBackup { id: string; classId: string; subjectId: string; curriculumTopicId: string | null; termId: string | null; teacherId: string; teacherMarked: boolean; captainMarked: boolean; studentId: string | null; teacherMarkedAt: string | null; captainMarkedAt: string | null; }
export interface TimetablePeriodBackup { id: string; name: string; startTime: string; endTime: string; }
export interface TimetableEntryBackup { id: string; classId: string; periodId: string; subjectId: string; staffId: string; dayOfWeek: number; }
export interface SubjectTimetableRequirementBackup { id: string; subjectId: string; classId: string | null; classLevel: string | null; weeklyPeriodsRequired: number; doublePeriodAllowed: boolean; preferredTimeOfDay: string; isPractical: boolean; requiresRoomTypeId: string | null; }
export interface StaffAvailabilityBackup { id: string; staffId: string; day: number; availablePeriodIds: string[]; maxPeriodsPerDay: number; maxPeriodsPerWeek: number; }
export interface TimetableTemplateBackup { id: string; name: string; appliesTo: string[]; }
export interface SchoolDayBackup { id: string; templateId: string; dayName: string; dayIndex: number; isTeachingDay: boolean; }
export interface AddonPeriodBackup { id: string; templateId: string; periodNumber: number; startTime: string; endTime: string; periodType: string; }
export interface SchoolTimetableRuleBackup { id: string; ruleType: string; parameters: any; isHard: boolean; weight: number; }
export interface RoomTypeBackup { id: string; name: string; }
export interface RoomBackup { id: string; name: string; roomTypeId: string; capacity: number; }
export interface AddonTimetableBackup { id: string; sessionId: string; termId: string; templateId: string; status: string; generatedAt: string; generationScore: number; }
export interface AddonTimetableEntryBackup { id: string; timetableId: string; classId: string; periodId: string; day: number; subjectId: string; staffId: string | null; roomId: string | null; isLocked: boolean; }
export interface TimetableGenerationRunBackup { id: string; timetableId: string; triggeredBy: string; startedAt: string; completedAt: string | null; status: string; finalScore: number; hardConstraintViolations: string[]; iterationsRun: number; }
export interface SchoolAddonBackup { id: string; addonId: string; status: string; activatedAt: string; expiresAt: string | null; activatedVia: string; activationCode: string | null; paymentId: string | null; }
export interface AnnouncementBackup { id: string; title: string; content: string; targetRoles: string[]; isSticky: boolean; publishedAt: string | null; expiresAt: string | null; }
export interface TicketBackup { id: string; title: string; description: string; status: string; priority: string; category: string | null; createdById: string; assignedToId: string | null; }
export interface TicketMessageBackup { id: string; ticketId: string; userId: string; content: string; createdAt: string; }
export interface NotificationBackup { id: string; schoolId: string | null; recipientType: string; recipientId: string; channel: string; eventType: string; title: string | null; content: string; isRead: boolean; readAt: string | null; sentAt: string; deliveryStatus: string; }
export interface ConsentRecordBackup { id: string; studentId: string; guardianId: string | null; consentType: string; consentedAt: string; consentMethod: string; }
