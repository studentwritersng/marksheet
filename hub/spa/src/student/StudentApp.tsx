import { useState } from "react";
import { signIn, studentSignIn, type Branding, type OpenSession, type SignInSuccess, type StudentSessionInfo } from "../api";
import { useBranding } from "../branding";
import { HubShell } from "../HubShell";
import ExamScreen from "./ExamScreen";

export default function StudentApp() {
  const branding = useBranding();
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [pin, setPin] = useState("");
  const [student, setStudent] = useState<{ studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null } | null>(null);
  const [sessions, setSessions] = useState<StudentSessionInfo[]>([]);
  const [error, setError] = useState("");
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<StudentSessionInfo | null>(null);
  const [signedIn, setSignedIn] = useState<SignInSuccess | null>(null);

  const locked = lockoutSeconds > 0;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || locked) return;
    setBusy(true);
    setError("");
    const result = await studentSignIn(admissionNumber.trim(), pin.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setLockoutSeconds(result.lockoutSeconds ?? 0);
      return;
    }
    setStudent(result.student);
    setSessions(result.sessions);
    setLockoutSeconds(0);
  };

  const handleSelect = async (s: StudentSessionInfo) => {
    if (!student || busy) return;
    setBusy(true);
    setError("");
    const result = await signIn(s.bundleId, student.admissionNumber, pin.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setLockoutSeconds(result.lockoutSeconds ?? 0);
      return;
    }
    setSelected(s);
    setSignedIn(result);
  };

  const signOut = () => {
    setStudent(null);
    setSessions([]);
    setSelected(null);
    setSignedIn(null);
    setError("");
    setLockoutSeconds(0);
  };

  if (signedIn && selected) {
    return <ExamScreen session={selected as OpenSession} signIn={signedIn} />;
  }

  if (student) {
    return (
      <>
        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg p-3 shadow-lg max-w-md">
            {error}
            {locked && ` You can try again in ${lockoutSeconds} seconds.`}
          </div>
        )}
        <StudentDashboard
          branding={branding}
          student={student}
          sessions={sessions}
          busy={busy}
          onSelect={handleSelect}
          onSignOut={signOut}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center mb-6">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.schoolName} className="mx-auto mb-3 w-14 h-14 rounded-full object-contain" />
          ) : (
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary mb-3">
              <span className="material-symbols-outlined text-on-primary text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                school
              </span>
            </div>
          )}
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{branding.schoolName}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">Sign in with your admission number and PIN.</p>
        </div>

        {error && (
          <div className="bg-error-container text-on-error-container font-body-sm text-body-sm rounded-lg p-3">
            {error}
            {locked && ` You can try again in ${lockoutSeconds} seconds.`}
          </div>
        )}

        <form onSubmit={handleLogin} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
          <label className="block space-y-1">
            <span className="font-label-md text-label-md text-on-surface">Admission number</span>
            <input
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
              autoComplete="off"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="font-label-md text-label-md text-on-surface">PIN</span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary tracking-widest"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy || locked}
            className="w-full bg-primary text-on-primary font-label-lg text-label-lg rounded-lg px-4 py-3 hover:bg-primary-strong disabled:opacity-50 transition-colors"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function StudentDashboard({
  branding,
  student,
  sessions,
  busy,
  onSelect,
  onSignOut,
}: {
  branding: Branding;
  student: { studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null };
  sessions: StudentSessionInfo[];
  busy: boolean;
  onSelect: (s: StudentSessionInfo) => void;
  onSignOut: () => void;
}) {
  const firstName = student.studentName.split(" ")[0];
  const termLabel = sessions[0]?.termLabel ?? null;

  return (
    <HubShell
      branding={branding}
      badge="Student portal"
      profile={{
        name: student.studentName,
        subline: student.admissionNumber,
        avatarUrl: student.studentPhoto,
      }}
      nav={[
        { icon: "menu_book", label: "My Exams", active: true },
        { icon: "logout", label: "Sign out", onClick: onSignOut },
      ]}
    >
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-on-surface">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">{todayLabel()}</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 border border-outline-variant">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">calendar_month</span>
          <span className="text-sm font-medium text-on-surface-variant">
            {termLabel ?? "No active term"}
          </span>
        </div>
      </div>

      {/* Student info cards */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-primary">badge</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Admission No.</p>
              <p className="text-base font-semibold text-on-surface truncate">{student.admissionNumber}</p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-primary">school</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Class</p>
              <p className="text-base font-semibold text-on-surface truncate">
                {sessions[0]?.classNames.join(", ") ?? "—"}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[22px] text-primary">assignment</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Exams Available</p>
              <p className="text-base font-semibold text-on-surface truncate">{sessions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exams */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-on-surface">Available Exams</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          Select an exam to begin once the invigilator has opened the session.
        </p>

        {sessions.length === 0 ? (
          <div className="mt-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-8 text-center">
            <span
              className="material-symbols-outlined text-[40px] text-on-surface-variant"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              hourglass_empty
            </span>
            <p className="mt-3 text-base font-medium text-on-surface">No exams available right now</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Please wait for your invigilator to open an exam session.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {sessions.map((s) => (
              <div
                key={s.bundleId}
                className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 hover:shadow-md hover:border-primary-fixed-dim transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-on-surface truncate">{s.subjectName}</p>
                    <p className="mt-0.5 text-sm text-on-surface-variant truncate">{s.classNames.join(", ")}</p>
                  </div>
                  <span className="shrink-0 inline-block rounded-full bg-primary-fixed px-2.5 py-0.5 text-xs font-semibold text-on-primary-fixed-variant">
                    {s.termLabel}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4 text-sm text-on-surface-variant">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">quiz</span>
                    {s.questionCount} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">timer</span>
                    {s.durationMinutes} min
                  </span>
                </div>
                <button
                  onClick={() => onSelect(s)}
                  disabled={busy}
                  className="mt-4 w-full bg-primary text-on-primary rounded-lg px-4 py-2.5 text-sm font-semibold hover:bg-primary-container disabled:opacity-50 transition-colors"
                >
                  Start Exam
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </HubShell>
  );
}
