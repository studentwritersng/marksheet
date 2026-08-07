# 02 — Local Development Setup

## 1. Prerequisites

- **Node.js** v20+ (v22 recommended). Check: `node -v`.
- **npm** (ships with Node).
- **PostgreSQL** — either a local install or a hosted one (Neon free tier recommended).
- **Git**.

No Docker is required for day-to-day work; a `docker-compose.yml` exists for optional local Postgres.

## 2. Install & configure

```bash
# 1. Clone the repository
git clone <your-repo-url> marksheet
cd marksheet

# 2. Install dependencies (postinstall runs `prisma generate`)
npm install

# 3. Copy the env template
cp .env.example .env
```

### 2.1 Environment variables

Edit `.env` and fill in:

```bash
# Database (Postgres) — required
DATABASE_URL="postgresql://user:password@localhost:5432/marksheet"

# Auth secret — required. Generate with: openssl rand -hex 32
AUTH_SECRET="<64-char-hex-random>"

# AI Gateway — optional for dev (AI_MOCK=true uses no real calls)
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_API_KEY=""
AI_DEFAULT_MODEL="anthropic/claude-sonnet-4.5"
AI_MOCK="true"

# SMTP — optional; leave commented out unless testing email
# SMTP_HOST="smtp.gmail.com"
# SMTP_PORT="587"
# SMTP_USER="you@gmail.com"
# SMTP_PASS="your-app-password"
# SMTP_FROM="noreply@marksheet.dev"

# App URL — used for absolute links
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

> **Never commit `.env`.** It is git-ignored. The `.env.example` file is the source of truth for variable *names*.

### 2.2 Database options

**Option A — Neon (recommended, matches production):**

1. Sign up at [neon.tech](https://neon.tech), create a project.
2. Copy the connection string: `postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
3. Use it as `DATABASE_URL`.

**Option B — Local Postgres:**

```bash
# Optional: use the bundled docker-compose
docker compose up -d
# DATABASE_URL="postgresql://postgres:postgres@localhost:5432/marksheet"
```

## 3. Create the schema & seed

```bash
# Push the Prisma schema to your database (creates all 90 tables)
npx prisma db push

# Seed demo data (idempotent — safe to run repeatedly)
npm run db:seed
```

The seed creates:

- Super admin: `super@marksheet.dev` / `superadmin123`
- Demo school **"Unity Model Secondary School"** (shortcode `UMS`)
- School admin: `admin@marksheet.sch.ng` / `admin123`
- Subject teacher: `j.bello@marksheet.sch.ng` / `teacher123`
- 2 students, guardians, 3 terms, 6 classes, subjects, addons, timetable demo data, and JSS1 NERDC topics.

> The seed is upsert-based, so running it again is safe and never duplicates.

## 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Daily scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (type-checks + lints via Next) |
| `npm start` | Run production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check only (faster than a full build) |
| `npm run db:push` | Push schema changes to DB (`prisma db push`) |
| `npm run db:seed` | Seed/reset demo data |
| `npm run db:studio` | Open Prisma Studio (visual DB browser) |
| `npm run db:migrate` | **Avoid** — see [05-migrations.md](./05-migrations.md) |
| `npm run db:encrypt-ai-keys` | Encrypt any plain-text AI keys already stored |

## 6. Logging in after setup

Logins redirect by role:

| Credential | Role | Lands on |
|---|---|---|
| `super@marksheet.dev` / `superadmin123` | super_admin | `/dashboard` (can manage schools) |
| `admin@marksheet.sch.ng` / `admin123` | staff (school admin) | `/dashboard` |
| `j.bello@marksheet.sch.ng` / `teacher123` | staff (teacher) | `/dashboard` |

- **Platform Owner console** login lives at `/console/login` (no seeded owner — create one, see [13-roles-consoles.md](./13-roles-consoles.md)).
- **Proprietor login** at `/proprietor/login` (requires Multi-Branch addon + `proprietor` role).
- **Referral agent** at `/referral/login`.

## 7. Verifying your setup

1. `npm run dev` starts without errors.
2. `npx prisma studio` shows seeded schools, users, classes.
3. Visit `/` — you should see the landing page (guest) and the 4 hero stats from `landing_stats`.
4. Log in as `admin@marksheet.sch.ng` / `admin123` — you reach the dashboard.

## 8. Common first-run problems

| Symptom | Fix |
|---|---|
| `AUTH_SECRET is not set` | Fill `AUTH_SECRET` in `.env` |
| `PrismaClientInitializationError: Can't reach database server` | Check `DATABASE_URL`; is Postgres running? |
| `Table "schools" does not exist` | Run `npx prisma db push` |
| Port 3000 in use | `npm run dev -- -p 3001` |
| Session won't persist / instantly logs out | `secure` cookie flag requires HTTPS or `NODE_ENV=production`. Use `http://localhost:3000` in dev. |
