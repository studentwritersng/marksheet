# Platform Ad Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the platform owner (console, `platform_owner`) push uploaded full-page HTML "ads" to selected roles' dashboards as a closable, session-dismissed popup with expiry and delete controls.

**Architecture:** A new global `PlatformAd` Prisma model holds ads (blob URL of an uploaded `.html`, target roles, expiry, active flag). The console owner uploads HTML to Blob via a gated endpoint and manages ads through a console page. The admin dashboard mounts a client popup that fetches active, non-expired, role-matching ads from a public route and renders the latest one in a sandboxed `<iframe>`; closing sets a `sessionStorage` flag so it reappears next session.

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), React 19, Prisma 6 + Postgres, @vercel/blob, zod 4, Tailwind 4, vitest 3.

## Global Constraints

- Uploaded HTML is stored in Vercel Blob (separate origin) and rendered in a sandboxed `<iframe>` (`sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`); never rendered inline in the app origin.
- Management + upload endpoints are gated to `platform_owner` only.
- Upload validates extension `.html`, MIME `text/html`, and a **2 MB** size cap.
- `SessionPayload.role` values: `super_admin`, `platform_owner`, `proprietor`, `staff`, `student`, `parent`, `referral` (from `src/lib/auth/session.ts`).
- Reuse existing CSRF defence `isOriginAllowed` from `src/app/api/upload/route.ts` on the upload route.
- DB client import: `import { prisma } from "@/lib/prisma"`. Auth: `import { getCurrentUser } from "@/lib/auth/current-user"`.
- Default when multiple active ads match a role: show the **single latest** (`createdAt desc`).

---

### Task 1: Add `PlatformAd` model and sync database

**Files:**
- Modify: `prisma/schema.prisma` (append after the `Announcement` model, near line 1546)
- Test: none (schema change)

**Interfaces:**
- Produces: Prisma model `PlatformAd` accessible as `prisma.platformAd` after generation.

- [ ] **Step 1: Append the model to `prisma/schema.prisma`**

Add directly after the `Announcement` model block (after line 1546):

```prisma
model PlatformAd {
  id          String   @id @default(cuid())
  title       String
  blobUrl     String
  targetRoles String[] // subset of SessionPayload.role values
  expiresAt   DateTime? // null = never expires
  active      Boolean  @default(true)
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([active, expiresAt])
  @@map("platform_ads")
}
```

- [ ] **Step 2: Generate client and push schema**

Run:
```bash
cd marksheet && npx prisma generate && npx prisma db push --accept-data-loss
```
Expected: generation succeeds and `platform_ads` table is created in the database.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add PlatformAd model for global popup ads"
```

---

### Task 2: Pure filtering helper + tests

**Files:**
- Create: `src/lib/platform-ads.ts`
- Test: `src/lib/platform-ads.test.ts`

**Interfaces:**
- Produces: `filterActiveAdsForRole(ads: PlatformAdLike[], role: string, now: Date): PlatformAdLike[]` — returns ads where `active` is true, `expiresAt` is null or in the future, and `role` is in `targetRoles`, sorted by `createdAt desc`.
- Produces: `type PlatformAdLike = { active: boolean; expiresAt: Date | null; targetRoles: string[]; createdAt: Date }` (structural subset used by route + tests).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/platform-ads.test.ts
import { describe, it, expect } from "vitest";
import { filterActiveAdsForRole, type PlatformAdLike } from "./platform-ads";

const now = new Date("2026-08-27T00:00:00Z");
const future = new Date("2026-09-01T00:00:00Z");
const past = new Date("2026-08-01T00:00:00Z");

function ad(p: Partial<PlatformAdLike> & { id: string }): PlatformAdLike & { id: string } {
  return {
    active: true,
    expiresAt: null,
    targetRoles: ["staff"],
    createdAt: now,
    ...p,
  };
}

describe("filterActiveAdsForRole", () => {
  it("returns active, unexpired, role-matching ads newest-first", () => {
    const ads = [
      ad({ id: "old", targetRoles: ["staff"], createdAt: new Date("2026-08-20T00:00:00Z") }),
      ad({ id: "new", targetRoles: ["staff"], createdAt: new Date("2026-08-25T00:00:00Z") }),
    ];
    const res = filterActiveAdsForRole(ads, "staff", now);
    expect(res.map((a) => (a as any).id)).toEqual(["new", "old"]);
  });

  it("excludes expired ads", () => {
    const ads = [ad({ id: "exp", expiresAt: past })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(0);
  });

  it("excludes inactive ads", () => {
    const ads = [ad({ id: "off", active: false })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(0);
  });

  it("excludes ads not targeting the role", () => {
    const ads = [ad({ id: "x", targetRoles: ["student"] })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(0);
  });

  it("includes ads with null expiry", () => {
    const ads = [ad({ id: "forever", expiresAt: null })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(1);
  });

  it("includes ads expiring in the future", () => {
    const ads = [ad({ id: "soon", expiresAt: future })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd marksheet && npx vitest run src/lib/platform-ads.test.ts`
