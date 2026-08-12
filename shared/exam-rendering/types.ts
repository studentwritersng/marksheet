export interface ExamMcqOption {
  id: string;
  optionText: string;
}

export interface ExamQuestion {
  id: string;
  text: string;
  type: string;
  marks: number;
  mcqOptions: ExamMcqOption[];
  hasModelAnswer?: boolean;
  questionGroupId?: string | null;
  stimulus?: { id: string; type: string; content: string } | null;
  groupInternallyShufflable?: boolean;
}

export interface AttemptData {
  status: "started" | "submitted";
  startedAt: string;
  submittedAt: string | null;
  endsAt: string | null;
  shuffledQuestionIds: string[] | null;
  shuffledOptionOrder: Record<string, string[]> | null;
  lastAutosaveAt: string | null;
}

export interface AnswerValue {
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp?: string;
  localChecksum?: string | null;
}

export interface SavedAnswer {
  questionId: string;
  mcqSelectedOptionId?: string;
  essayResponseText?: string;
}

export interface SavedAnswersMap {
  [questionId: string]: { mcqSelectedOptionId?: string; essayResponseText?: string };
}

export interface ExamTakingAdapters {
  start?(): Promise<{
    attemptId: string;
    endsAt: string;
    shuffledQuestionIds?: string[] | null;
    shuffledOptionOrder?: Record<string, string[]> | null;
  }>;
  tick?(attemptId: string): Promise<{ remainingSeconds: number; expired?: boolean }>;
  autoSave(attemptId: string, answers: AnswerValue[]): Promise<void>;
  submit(attemptId: string, answers: AnswerValue[]): Promise<string>;
}
