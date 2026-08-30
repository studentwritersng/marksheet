// Build-time guard: fail the build if the public site URL does not match the
// canonical deploy domain or does not resolve. Prevents the regression where
// SITE_URL fell back to a dead domain (marksheet.ng) and every crawl signal
// pointed at an unreachable host, so Google/AI crawlers indexed nothing.
//
// Configure via env:
//   CANONICAL_SITE_URL   expected production URL (default https://marksheet.top)
//   NEXT_PUBLIC_SITE_URL the value actually wired into the build
//   SKIP_SITE_URL_CHECK=1  opt out entirely (not recommended)
import dns from "node:dns/promises";
import process from "node:process";

const CANONICAL = (process.env.CANONICAL_SITE_URL || "https://marksheet.top").replace(/\/$/, "");
const raw = process.env.NEXT_PUBLIC_SITE_URL;
const resolved = (raw || CANONICAL).replace(/\/$/, "");

const isVercel = Boolean(process.env.VERCEL);
const isCI = process.env.CI === "true" || process.env.CI === "1" || isVercel;
const isProd = process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && isVercel);

function fail(msg) {
  console.error(`\n❌ SITE_URL guard failed: ${msg}\n`);
  process.exit(1);
}

if (process.env.SKIP_SITE_URL_CHECK === "1") {
  console.log("⚠️  SITE_URL guard skipped (SKIP_SITE_URL_CHECK=1).");
  process.exit(0);
}

// Production must set the variable explicitly rather than rely on a fallback,
// so a wrong default can never silently ship.
if (isProd && !raw) {
  fail(
    `NEXT_PUBLIC_SITE_URL is not set in production. Set it to ${CANONICAL} ` +
      `in the deploy environment or crawlers will be pointed at the wrong host.`,
  );
}

if (resolved !== CANONICAL) {
  fail(`Resolved SITE_URL (${resolved}) does not match canonical deploy domain ${CANONICAL}.`);
}

let host;
try {
  host = new URL(resolved).host;
} catch {
  fail(`SITE_URL is not a valid URL: ${resolved}`);
}

// Only enforce DNS reachability in CI/deploy to avoid breaking offline local builds.
if (isCI) {
  try {
    await dns.lookup(host);
  } catch (err) {
    fail(`SITE_URL host ${host} does not resolve (DNS ${err.code}). Crawlers cannot reach it.`);
  }
}

console.log(`✅ SITE_URL guard passed: ${resolved}`);
