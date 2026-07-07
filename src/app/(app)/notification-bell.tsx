"use client";

import { useState, useEffect, useRef } from "react";
import { markNotificationReadAction, markAllReadAction, getMyNotifications, getUnreadCount } from "@/lib/notifications/actions";
import type { NotificationVM } from "@/lib/notifications/actions";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationVM[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getUnreadCount().then(setUnread);
  }, []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getMyNotifications(10).then((n) => { setNotifications(n); setLoading(false); });
    }
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
    const { count } = await markAllReadAction();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
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
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-xl z-50 max-h-96 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant">
            <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">Notifications</span>
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
                className={`px-4 py-3 hover:bg-surface-container-low cursor-pointer transition-colors ${!n.isRead ? "bg-primary-container/10" : ""}`}
                onClick={() => !n.isRead && handleMarkRead(n.id)}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface truncate">
                      {n.title ?? n.eventType}
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                      {n.content}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant/60 mt-1">
                      {new Date(n.sentAt).toLocaleString()}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
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