Expected: FAIL — module `./platform-ads` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/platform-ads.ts
export type PlatformAdLike = {
  active: boolean;
  expiresAt: Date | null;
  targetRoles: string[];
  createdAt: Date;
};

export function filterActiveAdsForRole(
  ads: PlatformAdLike[],
  role: string,
  now: Date,
): PlatformAdLike[] {
  return ads
    .filter((a) => a.active)
    .filter((a) => a.expiresAt === null || a.expiresAt > now)
    .filter((a) => a.targetRoles.includes(role))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd marksheet && npx vitest run src/lib/platform-ads.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/platform-ads.ts src/lib/platform-ads.test.ts
git commit -m "feat: add pure helper to filter active ads by role"
```

---

### Task 3: Gated HTML upload endpoint

**Files:**
- Create: `src/app/api/console/ads/upload/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/auth/current-user`; `isOriginAllowed`, `checkRateLimit`, `clientKey`, `tooManyRequests` from `@/lib/auth/route-security`.
- Produces: `POST` handler returning `{ url: string }` on success, or `{ error }` with appropriate status.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/console/ads/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  checkRateLimit,
  clientKey,
  isOriginAllowed,
  tooManyRequests,
} from "@/lib/auth/route-security";

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  if (!(await isOriginAllowed(req))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(`console-ad-upload:${clientKey(req)}`, 30, 60_000)) {
    return tooManyRequests();
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided." }, { status: 400 });
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 2 MB)." }, { status: 413 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (ext !== ".html") {
      return NextResponse.json({ error: "Only .html files are allowed." }, { status: 415 });
    }
    const mime = (file.type || "").toLowerCase();
    if (mime !== "text/html") {
      return NextResponse.json({ error: "File contents are not text/html." }, { status: 415 });
    }
    if (file.name.includes("/") || file.name.includes("\\") || file.name.includes("..")) {
      return NextResponse.json({ error: "Unsupported file name." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 2 MB)." }, { status: 413 });
    }

    const stem = file.name.replace(/\.html$/i, "");
    const safeStem = stem.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "ad";
    const filename = `ad-${safeStem}-${Date.now()}.html`;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import("@vercel/blob");
      const blob = await put(filename, buffer, {
        access: "public",
        contentType: "text/html",
      });
      return NextResponse.json({ url: blob.url });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    return NextResponse.json({ url: `/uploads/${filename}` });
  } catch (err) {
    console.error("Console ad upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Smoke test the route (manual, after Task 6 UI exists or via curl)**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "ads/upload" || echo "typecheck-ok"
```
Expected: no type errors referencing the new route.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/console/ads/upload/route.ts
git commit -m "feat: add gated HTML upload endpoint for platform ads"
```

---

### Task 4: Public fetch endpoint for the dashboard popup

**Files:**
- Create: `src/app/api/platform-ads/route.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma`; `filterActiveAdsForRole` from `@/lib/platform-ads`.
- Produces: `GET ?role=...` returning `{ ads: { id, title, blobUrl }[] }` — the active, unexpired, role-matching ads (newest first). Audience is public marketing content, so no auth beyond the `role` param.

- [ ] **Step 1: Write the route**

```ts
// src/app/api/platform-ads/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { filterActiveAdsForRole } from "@/lib/platform-ads";

const VALID_ROLES = [
  "super_admin",
  "platform_owner",
  "proprietor",
  "staff",
  "student",
  "parent",
  "referral",
];

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get("role") || "";
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ ads: [] });
  }

  const rows = await prisma.platformAd.findMany({
    where: { active: true },
    select: { id: true, title: true, blobUrl: true, expiresAt: true, targetRoles: true, createdAt: true },
  });

  const now = new Date();
  const filtered = filterActiveAdsForRole(rows as any, role, now).map((a) => ({
    id: (a as any).id,
    title: (a as any).title,
    blobUrl: (a as any).blobUrl,
  }));

  return NextResponse.json({ ads: filtered });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "platform-ads/route" || echo "typecheck-ok"
