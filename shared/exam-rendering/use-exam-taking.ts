"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildAnswerList, orderOptions, orderQuestions, remainingFromEndsAt } from "./exam-taking-core";
import type {
  AnswerValue,
  AttemptData,
  ExamMcqOption,
  ExamQuestion,
  ExamTakingAdapters,
  SavedAnswer,
  SavedAnswersMap,
} from "./types";

export interface UseExamTakingOptions {
  questions: ExamQuestion[];
  savedAnswers: SavedAnswer[];
  attemptData: AttemptData | null;
  attemptId?: string;
  adapters: ExamTakingAdapters;
  durationMinutes: number;
  autosaveIntervalMs?: number;
}

function toAnswersMap(savedAnswers: SavedAnswer[]): SavedAnswersMap {
  const m: SavedAnswersMap = {};
  for (const a of savedAnswers) {
    m[a.questionId] = { mcqSelectedOptionId: a.mcqSelectedOptionId, essayResponseText: a.essayResponseText };
  }
  return m;
}

export function useExamTaking({
  questions: rawQuestions,
  savedAnswers,
  attemptData,
  attemptId: existingAttemptId,
  adapters,
  durationMinutes,
  autosaveIntervalMs = 30_000,
}: UseExamTakingOptions) {
  const [attemptId, setAttemptId] = useState(existingAttemptId);
  const [endsAt, setEndsAt] = useState<string | null>(attemptData?.endsAt ?? null);
  const [shuffle, setShuffle] = useState<{ ids: string[] | null; order: Record<string, string[]> | null }>({
    ids: attemptData?.shuffledQuestionIds ?? null,
    order: attemptData?.shuffledOptionOrder ?? null,
  });
  const [answers, setAnswers] = useState<SavedAnswersMap>(() => toAnswersMap(savedAnswers));
  const [essayParts, setEssayParts] = useState<Record<string, Record<string, string>>>({});
  const [remaining, setRemaining] = useState(() => {
    if (attemptData?.endsAt) {
      const diff = Math.floor((new Date(attemptData.endsAt).getTime() - Date.now()) / 1000);
      return Math.max(0, diff);
    }
    return durationMinutes * 60;
  });
  const [submitted, setSubmitted] = useState(attemptData?.status === "submitted");
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState(attemptData?.status === "submitted" ? "This exam was already submitted." : "");
  const [starting, setStarting] = useState(!existingAttemptId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [autoSaving, setAutoSaving] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const autoSaveIntervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const answersRef = useRef(answers);
  const essayPartsRef = useRef(essayParts);
  const attemptIdRef = useRef(attemptId);
  const endsAtRef = useRef(endsAt);
  const hasAutoSubmitted = useRef(false);

  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { essayPartsRef.current = essayParts; }, [essayParts]);
  useEffect(() => { attemptIdRef.current = attemptId; }, [attemptId]);
  useEffect(() => { endsAtRef.current = endsAt; }, [endsAt]);

  const orderedQuestions = useMemo(
    () => orderQuestions(rawQuestions, shuffle.ids),
    [rawQuestions, shuffle.ids],
  );

  // --- Kiosk mode ---
  useEffect(() => {
    if (starting || submitted) return;

    if (document.documentElement.requestFullscreen && !fullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
      setFullscreen(true);
    }

    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.addEventListener("popstate", handlePopState);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    const handleCopy = (e: ClipboardEvent) => { if (e.target instanceof HTMLTextAreaElement) return; e.preventDefault(); };
    const handlePaste = (e: ClipboardEvent) => { e.preventDefault(); };
    const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [starting, submitted, fullscreen]);

  // --- Timer ---
  useEffect(() => {
    if (starting || !attemptId) return;

    const runTick = async () => {
      if (adapters.tick && attemptIdRef.current) {
        try {
          const res = await adapters.tick(attemptIdRef.current);
          setRemaining(res.remainingSeconds);
          return;
        } catch {
          // fall through to local countdown
        }
      }
      if (endsAtRef.current) {
        setRemaining(remainingFromEndsAt(endsAtRef.current));
      } else {
        setRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
      }
    };

    runTick();
    intervalRef.current = setInterval(runTick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [starting, attemptId, adapters.tick]);

  // --- Auto-save ---
  useEffect(() => {
    if (starting || submitted || !attemptId) return;

    autoSaveIntervalRef.current = setInterval(async () => {
      const aId = attemptIdRef.current;
      if (!aId) return;
      const currentAnswers = answersRef.current;
      const currentParts = essayPartsRef.current;
      setAutoSaving(true);

      const answerList = buildAnswerList(currentAnswers, currentParts);
      if (answerList.length === 0) { setAutoSaving(false); return; }

      try {
        await adapters.autoSave(aId, answerList);
      } catch {
        // autosave must never crash the exam session
      }
      setAutoSaving(false);
    }, autosaveIntervalMs);

    return () => clearInterval(autoSaveIntervalRef.current);
  }, [starting, submitted, attemptId, adapters, autosaveIntervalMs]);

  const startExam = useCallback(async () => {
    if (!adapters.start) return;
    try {
      const res = await adapters.start();
      setAttemptId(res.attemptId);
      if (res.endsAt) setEndsAt(res.endsAt);
      if (res.shuffledQuestionIds) {
        setShuffle({ ids: res.shuffledQuestionIds, order: res.shuffledOptionOrder ?? null });
      }
      setStarting(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to start exam.");
    }
  }, [adapters]);

  const handleSubmit = useCallback(async () => {
    const aId = attemptIdRef.current;
    if (!aId) return;
    clearInterval(intervalRef.current);
    clearInterval(autoSaveIntervalRef.current);
    setSubmitted(true);
    const answerList = buildAnswerList(answersRef.current, essayPartsRef.current);
    try {
      const result = await adapters.submit(aId, answerList);
      setMsg(result);
    } catch (e: any) {
      setMsg(e?.message ?? "Failed to submit. Please try again.");
    }
  }, [adapters]);

  useEffect(() => {
    if (remaining > 0 || submitted || hasAutoSubmitted.current || !attemptId) return;
    hasAutoSubmitted.current = true;
    handleSubmit();
  }, [remaining, submitted, attemptId, handleSubmit]);

  const isAnswered = useCallback(
    (id: string) =>
      answers[id]?.mcqSelectedOptionId != null ||
      (answers[id]?.essayResponseText?.trim().length ?? 0) > 0 ||
      Object.values(essayParts[id] ?? {}).some((v) => v.trim().length > 0),
    [answers, essayParts],
  );

  const isSkipped = useCallback(
    (id: string) => skipped.has(id) && !isAnswered(id),
    [skipped, isAnswered],
  );

  const goTo = useCallback(
    (index: number) => {
      const currentId = orderedQuestions[currentIndex]?.id;
      if (currentId && !skipped.has(currentId) && !isAnswered(currentId)) {
        setSkipped((prev) => new Set(prev).add(currentId));
      }
      setCurrentIndex(index);
    },
    [orderedQuestions, currentIndex, skipped, isAnswered],
  );

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, orderedQuestions.length - 1));
  }, [orderedQuestions.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSkip = useCallback(() => {
    const currentId = orderedQuestions[currentIndex]?.id;
    if (currentId) setSkipped((prev) => new Set(prev).add(currentId));
    setCurrentIndex((prev) => Math.min(prev + 1, orderedQuestions.length - 1));
  }, [orderedQuestions, currentIndex]);

  const getOptions = useCallback(
    (questionId: string, options: ExamMcqOption[]) => orderOptions(questionId, options, shuffle.order),
    [shuffle.order],
  );

  return {
    attemptId,
    orderedQuestions,
    answers,
    essayParts,
    setAnswers,
    setEssayParts,
    remaining,
    starting,
    submitted,
    confirming,
    setConfirming,
    msg,
    autoSaving,
    currentIndex,
    setCurrentIndex,
    skipped,
    setSkipped,
    getOptions,
    startExam,
    handleSubmit,
    goTo,
    goNext,
    goPrev,
    handleSkip,
    isAnswered,
    isSkipped,
  };
}

export type { AnswerValue };
