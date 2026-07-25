"use client";

import { useState } from "react";

export function CollapsibleSubject({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-outline-variant rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-surface-container-low hover:bg-surface-container transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-label-lg text-label-lg text-on-surface truncate">{title}</span>
          {badge}
        </div>
        <span className="text-on-surface-variant text-sm shrink-0">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t border-outline-variant">
          {children}
        </div>
      )}
    </div>
  );
}
