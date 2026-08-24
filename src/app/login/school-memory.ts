"use client";

const KEY = "marksheet_school";

/** Persist the last school the user signed into so the app can skip the
 *  school-search screen on next launch. Stored both as a cookie (read by the
 *  server component for a flash-free redirect) and localStorage (fallback). */
export function rememberSchool(shortcode: string) {
  const v = shortcode.toLowerCase();
  if (typeof document !== "undefined") {
    try {
      document.cookie = `${KEY}=${encodeURIComponent(v)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, v);
    } catch {}
  }
}

export function forgetSchool() {
  if (typeof document !== "undefined") {
    try {
      document.cookie = `${KEY}=; path=/; max-age=0`;
    } catch {}
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
  }
}
