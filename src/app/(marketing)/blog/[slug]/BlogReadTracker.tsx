"use client";

import { useEffect, useRef } from "react";
import { trackBlogRead } from "@/lib/analytics/events";

/**
 * Fires `trackBlogRead(slug)` once when the reader scrolls past 75% of the
 * document. NDPR-safe: only the post slug (not reader identity) is sent.
 */
export function BlogReadTracker({ slug }: { slug: string }) {
  const firedRef = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (firedRef.current) return;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = window.scrollY / scrollable;
      if (progress >= 0.75) {
        firedRef.current = true;
        trackBlogRead(slug);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [slug]);

  return null;
}
