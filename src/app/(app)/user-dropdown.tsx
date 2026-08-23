"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";

interface UserDropdownProps {
  displayName: string;
  email: string;
  roleLabel: string;
}

function initialsFrom(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function UserDropdown({ displayName, email, roleLabel }: UserDropdownProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleOpen() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }

  function handleClose() {
    closeTimer.current = setTimeout(() => setOpen(false), 300);
  }

  return (
    <div ref={ref} className="relative" onMouseEnter={handleOpen} onMouseLeave={handleClose}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 cursor-pointer"
      >
        <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center font-label-md text-label-md text-on-surface-variant shrink-0">
          {initialsFrom(displayName)}
        </div>
        <div className="hidden sm:block text-left">
          <p className="font-label-sm text-label-sm text-on-surface leading-tight truncate max-w-[200px]">{displayName}</p>
          <p className="font-label-sm text-label-sm text-on-surface-variant">{roleLabel}</p>
        </div>
        <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-outline-variant rounded-xl shadow-lg py-2 z-50">
          <div className="px-4 py-2">
            <p className="font-body-sm text-body-sm text-on-surface font-semibold truncate">{displayName}</p>
            <p className="font-body-xs text-body-xs text-on-surface-variant truncate">{email}</p>
          </div>
          <hr className="my-1 border-outline-variant" />
          <Link
            href="/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 px-4 py-2 font-body-sm text-body-sm text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
            My Profile
          </Link>
          <hr className="my-1 border-outline-variant" />
          <button
            type="button"
            onClick={async () => {
              setOpen(false);
              await logoutAction();
            }}
            className="w-full flex items-center gap-3 px-4 py-2 font-body-sm text-body-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
