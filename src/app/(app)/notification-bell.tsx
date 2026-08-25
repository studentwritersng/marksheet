"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { markNotificationReadAction, markAllReadAction, getMyNotifications } from "@/lib/notifications/actions";
import type { NotificationVM } from "@/lib/notifications/actions";

const POLL_INTERVAL_MS = 30_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationVM[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Poll the lightweight unread endpoint (cached server-side), not the DB.
  const refreshUnread = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUnread(typeof data.unread === "number" ? data.unread : 0);
      }
    } catch {
      // Silent — keep the last known count when the network blips.
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(refreshUnread, 0);
    const id = setInterval(refreshUnread, POLL_INTERVAL_MS);
    return () => { clearTimeout(initial); clearInterval(id); };
  }, [refreshUnread]);

  useEffect(() => {
    if (!open) return;
    const showLoader = setTimeout(() => setLoading(true), 0);
    getMyNotifications(10).then((n) => {
      setNotifications(n);
      setLoading(false);
    });
    return () => clearTimeout(showLoader);
  }, [open]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    await markNotificationReadAction(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const handleMarkAll = async () => {
    await markAllReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  };

  const handleOpen = (id: string) => {
    handleMarkRead(id);
    setOpen(false);
    router.push("/my-notifications");
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        aria-label="notifications"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-full hover:bg-surface-container-low transition-colors flex items-center justify-center relative"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 rounded-full bg-error text-[10px] text-on-error font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[calc(100vw-1rem)] max-w-sm md:w-80 md:max-w-none bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl z-[60] max-h-[80vh] flex flex-col max-md:fixed max-md:inset-x-2 max-md:top-16 max-md:mt-0 max-md:w-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-outline-variant">
            <span className="font-label-lg text-label-lg text-on-surface font-semibold">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="font-label-sm text-label-sm text-primary hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-outline-variant">
            {loading && (
              <p className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">Loading…</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="py-8 text-center font-body-sm text-body-sm text-on-surface-variant">No notifications yet.</p>
            )}
             {!loading && notifications.map((n) => (
               <div
                 key={n.id}
                 className={`px-3 py-2 hover:bg-surface-container-low cursor-pointer transition-colors ${!n.isRead ? "bg-primary-container/10" : ""}`}
                 onClick={() => handleOpen(n.id)}
               >
                 <div className="flex items-center gap-2">
                   <p className="font-body-sm text-body-sm text-on-surface truncate flex-1 min-w-0">
                     {n.content}
                   </p>
                   {!n.isRead && (
                     <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                   )}
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
}
