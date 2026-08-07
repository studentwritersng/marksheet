# 14 — Deployment

## 1. Overview

The app deploys to either **Vercel** (managed) or a **self-hosted server** (CyberPanel + OpenLiteSpeed + PM2). The database is managed **PostgreSQL** (Neon recommended, Supabase or local as alternatives). A full infrastructure walkthrough for the self-hosted path already lives in the repo-root `DEPLOY.md` — this document is the distilled, current picture plus the Vercel path.

```
                    public domain(s)
                           │
                 reverse proxy (Vercel edge / OpenLiteSpeed)
                           │
                 Next.js (Node) on PM2 or serverless
                           │
                  PostgreSQL (Neon / Supabase / local)
```

## 2. Environment variables (production)

Create `.env` on the server (or set as Vercel Environment Variables). Names:

- `DATABASE_URL` — Postgres connection string (`?sslmode=require` for hosted).
- `AUTH_SECRET` — 64-char hex (HMAC session signing).
- `ENCRYPTION_KEY` — separate key for at-rest secret/AI-key encryption (falls back to `AUTH_SECRET`; keep stable).
- `AI_BASE_URL`, `AI_API_KEY`, `AI_DEFAULT_MODEL`, `AI_MOCK`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET` — bearer auth for internal job endpoints (e.g. notification queue).
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob for file uploads.
- Sentry vars (via Sentry SDK / build plugin).

Generate a secret: `openssl rand -hex 32`.

## 3. Self-hosted (CyberPanel + PM2) — condensed

Full step-by-step in `DEPLOY.md`. Quick path:

```bash
cd /home/<user>/public_html/marksheet
npm install
cp .env.production .env        # fill DATABASE_URL, AUTH_SECRET, ...
npx prisma generate
npx prisma db push             # create/update all tables
npm run db:seed                # optional demo data
npm run build
# PM2
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

Reverse-proxy HTTP to the Node port (`127.0.0.1:3000`) in OpenLiteSpeed; add a wildcard `*.myportal.sch.ng` A record for school subdomains; issue Let's Encrypt SSL.

**Updates:**
```bash
git pull
npm install
npx prisma generate
npx prisma db push             # if schema changed
npm run build
pm2 restart marksheet
```

**Backup:**
```bash
pg_dump <db> > backup_$(date +%Y%m%d).sql
```

## 4. Vercel deployment

1. Connect the repo to Vercel; set the env vars from §2 in Project Settings.
2. The `withSentryConfig` wrapper builds Sentry automatically.
3. Vercel Blob is used for uploads (set `BLOB_READ_WRITE_TOKEN`).
4. Database via Neon (or a Neon branch per preview).
5. Cron for the notification processor: add a Vercel Cron job hitting `/api/notifications/process-queue` with `CRON_SECRET`.
6. `VERCEL` env var is set automatically (used to enable `secure` cookies).

## 5. Subdomains & school routing

`DEPLOY.md` describes a middleware rewrite for subdomains (console, school shortcode). Note: the current codebase routes by role and shortcode in URL (`/login/[shortcode]`, `/console/*`, etc.) rather than requiring a `middleware.ts` — no middleware file is present. If you introduce subdomain-based school detection, add `src/middleware.ts` accordingly and keep the Host-header proxy configured in LiteSpeed.

## 6. Cron / scheduled jobs

| Job | Endpoint | Auth | Cadence |
|---|---|---|---|
| Process notification queue | `GET/POST /api/notifications/process-queue` | `CRON_SECRET` bearer or `platform_owner` | every ~1 min recommended |

Configure via Vercel Cron (`vercel.json`) or a system cron hitting the server.

## 7. Monitoring & observability

- **Sentry** — server + client; error boundary at `global-error.tsx`; tunneled through `/monitoring`; source maps uploaded in CI via `withSentryConfig`.
- **PM2** — `pm2 monit`, `pm2 logs marksheet` for self-hosted.
- **AI call-log** — in-app telemetry (`AiCallLog`) at `/console/ai/call-log`.

## 8. Deployment checklist

- [ ] `AUTH_SECRET` and `ENCRYPTION_KEY` are strong and stable.
- [ ] `DATABASE_URL` points at the right DB; migrations applied (`prisma db push`).
- [ ] HTTPS enforced; custom-domain SSL issued.
- [ ] PM2 `startup` enabled (self-hosted) / Vercel project configured.
- [ ] Cron job for notification processing wired.
- [ ] `.env` is `chmod 600` and git-ignored.
- [ ] Regular DB backups scheduled.
- [ ] Blob token set for uploads.
- [ ] Platform owner account created for `/console`.