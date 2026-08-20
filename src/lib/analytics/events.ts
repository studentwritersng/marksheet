"use client";
import { CONVERSION_EVENTS } from "./events-config";

export function trackEvent(name: string, params: Record<string, unknown> = {}) {
  if (typeof window === "undefined" || !(window as any).gtag) return;
  (window as any).gtag("event", name, params);
}

// NDPR-safe: NO student/school/score/verification-code values allowed.
export function trackDemoRequest() {
  trackEvent("demo_request_submitted");
}
export function trackBlogRead(slug: string) {
  trackEvent("blog_read_75_percent", { post: slug });
}
export function trackVerificationLookup(success: boolean) {
  // Only aggregate success flag — never the code, name, school, or score.
  trackEvent("verification_lookup_performed", { success });
}