```
Expected: no type errors referencing the new route.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/platform-ads/route.ts
git commit -m "feat: add public endpoint returning role-matched active ads"
```

---

### Task 5: Console server actions (create / delete / update)

**Files:**
- Create: `src/app/console/(main)/ads/actions.ts`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/auth/current-user`; `prisma` from `@/lib/prisma`; `zod` for validation.
- Produces:
  - `createPlatformAd(input: { title: string; blobUrl: string; targetRoles: string[]; expiresAt: string | null; active: boolean }): Promise<{ error?: string; id?: string }>`
  - `deletePlatformAd(id: string): Promise<{ error?: string }>`
  - `updatePlatformAd(id: string, patch: { expiresAt?: string | null; active?: boolean }): Promise<{ error?: string }>`
  All require `platform_owner`; return `{ error }` otherwise.

- [ ] **Step 1: Write the actions**

```ts
// src/app/console/(main)/ads/actions.ts
"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";

const ROLES = [
  "super_admin",
  "platform_owner",
  "proprietor",
  "staff",
  "student",
  "parent",
  "referral",
] as const;

const createSchema = z.object({
  title: z.string().min(1).max(200),
  blobUrl: z.string().url(),
  targetRoles: z.array(z.enum(ROLES)).min(1, "Select at least one role"),
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
});

const updateSchema = z.object({
  expiresAt: z.string().datetime().nullable().optional(),
  active: z.boolean().optional(),
});

function ownerOnly() {
  return getCurrentUser().then((u) =>
    u && u.role === "platform_owner" ? u : null,
  );
}

