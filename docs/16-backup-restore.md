# 16 — Backup & Restore

## 1. Purpose

A school (or platform owner) can **export a full snapshot** of a school's data to a JSON file and **import/restore** it later. This supports migrating a school between environments, archiving, and disaster recovery. There are two export modes:

- **`config`** — configuration/setup data only (school, sessions, terms, classes, subjects, staff, users, assignments, assessment types/weightings, report-card templates, timetable config, addons, announcements, tickets, notifications, consent records).
- **`full`** — everything, including students, guardians, questions, exams, attempts, answers, results, verification codes, fee statuses, taught topics, and generated timetables.

## 2. Files

- `src/lib/backup/export.ts` — `exportSchoolData(schoolId, mode): BackupExport`
- `src/lib/backup/import.ts` — import/restore logic
- `src/lib/backup/types.ts` — the JSON contract (`BackupExport`, `BackupData`, ~40 typed backup record interfaces)
- UI: `src/app/console/(main)/schools/[id]/backup/page.tsx` (Platform Owner: per-school backup/restore)

## 3. Export format

```ts
interface BackupExport {
  version: 1;              // format version
  exportedAt: string;      // ISO timestamp
  schoolName: string;
  mode: "config" | "full";
  data: BackupData;        // ~40 named arrays of backup records
}
```

**Notable behaviours in `export.ts`:**
- School logo/signature/stamp images are fetched and inlined as **base64 data URIs** (when fetchable), so the export is self-contained; on fetch failure the original URL is kept.
- `User` records include `passwordHash` — restoring a school restores its user credentials as well.
- Arrays are captured from relations scoped by `schoolId` (or by parent ids for children like terms/examClasses).

## 4. Restore/import

`import.ts` writes the exported records back into a target school (typically the same or a new school). Follows the reverse-order of the export's dependencies so foreign keys resolve (school → sessions → terms → classes → ...). CUID ids are preserved, so relations between restored rows remain intact.

> **Care:** restoring overwrites/creates rows in the target school. Confirm the target is intended (test DB or the correct tenant) before running.

## 5. Using it

Platform Owner flow: `/console/schools/[id]/backup`

- Choose mode (`config` / `full`).
- **Export** → download the JSON.
- **Import** → upload a previously exported JSON to restore.

## 6. Relationship to DB-level backup

This feature is **application-level**. For full disaster recovery also keep a **Postgres-level backup**:

```bash
pg_dump <database> > backup_$(date +%Y%m%d).sql
```

And/or a scheduled Neon/Supabase automated backup. See [14-deployment.md](./14-deployment.md).

## 7. Gotchas

- Images are embedded as data URIs in full exports — large logo/signature files inflate the JSON.
- `passwordHash` is included (needed to restore logins) — treat backup files as sensitive secrets; do not commit them.
- Adding a new model/table that carries school data should also add a backup interface + export/import wiring here — otherwise that data is silently omitted from backups.
- Always test an import into a scratch database before restoring over a live tenant.