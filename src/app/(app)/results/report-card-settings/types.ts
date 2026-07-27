// ─── Report Card Config ───────────────────────────────────────────────────────
// Shared types and defaults — no "use server" here so they can be imported anywhere.

export interface ReportCardConfig {
  showAttendance: boolean;
  showAffective: boolean;
  showPosition: boolean;
  showGrade: boolean;
  showRemark: boolean;
  showCumulativeAverage: boolean;
  showTeacherComment: boolean;
  showPrincipalComment: boolean;
  showStamp: boolean;
  showSignatures: boolean;
  showGradingKey: boolean;
  showPassportPhoto: boolean;
  showWatermarkLogo: boolean;
}

export const DEFAULT_RC_CONFIG: ReportCardConfig = {
  showAttendance: true,
  showAffective: true,
  showPosition: true,
  showGrade: true,
  showRemark: true,
  showCumulativeAverage: true,
  showTeacherComment: true,
  showPrincipalComment: true,
  showStamp: true,
  showSignatures: true,
  showGradingKey: true,
  showPassportPhoto: true,
  showWatermarkLogo: true,
};