export async function createPlatformAd(input: unknown) {
  const user = await ownerOnly();
  if (!user) return { error: "Unauthorized" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const created = await prisma.platformAd.create({
    data: {
      title: parsed.data.title,
      blobUrl: parsed.data.blobUrl,
      targetRoles: parsed.data.targetRoles,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      active: parsed.data.active,
      createdById: user.userId,
    },
  });
  return { id: created.id };
}

export async function deletePlatformAd(id: string) {
  const user = await ownerOnly();
  if (!user) return { error: "Unauthorized" };
  await prisma.platformAd.deleteMany({ where: { id } });
  return {};
}

export async function updatePlatformAd(id: string, patch: unknown) {
  const user = await ownerOnly();
  if (!user) return { error: "Unauthorized" };
  const parsed = updateSchema.safeParse(patch);
  if (!parsed.success) return { error: "Invalid input" };
  const data: Record<string, unknown> = {};
  if (parsed.data.expiresAt !== undefined) {
    data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  }
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  await prisma.platformAd.updateMany({ where: { id }, data });
  return {};
}
```

- [ ] **Step 2: Typecheck**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "ads/actions" || echo "typecheck-ok"
```
Expected: no type errors referencing the actions file.

- [ ] **Step 3: Commit**

```bash
git add "src/app/console/(main)/ads/actions.ts"
git commit -m "feat: add console server actions for platform ads"
```

---

### Task 6: Console Ads management UI (page + client)

**Files:**
- Create: `src/app/console/(main)/ads/page.tsx` (server component)
- Create: `src/app/console/(main)/ads/client.tsx` (client component)

**Interfaces:**
- Consumes (client): `createPlatformAd`, `deletePlatformAd`, `updatePlatformAd` from `./actions`; uploads HTML via `POST /api/console/ads/upload`.
- Consumes (page): `prisma.platformAd.findMany` ordered by `createdAt desc` to seed the client list.
- Produces: A console page listing ads (title, status, roles, expiry, delete + edit-expiry) and an upload form (title, HTML file, role checkboxes, expiry date, active toggle).

- [ ] **Step 1: Write the page (server component)**

```tsx
// src/app/console/(main)/ads/page.tsx
import { prisma } from "@/lib/prisma";
import { ConsoleAdsClient } from "./client";

export const dynamic = "force-dynamic";

export default async function ConsoleAdsPage() {
  const ads = await prisma.platformAd.findMany({
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Ads</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload full-page HTML ads that pop up on selected roles' dashboards.
        </p>
      </div>
      <ConsoleAdsClient initialAds={ads} />
    </div>
  );
}
```

- [ ] **Step 2: Write the client component**

```tsx
// src/app/console/(main)/ads/client.tsx
"use client";

import { useState } from "react";
import { createPlatformAd, deletePlatformAd, updatePlatformAd } from "./actions";

const ROLES = [
  "super_admin",
  "platform_owner",
  "proprietor",
  "staff",
  "student",
  "parent",
  "referral",
] as const;

type Ad = {
  id: string;
  title: string;
  blobUrl: string;
  targetRoles: string[];
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
};

function statusOf(a: Ad): { text: string; cls: string } {
  const now = new Date();
  if (!a.active) return { text: "Inactive", cls: "bg-slate-700 text-slate-200" };
  if (a.expiresAt && a.expiresAt < now) return { text: "Expired", cls: "bg-slate-700 text-slate-300" };
  return { text: "Active", cls: "bg-emerald-600 text-white" };
}

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  const dt = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return dt.toISOString().slice(0, 16);
}

export function ConsoleAdsClient({ initialAds }: { initialAds: Ad[] }) {
  const [ads, setAds] = useState<Ad[]>(initialAds as any);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function toggleRole(r: string) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!file) return setMsg("Choose an .html file.");
    if (roles.length === 0) return setMsg("Select at least one role.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/console/ads/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      const created = await createPlatformAd({
        title,
        blobUrl: data.url,
        targetRoles: roles,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        active,
      });
      if (created.error) throw new Error(created.error);
      setMsg("Ad created.");
      setTitle(""); setFile(null); setRoles([]); setExpiresAt(""); setActive(true);
      window.location.reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this ad?")) return;
    const res = await deletePlatformAd(id);
    if (!res.error) setAds((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleExpiry(id: string, value: string) {
    const res = await updatePlatformAd(id, {
      expiresAt: value ? new Date(value).toISOString() : null,
    });
    if (!res.error) {
      setAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, expiresAt: value ? new Date(value) : null } : a)),
      );
    }
  }

  async function handleToggle(id: string, next: boolean) {
    const res = await updatePlatformAd(id, { active: next });
    if (!res.error) setAds((prev) => prev.map((a) => (a.id === id ? { ...a, active: next } : a)));
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="bg-[#0f1525] border border-white/10 rounded-lg p-5 space-y-4 max-w-2xl">
        <h2 className="text-lg font-semibold text-white">New Ad</h2>
        <input className="w-full bg-[#0a0e1a] text-white border border-white/10 rounded px-3 py-2"
          placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <input type="file" accept=".html,text/html" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-white" required />
        <div>
          <p className="text-sm text-slate-300 mb-2">Target roles</p>
          <div className="flex flex-wrap gap-2">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1 text-sm text-white bg-[#0a0e1a] border border-white/10 rounded px-2 py-1">
                <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                {r}
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <label className="text-sm text-slate-300">Expiry (optional)</label>
          <input type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
            className="bg-[#0a0e1a] text-white border border-white/10 rounded px-3 py-2" />
        </div>
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
        <button type="submit" disabled={busy}
          className="bg-emerald-600 text-white rounded px-4 py-2 disabled:opacity-50">
          {busy ? "Saving…" : "Create Ad"}
        </button>
        {msg && <p className="text-sm text-amber-300">{msg}</p>}
      </form>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Existing Ads</h2>
        {ads.length === 0 && <p className="text-slate-400 text-sm">No ads yet.</p>}
        {ads.map((a) => {
          const st = statusOf(a);
          return (
            <div key={a.id} className="bg-[#0f1525] border border-white/10 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-white">{a.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${st.cls}`}>{st.text}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Targets: {a.targetRoles.join(", ")}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[11px] text-slate-400">Expiry:</span>
                    <input type="datetime-local" defaultValue={toLocalInput(a.expiresAt)}
                      onBlur={(e) => handleExpiry(a.id, e.target.value)}
                      className="bg-[#0a0e1a] text-white border border-white/10 rounded px-2 py-1 text-xs" />
                    <label className="flex items-center gap-1 text-xs text-white">
                      <input type="checkbox" defaultChecked={a.active} onChange={(e) => handleToggle(a.id, e.target.checked)} /> Active
                    </label>
                    <a href={a.blobUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-400 underline">Preview</a>
                  </div>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-red-400 text-xs hover:underline shrink-0">Delete</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "ads/client\|ads/page" || echo "typecheck-ok"
```
Expected: no type errors referencing the new files.

- [ ] **Step 4: Commit**

```bash
git add "src/app/console/(main)/ads/page.tsx" "src/app/console/(main)/ads/client.tsx"
git commit -m "feat: add console UI to manage dashboard ads"
```

---

### Task 7: Dashboard popup component + mount

**Files:**
- Create: `src/components/platform-ad-popup.tsx`
- Modify: `src/app/(app)/dashboard/page.tsx` (import + render with `user.role`)

**Interfaces:**
- Consumes: `GET /api/platform-ads?role=...` returning `{ ads: { id, title, blobUrl }[] }`.
- Produces: A client component `<PlatformAdPopup role={string} />` that shows the latest matching ad in a sandboxed wide iframe modal; close sets `sessionStorage["ad-dismissed:<id>"]`.

- [ ] **Step 1: Write the popup component**

```tsx
// src/components/platform-ad-popup.tsx
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
```

- [ ] **Step 2: Mount it in the dashboard**

In `src/app/(app)/dashboard/page.tsx`:
- Add to the top imports (after the existing imports):
  ```ts
  import { PlatformAdPopup } from "@/components/platform-ad-popup";
  ```
- Render it once near the top of the returned JSX (just inside the root `<section>` of the role-specific return you are targeting — e.g. the `super_admin`/`platform_owner` branch and the main `return`). Simplest: add it as the first child of the main dashboard `<section>` returned for non-super-admin users, and also for the super-admin branch. To cover "every admin", add it to the primary dashboard return:
  ```tsx
  <section className="flex flex-col gap-stack-lg">
    <PlatformAdPopup role={user.role} />
    {/* ...existing content... */}
  ```
  Do this for each `return (...)` that renders the admin dashboard (the `super_admin`/`platform_owner` branch and the default `return`).

- [ ] **Step 3: Typecheck**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "platform-ad-popup\|dashboard/page" || echo "typecheck-ok"
```
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/platform-ad-popup.tsx "src/app/(app)/dashboard/page.tsx"
git commit -m "feat: render session-dismissed ad popup on admin dashboard"
```

---

### Task 8: Console sidebar nav entry

**Files:**
- Modify: `src/app/console/(main)/sidebar.tsx:18` (add a nav item to the `navItems` array)

**Interfaces:**
- Produces: A "Dashboard Ads" link at `/console/ads` so the owner can reach Task 6's page.

- [ ] **Step 1: Add the nav item**

In the `navItems` array, after the `"Audit Log"` entry, add:
```ts
  { label: "Dashboard Ads", href: "/console/ads", icon: "campaign" },
```

- [ ] **Step 2: Typecheck / lint**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json 2>&1 | grep "sidebar" || echo "typecheck-ok"
```
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/console/(main)/sidebar.tsx"
git commit -m "feat: add Dashboard Ads link to console sidebar"
```

---

### Task 9: Integration verification

**Files:** none (verification only)

- [ ] **Step 1: Run full typecheck + unit tests**

```bash
cd marksheet && npx tsc --noEmit -p tsconfig.json && npx vitest run src/lib/platform-ads.test.ts
```
Expected: typecheck clean; 6 platform-ads tests PASS.

- [ ] **Step 2: Manual end-to-end (dev server)**

Run `cd marksheet && npm run dev`, then:
1. Log in as `platform_owner` at `/console`; open "Dashboard Ads"; upload a small `.html` file containing a visible heading and a `<script>console.log('ad')</script>`; select role `staff`; set an expiry in the future; Create.
2. Log in as a `staff` (or `proprietor`) user at the app dashboard — the popup should appear as a wide modal; the script's console log should fire (isolated origin).
3. Click × — popup closes and stays closed while navigating pages this session.
4. Log out and back in — popup reappears.
5. Log in as a role NOT selected — no popup.
6. In console, set the ad's expiry to the past (or uncheck Active) — popup stops appearing. Delete the ad — it disappears from the list.

- [ ] **Step 3: Commit verification note**

```bash
git log --oneline -8
```
Expected: the eight feature commits are present.

---

## Self-Review Notes

- **Spec coverage:** Model (Task 1), upload (Task 3), fetch route (Task 4), console actions (Task 5), console UI incl. role checkboxes + expiry + delete (Task 6), dashboard popup + session dismissal (Task 7), nav entry (Task 8), expiry/active behavior (Tasks 5–6), security (sandbox iframe + gated endpoints in Tasks 3/5). All spec requirements mapped.
- **No placeholders:** every code step contains full implementation.
- **Type consistency:** `filterActiveAdsForRole(ads, role, now)` signature matches between Task 2 (def) and Task 4 (use). Action signatures (`createPlatformAd`, `deletePlatformAd`, `updatePlatformAd`) match between Task 5 (def) and Task 6 (use). `PlatformAdPopup role={user.role}` matches `user.role` from `getCurrentUser` in the dashboard (Task 7).
