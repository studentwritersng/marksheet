# 17 — Troubleshooting

## 1. The `error.log` workflow

A root-level `error.log` file has appeared during past work when a **build/type-check fails**. Check it first when the app won't build:

```bash
Get-Content error.log          # Windows
cat error.log                  # Unix
```

It typically shows the failing file + line + a snippet, e.g.:

```
Failed to type check.
./src/app/console/(main)/landing-stats/actions.ts:66:5
Type error: Type 'Record<string, unknown>' is not assignable to type 'InputJsonValue | null | undefined'.
```

**Fix pattern:** resolve the reported type error (often a Prisma `InputJsonValue` cast — the repo convention is `as never`), then re-run `npm run build`.

> The build's type-check step can silently *hang* (no output) when it hits a hard error in some environments; kill it, run `npx tsc --noEmit` to see errors directly, fix, and retry.

## 2. Type-check / build issues

| Symptom | Fix |
|---|---|
| `error.log` mentions a type error | Fix it, then `npm run build` again |
| `tsc` reports errors in `.next/types/validator.ts` with `LayoutRoutes` mismatch | Stale generated types. Delete `.next` (`Remove-Item -Recurse .next`) and re-run `npx tsc --noEmit` |
| `Cannot find name 'LandingStat'` (or any Prisma model) | Prisma client out of date → `npx prisma generate` |
| Type `Record<string, unknown>` not assignable to `InputJsonValue` | Use the repo's `as never` cast for audit `beforeValue`/`afterValue` |
| Build hangs with no output | Usually a type error the worker swallowed. Kill, run `npx tsc --noEmit`, fix, retry |

## 3. Database issues

| Symptom | Fix |
|---|---|
| `Can't reach database server` | Check `DATABASE_URL`, is Postgres/Neon reachable? |
| `Table "x" does not exist` | Run `npx prisma db push` (schema not applied) |
| `prisma migrate dev` P3006 shadow-DB failure | Don't use `migrate dev` — use `db push` + manual migration folder ([05-migrations.md](./05-migrations.md)) |
| `db push` wants to drop data | Run `npx prisma db push --accept-data-loss` after backing up |
| Seed doesn't add expected rows | `npm run db:seed` is upsert-based; ensure schema is pushed first |

## 4. Authentication / session issues

| Symptom | Fix |
|---|---|
| `AUTH_SECRET is not set` | Fill `AUTH_SECRET` in `.env` |
| Instantly logged out | Cookie `secure` flag on http (needs HTTPS or `NODE_ENV != production`); use `http://localhost:3000` in dev |
| "Not authorised" on a console action | Session role mismatch — check the user's `role` and that the right guard is used |
| Login throttled (`Too many attempts`) | `checkLoginRateLimit` (5/email/10 min); wait, or restart dev server to clear in-memory buckets |

## 5. Runtime / feature issues

| Symptom | Likely cause |
|---|---|
| Landing stats show hardcoded fallback numbers | `resolveLandingStats()` not returning; check `landing_stats` rows exist (`prisma db push` + seed) and `enabled` flags |
| Exam/report-card actions fail | Missing/expired license → run `guardActiveLicense` path; check school `SchoolLicense` status |
| Addon feature unavailable | `isAddonActive(schoolId, name)` false — check `SchoolAddon` status and addon name match |
| Timetable generation error | Requires Timetable Generator addon + template + requirements configured |
| Result verification says invalid | Result must be **finalised** (`TermResult.status`), code active |
| Notifications not sent | Check school channel toggles (`SchoolNotificationConfig`), provider config, queue processor cron |

## 6. Lint warnings

`npm run lint` reports some known pre-existing items (e.g. `react-hooks/set-state-in-effect` in `theme-wrapper.tsx`, `@next/next/no-img-element`). These exist in untouched legacy code — fix only if your change is in the same file.

## 7. Common "gotchas" reference

- **Audit JSON casts** use `as never` (the `Prisma.InputJsonValue` type rejects `Record<string, unknown>`).
- **Multi-tenancy**: every query scoped to `ctx.schoolId`; referenced IDs validated with `findFirst({ where: { id, schoolId } })`.
- **No middleware**: guard layouts + server actions enforce auth.
- **Rate limiters are in-memory/per-process** — not shared across instances.
- **`AI_MOCK=true`** is the default in `.env.example` — features return deterministic mocks without an API key.
- **`ENCRYPTION_KEY`/`AUTH_SECRET` rotation breaks stored encrypted secrets** (AI/notification keys).

## 8. Where to look first when a page misbehaves

1. The page's server component — data loading + `generateMetadata`.
2. The relevant server action in `src/lib/<domain>/actions.ts` (guard, validation, audit, revalidate).
3. `recordAudit` rows / `/audit-log` — what the action actually changed.
4. Sentry (if configured) for thrown errors.
5. `error.log` / `npm run build` for build-time failures.