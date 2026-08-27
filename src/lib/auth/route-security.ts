/**
 * Shared security helpers: HTTP route auth guards, CSRF/origin checks, and an
 * in-memory sliding-window rate limiter.
 *
 * The rate limiter is in-memory and per-process — adequate for a single
 * instance / dev. For multi-instance production, swap `checkRateLimit` for a
 * Redis-backed limiter (e.g. Upstash) keeping the same call signature.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "./current-user";
import type { SessionPayload } from "./session";

/* ------------------------------------------------------------------ *
 * Route authentication
 * ------------------------------------------------------------------ */

export async function requireApiUser(): Promise<
  SessionPayload | NextResponse
> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

export async function requireRequestUser(
  req: Request,
): Promise<SessionPayload | { _response: NextResponse }> {
  const checked = await requireApiUser();
  if (checked instanceof NextResponse) return { _response: checked };

  // SameSite=lax already mitigates most CSRF; also reject cross-origin
  // state-changing requests (defence-in-depth).
  if (!isSameOrigin(req)) {
    return { _response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return checked;
}

export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");
  if (!host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

/**
 * Async-friendly same-origin check for use at the top of route handlers.
 * Returns true when the request is same-origin (or a non-browser client).
 */
export async function isOriginAllowed(req: Request): Promise<boolean> {
  return isSameOrigin(req);
}

/* ------------------------------------------------------------------ *
 * Rate limiting (in-memory sliding window)
 * ------------------------------------------------------------------ */

// key -> recent request timestamps in ms
const buckets = new Map<string, number[]>();

function prune(key: string, windowMs: number, now: number) {
  const arr = buckets.get(key);
  if (!arr) return;
  const cutoff = now - windowMs;
  const kept = arr.filter((t) => t > cutoff);
  if (kept.length === 0) buckets.delete(key);
  else buckets.set(key, kept);
}

/**
 * Sliding-window rate limiter keyed on an arbitrary string.
 * Returns true when the request is allowed, false when it should be blocked.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  prune(key, windowMs, now);
  const window = buckets.get(key) ?? [];
  if (window.length >= limit) return false;
  window.push(now);
  buckets.set(key, window);
  return true;
}

/** Identifies a client for rate limiting (IP, falling back to proxy-relevant header). */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip");
  return ip ?? "unknown";
}

/**
 * Rate limiter for server actions (login attempts). Server actions don't have
 * a Request object, so we key on email + a per-process salt. Returns a friendly
 * error message when throttled, or null when allowed.
 *
 * NOTE: in-memory per-instance. For multi-instance production, replace with a
 * Redis-backed limiter (Upstash) — same signature, returns string | null.
 */
export function checkLoginRateLimit(email: string): string | null {
  const perEmailLimit = 5;
  const perEmailWindowMs = 10 * 60 * 1000; // 5 attempts / 10 min per email
  const perProcessLimit = 20;
  const perProcessWindowMs = 60 * 1000; // 20 attempts / min per instance

  const key = email.trim().toLowerCase();
  if (!checkRateLimit(`login:email:${key}`, perEmailLimit, perEmailWindowMs)) {
    return "Too many attempts. Please wait 10 minutes and try again.";
  }
  if (!checkRateLimit("login:process", perProcessLimit, perProcessWindowMs)) {
    return "Too many attempts. Please try again shortly.";
  }
  return null;
}

/**
 * Rate limiter for public school-registration / signup submissions. Keyed on
 * the principal email plus a per-process ceiling to blunt automated abuse and
 * spam registrations. Returns a friendly error when throttled, or null.
 */
export function checkSignupRateLimit(email: string): string | null {
  const perEmailLimit = 5;
  const perEmailWindowMs = 60 * 60 * 1000; // 5 signups / hour per email
  const perProcessLimit = 30;
  const perProcessWindowMs = 60 * 1000; // 30 signups / min per instance

  const key = (email || "").trim().toLowerCase();
  if (key && !checkRateLimit(`signup:email:${key}`, perEmailLimit, perEmailWindowMs)) {
    return "Too many sign-up attempts for this email. Please try again later.";
  }
  if (!checkRateLimit("signup:process", perProcessLimit, perProcessWindowMs)) {
    return "Too many sign-up attempts. Please try again shortly.";
  }
  return null;
}

/**
 * Rate limiter for authenticated password-change submissions (per user + per
 * process). Returns a friendly error when throttled, or null.
 */
export function checkPasswordChangeRateLimit(email: string): string | null {
  const perUserLimit = 5;
  const perUserWindowMs = 10 * 60 * 1000; // 5 changes / 10 min per user
  const perProcessLimit = 30;
  const perProcessWindowMs = 60 * 1000; // 30 / min per instance

  const key = (email || "").trim().toLowerCase();
  if (key && !checkRateLimit(`pwchange:user:${key}`, perUserLimit, perUserWindowMs)) {
    return "Too many password-change attempts. Please wait 10 minutes.";
  }
  if (!checkRateLimit("pwchange:process", perProcessLimit, perProcessWindowMs)) {
    return "Too many requests. Please try again shortly.";
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Standard error response helpers
 * ------------------------------------------------------------------ */

export function forbidden(): NextResponse {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json(
    { error: "Too many requests. Try again shortly." },
    { status: 429 },
  );
}