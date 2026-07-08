import { execSync } from "child_process"
import { readFileSync } from "fs"
import path from "path"

const envPath = path.resolve(__dirname, "..", ".env")
const envContent = readFileSync(envPath, "utf-8")
const match = envContent.match(/^DATABASE_URL_ONLINE=(.+)$/m)
if (!match) {
  console.error("DATABASE_URL_ONLINE not found in .env")
  process.exit(1)
}

const onlineUrl = match[1].trim().replace(/^"|"$/g, "")
console.log("Pushing to online database...")
execSync(`npx prisma db push --accept-data-loss`, {
  env: { ...process.env, DATABASE_URL: onlineUrl },
  stdio: "inherit",
})
