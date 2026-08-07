# Marksheet Platform — Documentation

> Syllabus, lesson-note, examination and result management for Nigerian secondary schools.

This folder is the complete engineering documentation for the **Marksheet** platform. It is written to bring a new developer from zero to productive as quickly as possible.

## Reading order for a new developer

Start at the top and work down. Each document assumes you have read the previous ones.

| # | Document | What you'll learn | Est. time |
|---|----------|-------------------|-----------|
| 1 | [01-architecture.md](./01-architecture.md) | What the product is, the tech stack, the multi-tenant model, and where every piece of code lives | 20 min |
| 2 | [02-setup.md](./02-setup.md) | Local development setup: prerequisites, env vars, database, seed, and daily scripts | 20 min |
| 3 | [03-authentication.md](./03-authentication.md) | Roles, sessions, guards, permissions, CSRF and rate limiting | 25 min |
| 4 | [04-data-model.md](./04-data-model.md) | All 90 database models, all 17 enums, key relations and schema patterns | 30 min |
| 5 | [05-migrations.md](./05-migrations.md) | How to evolve the database schema safely | 10 min |
| 6 | [06-server-actions.md](./06-server-actions.md) | The server-action pattern used across every feature | 15 min |
| 7 | [07-api-routes.md](./07-api-routes.md) | Every `/api/*` route handler and its security posture | 10 min |
| 8 | [08-frontend.md](./08-frontend.md) | The App Router route tree, route groups, layouts and UI conventions | 20 min |
| 9 | [09-feature-modules.md](./09-feature-modules.md) | Deep dives into every feature: exams, results, timetable, attendance, curriculum and more | 45 min |
| 10 | [10-addons-licensing.md](./10-addons-licensing.md) | Licenses, pricing stages, addons, payments and the billing model | 15 min |
| 11 | [11-ai-integration.md](./11-ai-integration.md) | The AI gateway, providers, essay grading, lesson-note generation and key encryption | 15 min |
| 12 | [12-notifications.md](./12-notifications.md) | The notification queue, providers, templates and event hooks | 15 min |
| 13 | [13-roles-consoles.md](./13-roles-consoles.md) | The Platform Owner console, Proprietor console and Referral portal | 15 min |
| 14 | [14-deployment.md](./14-deployment.md) | Production deployment: CyberPanel, Neon, PM2, subdomains and HTTPS | 20 min |
| 15 | [15-security.md](./15-security.md) | The security model: IDOR defenses, uploads, headers, secrets | 15 min |
| 16 | [16-backup-restore.md](./16-backup-restore.md) | School-level backup, export and restore | 10 min |
| 17 | [17-troubleshooting.md](./17-troubleshooting.md) | Common errors, the `error.log` workflow and debugging tips | 10 min |

## Quick facts

| | |
|---|---|
| **Product** | Marksheet — school management for Nigerian secondary schools |
| **Stack** | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 |
| **Database** | PostgreSQL (Prisma ORM, `prisma-client-js`) |
| **Auth** | Custom HMAC-SHA256 signed cookie sessions (no third-party auth library) |
| **Deployment** | Vercel or self-hosted CyberPanel/OpenLiteSpeed + PM2 |
| **Monitoring** | Sentry (server + client) |
| **AI** | Provider-agnostic gateway (OpenRouter default) with encrypted keys |
| **File storage** | Vercel Blob (production) / `public/uploads` (local) |

## Related top-level files

The following files live at the repository root and complement this folder:

- `README.md` — public-facing project overview (links here).
- `DEPLOY.md` — deployment walkthrough (CyberPanel + PM2).
- `platform.md`, `landingPage.md`, `multi-group.md`, `timetable_guide.md` — product/feature planning notes from the project's history. Informational only; not required for engineering work.
