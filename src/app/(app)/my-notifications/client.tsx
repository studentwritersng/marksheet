"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMyNotifications,
  markNotificationReadAction,
  markAllReadAction,
  type NotificationVM,
} from "@/lib/notifications/actions";

export function NotificationsInbox() {
  const [items, setItems] = useState<NotificationVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const n = await getMyNotifications(100);
    setItems(n);
    setUnread(n.filter((x) => !x.isRead).length);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id: string) => {
    await markNotificationReadAction(id);
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, isRead: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAll = async () => {
    await markAllReadAction();
    setItems((prev) => prev.map((x) => ({ ...x, isRead: true })));
    setUnread(0);
  };

  if (loading) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Loading…</p>;
  }

  if (items.length === 0) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">No notifications yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {unread > 0 && (
        <div className="flex justify-end">
          <button
            onClick={markAll}
            className="font-label-sm text-label-sm text-primary hover:underline"
          >
            Mark all read
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <button
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`text-left w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 transition-colors hover:bg-surface-container-low ${
              !n.isRead ? "border-primary/40 bg-primary-container/5" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-md text-label-md text-on-surface truncate">
                {n.title ?? n.eventType}
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant/70 shrink-0">
                {new Date(n.sentAt).toLocaleString()}
              </span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 whitespace-pre-line break-words">
              {n.content}
            </p>
            {!n.isRead && (
              <span className="mt-2 inline-block font-label-sm text-label-sm text-primary">
                Mark as read
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
