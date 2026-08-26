export interface McqOption {
  text: string;
  isCorrect: boolean;
}

export function autoGradeMcq(
  selectedIndex: number | null,
  options: McqOption[],
): { correct: boolean; scoreFactor: number } {
  if (selectedIndex === null) return { correct: false, scoreFactor: 0 };
  const chosen = options[selectedIndex];
  return { correct: !!chosen?.isCorrect, scoreFactor: chosen?.isCorrect ? 1 : 0 };
}

export function validateQuestionCounts(mcq: number, essay: number): void {
  if (mcq > 20) throw new Error("MCQ questions cannot exceed 20");
  if (essay > 5) throw new Error("Essay questions cannot exceed 5");
}

export function computeTotals(
  mcqScore: number,
  essayScore: number,
  totalMarks: number,
): { totalScore: number; percentage: number } {
  const totalScore = mcqScore + essayScore;
  const percentage = totalMarks > 0 ? Math.round((totalScore / totalMarks) * 1000) / 10 : 0;
  return { totalScore, percentage };
}
