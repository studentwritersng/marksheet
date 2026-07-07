"use client";

import { useState, useActionState } from "react";
import { createExamAction } from "@/lib/exams/actions";
import Link from "next/link";

interface ExamVM {
  id: string;
  subjectName: string;
  className: string;
  termName: string;
  assessmentTypeId: string;
  durationMinutes: number;
  questionCount: number;
  attemptCount: number;
  submittedCount: number;
}
interface SubjectVM { id: string; name: string }
interface ClassVM { id: string; name: string }
interface TermVM { id: string; name: string }
interface QuestionVM {
  id: string;
  text: string;
  type: string;
  marks: number;
  mcqOptions: { id: string; optionText: string; isCorrect: boolean }[];
}

export function ExamsList({
  exams,
  subjects,
  classes,
  terms,
  questions,
  classSubjects,
}: {
  exams: ExamVM[];
  subjects: SubjectVM[];
  classes: ClassVM[];
  terms: TermVM[];
  questions: QuestionVM[];
  classSubjects?: { classId: string; subjectId: string; subjectName: string }[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [state, formAction, pending] = useActionState(createExamAction, {});
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [selectedClass, setSelectedClass] = useState("");

  // Filter subjects by selected class (if classSubjects data available)
  const subjectsForClass = classSubjects && selectedClass
    ? classSubjects.filter((cs) => cs.classId === selectedClass).map((cs) => ({ id: cs.subjectId, name: cs.subjectName }))
    : [];

  // Fall back to all subjects if no class selected or no linkage data
  const availableSubjects = selectedClass && subjectsForClass.length > 0 ? subjectsForClass : subjects;

  // Filtered questions by subject
  const filteredQuestions = subjectFilter
    ? questions.filter((q) => q.id)
    : questions;

  const filteredExams = exams.filter((e) => {
    if (subjectFilter && e.subjectName !== subjects.find((s) => s.id === subjectFilter)?.name) return false;
    if (classFilter && e.className !== classes.find((c) => c.id === classFilter)?.name) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters & Create */}
      <div className="flex flex-wrap items-center gap-4">
        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        >
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="border border-outline-variant rounded px-3 py-2 font-body-sm text-body-sm text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary"
        >
          <option value="">All classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container transition-colors"
        >
          {showCreate ? "Cancel" : "Create Exam"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form action={formAction} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">New Exam</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Subject</label>
              <select name="subjectId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary">
                <option value="">Select subject</option>
                {availableSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Class</label>
              <select name="classId" required onChange={(e) => setSelectedClass(e.target.value)} className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary">
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Term</label>
              <select name="termId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary">
                <option value="">Select term</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Assessment type</label>
              <select name="assessmentTypeId" required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary">
                <option value="">Select type</option>
                <option value="CA1">CA 1</option>
                <option value="CA2">CA 2</option>
                <option value="CA3">CA 3</option>
                <option value="Exam">Exam</option>
              </select>
            </div>
            <div>
              <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Duration (minutes)</label>
              <input type="number" name="durationMinutes" min={1} required className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary" />
            </div>
          </div>

          {/* Question selection */}
          <div>
            <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Questions</label>
            <div className="max-h-60 overflow-y-auto border border-outline-variant rounded divide-y divide-outline-variant">
              {filteredQuestions.length === 0 && (
                <p className="p-3 font-body-sm text-body-sm text-on-surface-variant">No approved questions found. Create questions in the Question Bank first.</p>
              )}
              {filteredQuestions.map((q) => (
                <label key={q.id} className="flex items-start gap-3 p-3 hover:bg-surface-container-low cursor-pointer">
                  <input type="checkbox" name="questionIds[]" value={q.id} className="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-body-sm text-body-sm text-on-surface line-clamp-2">{q.text}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm">
                        {q.type === "mcq" ? "MCQ" : "Essay"}
                      </span>
                      <span className="font-label-sm text-label-sm text-on-surface-variant">{q.marks} marks</span>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {state.error && <p className="bg-error-container text-on-error-container font-body-sm text-body-sm px-3 py-2 rounded">{state.error}</p>}
          {state.success && <p className="bg-secondary-container text-on-secondary-container font-body-sm text-body-sm px-3 py-2 rounded">{state.success}</p>}

          <button type="submit" disabled={pending} className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container disabled:opacity-60">
            {pending ? "Creating…" : "Create Exam"}
          </button>
        </form>
      )}

      {/* Exam table */}
      <div className="overflow-x-auto bg-surface-container-lowest border border-outline-variant rounded-lg">
        <table className="w-full text-left">
          <thead className="bg-surface-container border-b border-outline-variant">
            <tr>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Subject</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Class</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Type</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Duration</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Questions</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Submitted</th>
              <th className="py-3 px-4 font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {filteredExams.map((exam) => (
              <tr key={exam.id} className="hover:bg-surface-container-low transition-colors">
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface">{exam.subjectName}</td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{exam.className}</td>
                <td className="py-3 px-4">
                  <span className="bg-surface-variant text-on-surface-variant px-2 py-0.5 rounded font-label-sm text-label-sm">{exam.assessmentTypeId}</span>
                </td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{exam.durationMinutes} min</td>
                <td className="py-3 px-4 font-body-sm text-body-sm text-on-surface-variant">{exam.questionCount}</td>
                <td className="py-3 px-4">
                  <span className="text-on-surface font-label-sm text-label-sm">{exam.submittedCount}/{exam.attemptCount}</span>
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/exams/take/${exam.id}`}
                    className="text-primary font-label-sm text-label-sm hover:underline"
                  >
                    Take exam →
                  </Link>
                </td>
              </tr>
            ))}
            {filteredExams.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">No exams found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
