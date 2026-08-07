# Marksheet

Syllabus, lesson-note, examination and result management platform for Nigerian secondary schools.

**Multi-tenant school management**: NERDC-aligned curriculum tracking, lesson notes (AI-assisted), timetable generation, exam delivery, grading and report cards, attendance, fee gating, parent messaging, licensing/addons and a referral program.

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4
- **PostgreSQL** via Prisma ORM (90 models)
- Custom HMAC-signed cookie sessions (no auth library)
- AI gateway (OpenRouter default), Sentry, Vercel Blob, Neon

## Documentation

> **Start here:** full engineering documentation lives in [`docs/`](./docs/README.md) — written for onboarding a new developer.

- [`docs/01-architecture.md`](./docs/01-architecture.md) — system overview & layout
- [`docs/02-setup.md`](./docs/02-setup.md) — local setup, env vars, seed, scripts
- [`docs/03-authentication.md`](./docs/03-authentication.md) — roles, sessions, guards, permissions
- [`docs/04-data-model.md`](./docs/04-data-model.md) — all 90 models, enums, relations
- [`docs/05-migrations.md`](./docs/05-migrations.md) — schema change workflow
- [`docs/06-server-actions.md`](./docs/06-server-actions.md) — the mutation pattern used everywhere
- [`docs/07-api-routes.md`](./docs/07-api-routes.md) — `/api/*` handlers
- [`docs/08-frontend.md`](./docs/08-frontend.md) — route tree, layouts, UI conventions
- [`docs/09-feature-modules.md`](./docs/09-feature-modules.md) — feature deep dives
- [`docs/10-addons-licensing.md`](./docs/10-addons-licensing.md) — licensing, addons, billing
- [`docs/11-ai-integration.md`](./docs/11-ai-integration.md) — AI gateway & encrypted keys
- [`docs/12-notifications.md`](./docs/12-notifications.md) — notification queue & providers
- [`docs/13-roles-consoles.md`](./docs/13-roles-consoles.md) — Platform Owner / Proprietor / Referral
- [`docs/14-deployment.md`](./docs/14-deployment.md) — deployment (Vercel / CyberPanel)
- [`docs/15-security.md`](./docs/15-security.md) — security model & IDOR defenses
- [`docs/16-backup-restore.md`](./docs/16-backup-restore.md) — school backup/restore
- [`docs/17-troubleshooting.md`](./docs/17-troubleshooting.md) — common errors

Also see [`DEPLOY.md`](./DEPLOY.md) for a step-by-step self-hosted deployment walkthrough.

## Quick start

```bash
npm install
cp .env.example .env       # fill DATABASE_URL + AUTH_SECRET
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

See [`docs/02-setup.md`](./docs/02-setup.md) for full details and seeded credentials.
