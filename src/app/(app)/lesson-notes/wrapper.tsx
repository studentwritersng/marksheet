"use client";

import { useState } from "react";
import { LessonNotesForm } from "./lesson-notes-form";
import { LessonNotesList, type ListFilter } from "./lesson-notes-list";

interface NoteVM {
  id: string;
  topic: string;
  subject: string;
  class: string;
  term: string;
  source: string;
  status: string;
  createdAt: string;
  previousKnowledge: string | null;
  introduction: string | null;
  content: string | null;
  evaluation: string | null;
  summary: string | null;
  assignment: string | null;
  behaviouralObjectives: string[] | null;
}

export function LessonNotesWrapper({
  subjects,
  classes,
  terms,
  schoolId,
  classSubjects,
  notes,
}: {
  subjects: { id: string; name: string }[];
  classes: { id: string; name: string; level: string }[];
  terms: { id: string; name: string }[];
  schoolId: string;
  classSubjects: { classId: string; subjectId: string }[];
  notes: NoteVM[];
}) {
  const [filter, setFilter] = useState<ListFilter>({});

  return (
    <div>
      <div className="mt-6">
        <LessonNotesForm
          subjects={subjects}
          classes={classes}
          terms={terms}
          schoolId={schoolId}
          classSubjects={classSubjects}
          onSelectionChange={(sel) => setFilter(sel)}
        />
      </div>

      <div className="mt-8">
        <LessonNotesList notes={notes} filter={filter} />
      </div>
    </div>
  );
}
