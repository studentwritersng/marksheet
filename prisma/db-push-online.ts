import { execSync } from "child_process"
import { readFileSync } from "fs"
import path from "path"

const envPath = path.resolve(__dirname, "..", ".env")
const envContent = readFileSync(envPath, "utf-8")

function readEnv(key: string): string | undefined {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"))
  return match ? match[1].trim().replace(/^"|"$/g, "") : undefined
}

const urls: { label: string; url?: string; timeout: number }[] = [
  { label: "online (pooler)", url: readEnv("DATABASE_URL_ONLINE"), timeout: 90_000 },
  { label: "non-pooler fallback", url: readEnv("DATABASE_URL"), timeout: 300_000 },
]

for (const { label, url, timeout } of urls) {
  if (!url) {
    console.error(`Skipping ${label}: variable not set in .env`)
    continue
  }
  console.log(`Pushing to ${label} database...`)
  try {
    execSync(`npx prisma db push --accept-data-loss --skip-generate`, {
      env: { ...process.env, DATABASE_URL: url },
      stdio: "inherit",
      timeout,
    })
    console.log(`Database pushed via ${label}.`)
    process.exit(0)
  } catch {
    console.error(`Push via ${label} failed or timed out; trying next target.`)
  }
}

console.error("All database push attempts failed.")
process.exit(1)
