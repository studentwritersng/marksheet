"use client";

import Link from "next/link";
import { useState } from "react";

interface BannerAnnouncement {
  id: string;
  title: string;
  content: string;
}

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, "");
}

export function AnnouncementBannerClient({
  sticky,
  regular,
}: {
  sticky: BannerAnnouncement[];
  regular: BannerAnnouncement[];
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return (
      <div className="sticky top-16 z-[1]">
        <button
          type="button"
          onClick={() => setDismissed(false)}
          className="font-label-sm text-label-sm text-on-surface-variant underline hover:text-primary"
        >
          Show announcements
        </button>
      </div>
    );
  }

  const first = regular[0];
  const remaining = regular.length - 1;

  return (
    <div className="space-y-2 sticky top-16 z-[1]">
      {sticky.length > 0 && (
        <div className="bg-primary-fixed border border-primary/30 rounded-lg overflow-hidden">
          <div className="overflow-hidden whitespace-nowrap py-2">
            <div className="inline-flex gap-12" style={{ animation: "marquee 30s linear infinite" }}>
              {sticky.map((a) => (
                <span key={a.id} className="font-label-md text-label-md text-on-primary-fixed mx-4 shrink-0">
                  <strong>{a.title}:</strong> {stripHtml(a.content)}
                </span>
              ))}
              {sticky.map((a) => (
                <span
                  key={`dup-${a.id}`}
                  className="font-label-md text-label-md text-on-primary-fixed mx-4 shrink-0"
                  aria-hidden="true"
                >
                  <strong>{a.title}:</strong> {stripHtml(a.content)}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {first && (
        <div className="relative bg-surface-container-lowest border border-outline-variant rounded-lg p-3 pr-9">
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss announcements"
            className="absolute right-2 top-2 text-on-surface-variant hover:text-on-surface text-lg leading-none"
          >
            &times;
          </button>
          <p className="font-label-md text-label-md text-on-surface font-semibold">{first.title}</p>
          <div
            className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: first.content }}
          />
          {remaining > 0 && (
            <Link
              href="/announcements"
              className="inline-block mt-1 font-label-sm text-label-sm text-primary hover:underline"
            >
              See more{remaining > 1 ? ` (${remaining})` : ""} &rarr;
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
