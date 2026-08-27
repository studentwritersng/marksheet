"use client";

import { useEffect, useState } from "react";

type Ad = { id: string; title: string; blobUrl: string };

export function PlatformAdPopup({ role }: { role: string }) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/platform-ads?role=${encodeURIComponent(role)}`);
        const data = await res.json();
        const ads: Ad[] = data.ads || [];
        const top = ads[0];
        if (!top) return;
        if (sessionStorage.getItem(`ad-dismissed:${top.id}`)) return;
        if (!cancelled) setAd(top);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  if (!ad) return null;

  function close() {
    sessionStorage.setItem(`ad-dismissed:${ad!.id}`, "1");
    setAd(null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={close} role="dialog" aria-modal="true">
      <div className="relative w-[90vw] max-w-[1100px] h-[85vh] max-h-[800px] bg-white rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <button onClick={close}
          className="absolute top-2 right-2 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-black/60 text-white text-lg hover:bg-black/80"
          aria-label="Close ad">×</button>
        <iframe src={ad.blobUrl} title={ad.title}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          className="w-full h-full border-0" />
      </div>
    </div>
  );
}
