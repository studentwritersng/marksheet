"use client";

import { useState, useActionState } from "react";
import { createAnnouncementAction, deleteAnnouncementAction } from "./actions";
import { RichTextEditor } from "@/components/rich-text-editor";
import type { Announcement } from "@prisma/client";

export function AnnouncementsList({ announcements: initial }: { announcements: Announcement[] }) {
  const [showForm, setShowForm] = useState(false);
  const [announcements, setAnnouncements] = useState(initial);
  const [state, action, pending] = useActionState(createAnnouncementAction, {});

  async function handleDelete(id: string) {
    if (!confirm("Delete this announcement?")) return;
    const res = await deleteAnnouncementAction(id);
    if (!res.error) setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  }

  function statusLabel(a: Announcement): { text: string; cls: string } {
    const now = new Date();
    if (a.publishedAt && a.publishedAt > now) return { text: "Scheduled", cls: "bg-amber-100 text-amber-700" };
    if (a.expiresAt && a.expiresAt < now) return { text: "Expired", cls: "bg-surface-variant text-on-surface-variant" };
    if (a.publishedAt) return { text: "Active", cls: "bg-secondary-container text-on-secondary-container" };
    return { text: "Draft", cls: "bg-surface-variant text-on-surface-variant" };
  }

  return (
    <div className="space-y-6">
      <button onClick={() => setShowForm(!showForm)}
        className="bg-[#002046] text-white font-label-md text-label-md py-2 px-4 rounded hover:bg-[#003366]"
      >{showForm ? "Cancel" : "New Announcement"}</button>

      {showForm && (
        <CreateAnnouncementForm action={action} pending={pending} state={state} />
      )}

      <div className="space-y-3">
        {announcements.map((a) => {
          const st = statusLabel(a);
          return (
            <div key={a.id} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-label-md text-label-md text-on-surface font-semibold">{a.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.cls}`}>{st.text}</span>
                    {a.isSticky && <span className="rounded-full bg-primary-container text-on-primary-container px-2 py-0.5 text-[11px] font-medium">Sticky</span>}
                  </div>
                  <div className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 [&_a]:text-primary [&_a]:underline" dangerouslySetInnerHTML={{ __html: a.content }} />
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-on-surface-variant">
                    <span>Targets: {(a.targetRoles as string[]).join(", ")}</span>
                    {a.publishedAt && <span>Published: {a.publishedAt.toLocaleDateString()}</span>}
                    {a.expiresAt && <span>Expires: {a.expiresAt.toLocaleDateString()}</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(a.id)}
                  className="text-red-600 text-xs hover:underline shrink-0">Delete</button>
              </div>
            </div>
          );
        })}
        {announcements.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant py-8 text-center">No announcements yet.</p>
        )}
      </div>
    </div>
  );
}

function CreateAnnouncementForm({ action, pending, state }: {
  action: (fd: FormData) => void; pending: boolean; state: any;
}) {
  const [publishMode, setPublishMode] = useState("now");

  return (
    <form action={action} className="bg-surface-container-lowest border border-outline-variant rounded-lg p-5 space-y-4">
      <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">New Announcement</h3>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Title</label>
        <input name="title" required
          className="w-full border border-outline-variant rounded p-3 font-body-md text-body-md" />
      </div>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Content</label>
        <RichTextEditor name="content" required rows={4} placeholder="Write your announcement..." />
      </div>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Target Roles</label>
        <div className="flex gap-4">
          {["student", "staff", "parent"].map((role) => (
            <label key={role} className="flex items-center gap-2 font-body-md text-body-md">
              <input type="checkbox" name="targetRoles[]" value={role} defaultChecked className="rounded border-outline-variant text-[#002046]" />
              {role.charAt(0).toUpperCase() + role.slice(1)}s
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 font-body-md text-body-md">
          <input type="checkbox" name="isSticky" className="rounded border-outline-variant text-[#002046]" />
          Sticky (scrolls horizontally on dashboards)
        </label>
      </div>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-2">Publish</label>
        <div className="flex gap-4 mb-3">
          <label className="flex items-center gap-2 font-body-md text-body-md">
            <input type="radio" name="publishMode" value="now" checked={publishMode === "now"}
              onChange={(e) => setPublishMode(e.target.value)} className="text-[#002046]" />
            Now
          </label>
          <label className="flex items-center gap-2 font-body-md text-body-md">
            <input type="radio" name="publishMode" value="schedule" checked={publishMode === "schedule"}
              onChange={(e) => setPublishMode(e.target.value)} className="text-[#002046]" />
            Schedule
          </label>
          <label className="flex items-center gap-2 font-body-md text-body-md">
            <input type="radio" name="publishMode" value="draft" checked={publishMode === "draft"}
              onChange={(e) => setPublishMode(e.target.value)} className="text-[#002046]" />
            Save as Draft
          </label>
        </div>
        {publishMode === "schedule" && (
          <input type="datetime-local" name="scheduledAt"
            className="border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
        )}
      </div>

      <div>
        <label className="font-label-sm text-label-sm text-on-surface-variant block mb-1">Expiry Date (optional)</label>
        <input type="datetime-local" name="expiresAt"
          className="border border-outline-variant rounded p-2 font-body-sm text-body-sm" />
      </div>

      {state.error && <p className="text-red-600 font-body-sm text-body-sm">{state.error}</p>}
      {state.success && <p className="text-green-700 font-body-sm text-body-sm">{state.success}</p>}

      <button type="submit" disabled={pending}
        className="bg-[#002046] text-white font-label-md text-label-md py-2 px-6 rounded hover:bg-[#003366] disabled:opacity-60"
      >{pending ? "Publishing..." : "Create Announcement"}</button>
    </form>
  );
}
