# School Custom Domain — Cloudflare + Vercel Setup

This documents how to point a school's own domain (e.g. `portal.stmarys.sch.ng`) at the
shared Marksheet app so visitors see that school's branded portal.

## How it works
The app resolves the school from the incoming `Host` header. A school's domain is stored on
`School.customDomain` and must be verified (DNS TXT) before it is trusted. Public pages
(`/login`, `/verify`, `/`) then render that school's branding; the authenticated app is already
scoped by the logged-in user's school.

## Per-school setup (Cloudflare + Vercel)
Both the platform domain and the school domain are managed in Cloudflare.

1. In Cloudflare, add the school domain as a **Custom Hostname / SSL for SaaS** entry on the
   platform zone (Cloudflare auto-issues the certificate), or add it as its own zone.
2. DNS: set the school domain `CNAME`/`ALIAS` → the Vercel target (`cname.vercel-dns.com`),
   with proxy = orange cloud (Cloudflare terminates TLS and forwards to Vercel).
3. SSL/TLS mode: **Full (Strict)**.
4. In Vercel: add the school domain to the project (Project → Domains) so Vercel routes it.
5. If the school runs their own Cloudflare zone: they add the CNAME target plus the
   `_marksheet-challenge.<domain>` TXT record you provide; you add the Custom Hostname.

## Verify ownership (in the platform console)
In the platform console at `/console/schools/[id]`:
1. Enter the domain and click **Save domain** — the app stores it and shows a TXT record
   `_marksheet-challenge.<domain> = <token>`.
2. Add that TXT record at the domain's DNS.
3. Click **Verify** — the app checks the TXT record matches, then marks the domain verified.
4. Once verified, point DNS (steps above) and add the domain in Vercel.

## Notes
- `MAIN_DOMAIN` (env var) must be set to the platform's primary hostname (e.g. `marksheet.com`)
  so cross-school users on a school domain are redirected to the main portal.
- On Next.js 16, no `allowedHosts` config is required (host-header blocking is absent by default).
