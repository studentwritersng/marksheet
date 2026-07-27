"use client";

import { useActionState } from "react";
import type { ReportCardConfig } from "./types";
import { saveReportCardConfigAction } from "./actions";

interface ToggleItem {
  key: keyof ReportCardConfig;
  label: string;
  description: string;
}

const TOGGLE_GROUPS: { heading: string; items: ToggleItem[] }[] = [
  {
    heading: "Student Information",
    items: [
      { key: "showPassportPhoto", label: "Passport Photo", description: "Show student's passport photograph on the report card." },
      { key: "showPosition", label: "Position / Rank", description: "Show the student's position in class (e.g. 3rd of 42)." },
    ],
  },
  {
    heading: "Subject Results Table",
    items: [
      { key: "showGrade", label: "Grade Column", description: "Display the letter grade (A1, B2, etc.) next to each subject score." },
      { key: "showRemark", label: "Remark Column", description: "Show the grade remark (Excellent, Very Good, Credit, etc.)." },
      { key: "showGradingKey", label: "Grading Key", description: "Print the full grading scale key below the subject table." },
    ],
  },
  {
    heading: "Performance Summary",
    items: [
      { key: "showCumulativeAverage", label: "Cumulative Average", description: "Show the student's cumulative average across all terms so far." },
      { key: "showAttendance", label: "Attendance Summary", description: "Print attendance (days opened, present, absent) on the report card." },
      { key: "showAffective", label: "Affective / Psychomotor Domain", description: "Show affective/psychomotor trait ratings on the report card." },
    ],
  },
  {
    heading: "Comments",
    items: [
      { key: "showTeacherComment", label: "Class Teacher's Comment", description: "Include the class teacher's remark on the report card." },
      { key: "showPrincipalComment", label: "Principal's Comment", description: "Include the principal's remark on the report card." },
    ],
  },
  {
    heading: "Branding",
    items: [
      { key: "showWatermarkLogo", label: "Logo Watermark", description: "Show the school logo as a faint watermark behind the report card content." },
      { key: "showStamp", label: "School Stamp", description: "Print the school stamp at the bottom of the report card." },
      { key: "showSignatures", label: "Signature Lines", description: "Include signature lines for Class Teacher, Principal, and stamp area." },
    ],
  },
];

export function ReportCardSettingsClient({ config }: { config: ReportCardConfig }) {
  const [state, action, pending] = useActionState(saveReportCardConfigAction, {});

  return (
    <form action={action} className="space-y-8">
      {TOGGLE_GROUPS.map((group) => (
        <div key={group.heading} className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-surface-container-low border-b border-outline-variant">
            <h2 className="font-label-lg text-label-lg text-on-surface font-semibold">{group.heading}</h2>
          </div>
          <div className="divide-y divide-outline-variant">
            {group.items.map((item) => (
              <label
                key={item.key}
                className="flex items-start gap-4 px-5 py-3 cursor-pointer hover:bg-surface-container-low transition-colors"
              >
                <div className="flex-1">
                  <p className="font-label-md text-label-md text-on-surface">{item.label}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">{item.description}</p>
                </div>
                <div className="flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    name={item.key}
                    defaultChecked={config[item.key]}
                    className="w-5 h-5 rounded accent-primary cursor-pointer"
                  />
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="bg-[#002046] text-white font-label-md text-label-md py-2.5 px-8 rounded-lg hover:bg-[#003366] disabled:opacity-60 transition-colors"
        >
          {pending ? "Saving…" : "Save Settings"}
        </button>
        {state.success && (
          <p className="font-body-sm text-body-sm text-green-700">{state.success}</p>
        )}
        {state.error && (
          <p className="font-body-sm text-body-sm text-red-600">{state.error}</p>
        )}
      </div>
    </form>
  );
}
