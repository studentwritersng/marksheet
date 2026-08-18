export interface QuizTopicSpec {
  classLevel: string;
  term: string;
  subject: string;
  topic: string;
  count?: number; // default 5
}

export interface GeneratedQuizQuestion {
  questionText: string;
  options: string[]; // length 4
  correctIndex: number; // 0..3
  explanation?: string;
  difficulty: number; // 1..3
  points: number; // difficulty * 10
}
