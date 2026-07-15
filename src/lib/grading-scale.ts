export interface GradeBand {
  grade: string;
  min: number;
  max: number;
  remark?: string;
}

export const defaultGradingScale: GradeBand[] = [
  { grade: "A1", min: 75, max: 100, remark: "Excellent" },
  { grade: "B2", min: 70, max: 74, remark: "Very Good" },
  { grade: "B3", min: 65, max: 69, remark: "Good" },
  { grade: "C4", min: 60, max: 64, remark: "Credit" },
  { grade: "C5", min: 55, max: 59, remark: "Credit" },
  { grade: "C6", min: 50, max: 54, remark: "Credit" },
  { grade: "D7", min: 45, max: 49, remark: "Pass" },
  { grade: "E8", min: 40, max: 44, remark: "Pass" },
  { grade: "F9", min: 0, max: 39, remark: "Fail" },
];
