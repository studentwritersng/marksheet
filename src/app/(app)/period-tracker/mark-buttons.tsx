"use client";

import { useFormStatus } from "react-dom";
import { markTeacherTaughtAction, markCaptainTaughtAction } from "@/lib/period-tracker/actions";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 bg-[#002046] text-white rounded-lg text-sm font-medium hover:bg-[#001a33] disabled:opacity-50 transition-colors"
    >
      {pending ? pendingLabel ?? "Saving…" : label}
    </button>
  );
}

export function MarkTeacherTaughtForm({
  schoolId, classId, subjectId, curriculumTopicId, termId, alreadyMarked,
}: {
  schoolId: string; classId: string; subjectId: string; curriculumTopicId: string; termId: string; alreadyMarked: boolean;
}) {
  return (
    <form
      action={async () => {
        await markTeacherTaughtAction(schoolId, classId, subjectId, curriculumTopicId, termId);
      }}
    >
      <SubmitButton label={alreadyMarked ? "Mark Again" : "Mark Taught"} pendingLabel="Marking…" />
    </form>
  );
}

export function MarkCaptainTaughtForm({
  schoolId, classId, subjectId, curriculumTopicId, teacherId, alreadyMarked,
}: {
  schoolId: string; classId: string; subjectId: string; curriculumTopicId: string; teacherId: string; alreadyMarked: boolean;
}) {
  return (
    <form
      action={async () => {
        await markCaptainTaughtAction(schoolId, classId, subjectId, curriculumTopicId, teacherId);
      }}
    >
      <SubmitButton label={alreadyMarked ? "Verified" : "Verify Taught"} pendingLabel="Verifying…" />
    </form>
  );
}
