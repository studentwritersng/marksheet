# School Custom Domain — Step-by-Step Setup (Cloudflare + Vercel)

This explains how to point a school's own domain (e.g. `portal.stmarys.sch.ng`) at the shared
Marksheet app so visitors see that school's branded portal.

## How it works (30-second version)
When someone visits the school's domain, the app reads the `Host` header, finds the matching
school (only if its domain is **verified**), and shows that school's branding. To make this work
you need four things in place:

1. **Ownership** — Marksheet knows and trusts the domain (TXT record proof).
2. **DNS** — the domain points at the platform.
3. **SSL** — a valid HTTPS certificate covers the domain.
4. **Vercel** — the project is told to serve that domain.

Cloudflare provides DNS + SSL (and can proxy traffic); Vercel is the app host.

## Who does what
- **You (platform admin):** the Marksheet console, Cloudflare, and Vercel.
- **School's IT / domain owner:** adds DNS records at whatever provider holds their domain
  (Cloudflare, their registrar, Route 53, etc.).

## Prerequisites
- The school domain is registered and you (or the school IT) can edit its DNS.
- `MAIN_DOMAIN` env var is set on Vercel to your platform hostname (e.g. `marksheet.com`).
- Cloudflare: **SSL for SaaS (Custom Hostnames)** is enabled on your `marksheet.com` zone
  (Business plan, or the SaaS SSL add-on).
- You know your Vercel project name (e.g. `marksheet`).

---

## Step 1 — Add the domain in the Marksheet console (you)
1. Go to **Console → Schools → [school]**.
2. In the **Custom Domain** card, type the exact domain (e.g. `portal.stmarys.sch.ng`) and click
   **Save domain**.
3. The app stores it and shows a verification token, for example:
   ```
   Add this TXT record:
     _marksheet-challenge.portal.stmarys.sch.ng  =  a1b2c3d4…(token)
   ```
   Copy the token and keep this page open.

## Step 2 — Prove ownership with a TXT record (school IT)
At the school's DNS provider, add one record:

| Type | Name / Host                                  | Value                     |
|------|----------------------------------------------|---------------------------|
| TXT  | `_marksheet-challenge.portal.stmarys.sch.ng` | `<the token from Step 1>` |

- If the provider won't accept the full name, use `_marksheet-challenge` as the host and the
  domain is auto-appended.
- Wait a few minutes for DNS to propagate.

## Step 3 — Verify the domain in the console (you)
Back on the school page, click **Verify**. Marksheet looks up the TXT record:
- ✅ Match → the domain is marked **Verified**.
- ❌ Not found → wait longer / double-check the record, then click **Verify** again.

> The app does **not** trust the domain until it shows **Verified**.

## Step 4 — Issue the SSL certificate in Cloudflare (you)
1. In Cloudflare, open your **`marksheet.com`** zone → **SSL/TLS → Custom Hostnames** (SSL for SaaS).
2. Click **Add Custom Hostname** and enter `portal.stmarys.sch.ng`.
3. Set the **Custom Origin Server** (where Cloudflare forwards traffic) to your Vercel platform
   hostname, e.g. `marksheet.com`.
4. Save. Cloudflare now shows a **CNAME target** (fallback record), for example
   `portal-stmarys-sch-ng.school.marksheet.com` (or `xxxx.sni.cloudflaressl.com`).
   **Copy this target** — you need it in Step 5.
   Cloudflare automatically issues and renews the HTTPS certificate for the school domain.

## Step 5 — Point the domain at Cloudflare (school IT)
At the school's DNS provider, add the record that routes traffic to Cloudflare:

| Type  | Name / Host              | Value                                |
|-------|--------------------------|--------------------------------------|
| CNAME | `portal.stmarys.sch.ng`  | `<the Cloudflare CNAME target from Step 4>` |

The domain is now proxied by Cloudflare (orange cloud) and Cloudflare delivers it to Vercel.

## Step 6 — Tell Vercel about the domain (you)
1. In Vercel, open the **`marksheet`** project → **Settings → Domains**.
2. Click **Add** and enter `portal.stmarys.sch.ng`.
3. Vercel suggests a CNAME to `cname.vercel-dns.com`. **You can ignore that suggestion** — because
   Cloudflare is proxying in front, the school's DNS already points to Cloudflare (Step 5) and
   Cloudflare forwards to Vercel (Step 4). Vercel's "DNS not detected" warning is expected and
   harmless.
4. Once the domain is listed in the project, Vercel will serve it.

## Step 7 — Go live & test (you)
1. Wait for Cloudflare's certificate status to become **Active** (Step 4) and for DNS to propagate
   (anywhere from a few minutes to an hour).
2. Open `https://portal.stmarys.sch.ng` in a private/incognito window.
3. You should see the **school's branding** on the login page.
4. Open **Result Verification**, enter a code, and confirm it verifies scoped to that school only.

Done. Repeat Steps 1–7 for each school.

---

## Scenarios
- **School domain is already in Cloudflare (their own zone):** they add the TXT (Step 2) and the
  CNAME (Step 5) in *their* Cloudflare zone; you still add the Custom Hostname in *your*
  `marksheet.com` zone (Step 4) and the domain in Vercel (Step 6).
- **No Cloudflare wanted:** skip Steps 4–5. In Step 6, follow Vercel's instruction and have school
  IT add the CNAME to `cname.vercel-dns.com`; Vercel issues the SSL certificate itself.

## Troubleshooting
| Symptom                                  | Cause                                  | Fix                                                  |
|------------------------------------------|----------------------------------------|------------------------------------------------------|
| Console shows "TXT not found"            | DNS not propagated / wrong name        | Wait 5–30 min; ensure host is `_marksheet-challenge.<domain>`; re-click Verify |
| Browser shows a certificate/SSL error    | Cloudflare cert still pending          | Wait for Custom Hostname status **Active** in Cloudflare |
| `404` / "domain not found" on Vercel     | Domain not added to Vercel project     | Complete Step 6                                      |
| Page shows wrong / default branding      | Domain not Verified in Marksheet       | Complete Steps 1–3                                   |
| Redirect loop on the school domain       | `MAIN_DOMAIN` unset / wrong            | Set `MAIN_DOMAIN` to the platform hostname in Vercel env |

## Notes
- `MAIN_DOMAIN` must be set in the deployed environment (Vercel project env var) to the platform
  hostname so cross-school users on a school domain are redirected to the main portal.
- On Next.js 16, no `allowedHosts` config is required (host-header blocking is absent by default).
