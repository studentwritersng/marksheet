"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getMyNotifications,
  markNotificationReadAction,
  markAllReadAction,
  deleteNotificationAction,
  deleteAllMyNotificationsAction,
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

  const handleDelete = async (id: string) => {
    const wasUnread = !items.find((x) => x.id === id)?.isRead;
    await deleteNotificationAction(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (wasUnread) setUnread((u) => Math.max(0, u - 1));
  };

  const handleClearAll = async () => {
    await deleteAllMyNotificationsAction();
    setItems([]);
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
      <div className="flex justify-end gap-3">
        {unread > 0 && (
          <button
            onClick={markAllReadAction}
            className="font-label-sm text-label-sm text-primary hover:underline"
          >
            Mark all read
          </button>
        )}
        <button
          onClick={handleClearAll}
          className="font-label-sm text-label-sm text-error hover:underline"
        >
          Clear all
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((n) => (
          <div
            key={n.id}
            onClick={() => markRead(n.id)}
            className={`cursor-pointer w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-4 transition-colors hover:bg-surface-container-low ${
              !n.isRead ? "border-primary/40 bg-primary-container/5" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-label-md text-label-md text-on-surface truncate">
                {n.title ?? n.eventType}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm text-on-surface-variant/70 shrink-0">
                  {new Date(n.sentAt).toLocaleString()}
                </span>
                <button
                  aria-label="Delete notification"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n.id);
                  }}
                  className="text-on-surface-variant hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1 whitespace-pre-line break-words">
              {n.content}
            </p>
            {!n.isRead && (
              <span className="mt-2 inline-block font-label-sm text-label-sm text-primary">
                Mark as read
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
