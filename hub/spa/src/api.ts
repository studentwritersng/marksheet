export interface Branding {
  schoolName: string;
  logoUrl: string | null;
}

export interface OpenSession {
  bundleId: string;
  subjectName: string;
  classNames: string[];
  termLabel: string;
  durationMinutes: number;
  questionCount: number;
  openedAt: string | null;
}

export interface AttemptInfo {
  hubAttemptId: string;
  startedAt: string;
  submittedAt: string | null;
  endsAt: string | null;
  shuffledQuestionIds: string[] | null;
  shuffledOptionOrder: Record<string, string[]> | null;
  lastAutosaveAt: string | null;
}

export interface SavedAnswer {
  questionId: string;
  mcqSelectedOptionId?: string;
  essayResponseText?: string;
}

export interface SignInSuccess {
  ok: true;
  student: { studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null };
  exam: {
    subjectName: string;
    classNames: string[];
    termLabel: string;
    durationMinutes: number;
    questionCount: number;
  };
  questions: import("@exam-rendering/types").ExamQuestion[];
  attempt: AttemptInfo | null;
  savedAnswers: SavedAnswer[];
}

export interface SignInFailure {
  ok: false;
  error: string;
  lockoutSeconds?: number;
}

export type SignInResult = SignInSuccess | SignInFailure;

export interface StudentSessionInfo {
  bundleId: string;
  subjectName: string;
  classNames: string[];
  termLabel: string;
  durationMinutes: number;
  questionCount: number;
  openedAt: string | null;
}

export interface StudentSignInSuccess {
  ok: true;
  student: { studentId: string; admissionNumber: string; studentName: string; studentPhoto: string | null };
  sessions: StudentSessionInfo[];
}

export interface AdminSession {
  bundleId: string;
  subjectName?: string;
  termLabel?: string;
  durationMinutes?: number;
  status: "open" | "closed";
}

export interface BundlePins {
  bundleId: string;
  subjectName: string;
  roster: Array<{ admissionNumber: string; studentName: string; pin: string }>;
}

export interface IncomingAnswer {
  questionId: string;
  mcqSelectedOptionId?: string | null;
  essayResponseText?: string | null;
  clientTimestamp?: string;
  localChecksum?: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: string }).error ?? `Request failed (${res.status}).`;
    throw new Error(err);
  }
  return data as T;
}

export async function fetchOpenSessions(): Promise<OpenSession[]> {
  const data = await request<{ sessions: OpenSession[] }>("/api/open-sessions");
  return data.sessions;
}

export async function fetchBranding(): Promise<Branding> {
  try {
    return await request<Branding>("/api/branding");
  } catch {
    return { schoolName: "Exam Hub", logoUrl: null };
  }
}

export async function signIn(bundleId: string, admissionNumber: string, pin: string): Promise<SignInResult> {
  try {
    return await request<SignInResult>("/api/sign-in", {
      method: "POST",
      body: JSON.stringify({ bundleId, admissionNumber, pin }),
    });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Sign-in failed." };
  }
}

export async function studentSignIn(
  admissionNumber: string,
  pin: string,
): Promise<{ ok: true; student: StudentSignInSuccess["student"]; sessions: StudentSessionInfo[] } | { ok: false; error: string; lockoutSeconds?: number }> {
  try {
    return await request<StudentSignInSuccess>("/api/student/sign-in", {
      method: "POST",
      body: JSON.stringify({ admissionNumber, pin }),
    });
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Sign-in failed." };
  }
}

export async function fetchBundlePins(invigilatorCode: string, bundleId: string): Promise<BundlePins> {
  return request<BundlePins>(`/api/admin/bundles/${bundleId}/pins`, {
    headers: { "x-invigilator-code": invigilatorCode },
  });
}

export async function startAttempt(bundleId: string, studentId: string) {
  return request<{ ok: true; attempt: AttemptInfo } | { ok: false; error: string }>("/api/attempts/start", {
    method: "POST",
    body: JSON.stringify({ bundleId, studentId }),
  });
}

export async function tickAttempt(attemptId: string) {
  return request<{ remainingSeconds: number; expired: boolean }>(`/api/attempts/${attemptId}/tick`, {
    method: "POST",
  });
}

export async function autoSaveAttempt(attemptId: string, answers: IncomingAnswer[]) {
  return request<{ accepted: number; rejected: number }>(`/api/attempts/${attemptId}/autosave`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function submitAttempt(attemptId: string, answers: IncomingAnswer[]) {
  return request<{ ok: true; message: string } | { ok: false; error: string }>(`/api/attempts/${attemptId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}

export async function fetchAdminSessions(invigilatorCode: string): Promise<AdminSession[]> {
  const data = await request<{ sessions: AdminSession[] }>("/api/admin/sessions", {
    headers: { "x-invigilator-code": invigilatorCode },
  });
  return data.sessions;
}

export async function openAdminSession(invigilatorCode: string, bundleId: string, durationMinutes?: number) {
  return request<{ ok: true }>(`/api/admin/sessions/${bundleId}/open`, {
    method: "POST",
    headers: { "x-invigilator-code": invigilatorCode },
    body: JSON.stringify({ durationMinutes }),
  });
}

export async function closeAdminSession(invigilatorCode: string, bundleId: string) {
  return request<{ ok: true }>(`/api/admin/sessions/${bundleId}/close`, {
    method: "POST",
    headers: { "x-invigilator-code": invigilatorCode },
  });
}

export async function fetchAdminStatus(invigilatorCode: string) {
  return request<{ bundles: number; pendingSyncAttempts: number }>("/api/admin/status", {
    headers: { "x-invigilator-code": invigilatorCode },
  });
}

export async function triggerSync(invigilatorCode: string) {
  return request<{ ok: true; pulled: number; uploaded: number }>("/api/admin/sync", {
    method: "POST",
    headers: { "x-invigilator-code": invigilatorCode },
  });
}
