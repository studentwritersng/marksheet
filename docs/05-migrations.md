# 05 — Database Migrations

## 1. Important — the workflow in this repo

`npx prisma migrate dev` is **broken in this repository** (fails against the Neon shadow database with P3006). The working, established workflow is:

1. **Edit `prisma/schema.prisma`** — add/change models, fields, enums.
2. **Create a manual migration folder** with the SQL (for history/documentation).
3. **Run `npx prisma db push`** — this applies schema to the database directly and regenerates the Prisma client.

There is already a `prisma/migrations/migration_lock.toml` and 16 migration folders. The migration folders serve as documentation of schema history; the actual schema state is applied via `db push`.

## 2. Daily workflow (making a schema change)

### Step 1 — edit the schema
```prisma
model LandingStat {
  id           String   @id @default(cuid())
  key          String   @unique
  label        String
  valueSource  String   @default("auto")
  manualValue  String   @default("")
  enabled      Boolean  @default(true)
  displayOrder Int      @default(0)
  updatedAt    DateTime @updatedAt

  @@map("landing_stats")
}
```

### Step 2 — generate the SQL migration (for the record)

Create `prisma/migrations/<timestamp>_<name>/migration.sql`:

```sql
CREATE TABLE "landing_stats" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "valueSource" TEXT NOT NULL DEFAULT 'auto',
  "manualValue" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "landing_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "landing_stats_key_key" ON "landing_stats"("key");
```

You can generate this SQL for a new model quickly with `npx prisma migrate diff` if you need exact DDL.

### Step 3 — apply & regenerate
```bash
npx prisma db push
```

`db push` applies any schema drift directly and regenerates the client. It's idempotent — re-running is safe.

### Step 4 — update the seed if needed
If the change involves defaults or demo data, update `prisma/seed.ts` (upsert-based, safe to re-run).

## 3. When NOT to use `db push`

`db push` does **not** preserve a migration history automatically, and it is **destructive** when the schema removes columns/models (it warns and requires `--accept-data-loss`). Use caution:

- For teams, always keep the manual `migration.sql` file as the record of intent.
- For destructive changes (dropping columns), back up first, then run with `--accept-data-loss`.
- `prisma migrate deploy` can be used against the `migrations/` folder on CI/staging environments that do run shadow DBs, but is not the day-to-day path here.

## 4. Environment databases

| Where | Command | Notes |
|---|---|---|
| Local dev | `npm run db:push` | applies `DATABASE_URL` from `.env` |
| Production (self-hosted) | `npx prisma db push` on the server | from `.env` there |
| Vercel production DB | via a one-off `tsx` script | see `prisma/db-push-online.ts` / `npm run db:push:online` |

> `package.json` exposes: `db:push`, `db:push:local`, `db:push:online` (`tsx prisma/db-push-online.ts`), and `db:push:both`.

## 5. Regenerating the client only

If only the Prisma client needs rebuilding (e.g. after a pull):
```bash
npx prisma generate
```

## 6. Common pitfalls

| Problem | Solution |
|---|---|
| `prisma migrate dev` P3006 / shadow DB | Don't use it — use `db push` + manual migration folder |
| `db push` wants to drop a column | Back up; run `npx prisma db push --accept-data-loss` |
| Client out of date after schema change | `npx prisma generate` |
| `Schema unknown` / type errors mentioning `LandingStat` | Client not regenerated — run `npx prisma generate` |
| Seed not reflecting new fields | Update `prisma/seed.ts`; re-run `npm run db:seed` |

## 7. Viewing data

```bash
npx prisma studio
```
Opens a browser-based DB browser at `http://localhost:5555`.
