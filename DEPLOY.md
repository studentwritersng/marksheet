# Deployment Guide: Platform Owner Console + School Portal

## Architecture

```
                    myportal.sch.ng
                           │
                    ┌──────┴──────┐
                    │  CyberPanel  │
                    │  (OpenLiteSpeed) │
                    └──────┬──────┘
                           │ reverse proxy
                    ┌──────┴──────┐
                    │  Next.js    │
                    │   (Node)    │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  PostgreSQL  │
                    └─────────────┘
```

### Domain mapping

| Domain | Route | Purpose |
|---|---|---|
| `console.myportal.sch.ng` | `/console/*` | Platform Owner Console |
| `schoolname.myportal.sch.ng` | `/*` | School A's portal (extract subdomain) |
| `portal.theirschool.com` → CNAME → `schoolname.myportal.sch.ng` | `/*` | School A's custom domain |
| `myportal.sch.ng` | `/*` | Redirects to school login |
| `verify.myportal.sch.ng` (optional) | `/verify` | Public result verification |

---

## Prerequisites

- CyberPanel with **OpenLiteSpeed** (not Apache)
- **Node.js** v20+ installed via CyberPanel's NodeJS Selector
- **PostgreSQL** 16+ (can be on same server or separate). Note your PostgreSQL **port** (default: `5432`) — you'll need it in the `DATABASE_URL`.
- **PM2** for Node.js process management (`npm install -g pm2`)
- A domain (`myportal.sch.ng`) pointed to your server's IP

---

## Step 1: PostgreSQL Setup

You do **not** need to run PostgreSQL on CyberPanel. Use any hosted PostgreSQL provider — it's simpler and more reliable.

### Option A: Neon (recommended — has a free tier)
1. Go to [https://neon.tech](https://neon.tech) and sign up
2. Create a project → copy the connection string
3. It looks like: `postgresql://user:password@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require`
4. Use this as your `DATABASE_URL` in Step 3

### Option B: Supabase (free tier available)
1. Go to [https://supabase.com](https://supabase.com) and sign up
2. Create a project → go to **Project Settings → Database**
3. Copy the connection string (URI mode): `postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres`
4. Use this as your `DATABASE_URL` in Step 3

### Option C: CyberPanel local (if you prefer self-hosted)
1. Go to **CyberPanel → Databases → Create Database**
2. Create database: `marksheet`
3. Create user: `marksheet_user` with a strong password
4. Note the connection details (port is usually `5432`)

### Option D: Self-hosted via command line (advanced)
```bash
apt install postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
sudo -u postgres psql

CREATE DATABASE marksheet;
CREATE USER marksheet_user WITH ENCRYPTED PASSWORD 'your_strong_password';
GRANT ALL PRIVILEGES ON DATABASE marksheet TO marksheet_user;
\c marksheet
GRANT ALL ON SCHEMA public TO marksheet_user;
\q
```

---

## Step 2: Upload Code

### Option A: Git deploy (recommended)
```bash
# SSH into your server
ssh root@your-server-ip

# Go to web directory
cd /home/yourusername/public_html

# Clone repository
git clone https://github.com/yourusername/marksheet.git
cd marksheet

# Install dependencies
npm install
```

### Option B: CyberPanel File Manager
1. Zip the project folder (excluding `node_modules`, `.next`, `.git`)
2. Upload via CyberPanel File Manager → extract
3. SSH in and run `npm install`

---

## Step 3: Environment Variables

All environment files live in the project root: `/home/yourusername/public_html/marksheet/`

Create `.env.production` in that directory (never commit this file):

```bash
# Navigate to project root
cd /home/yourusername/public_html/marksheet

# Create the file
nano .env.production
```

Paste this template and replace all placeholder values:

```bash
# ── Database ──
# If using Neon:   postgresql://user:pass@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require
# If using Supabase: postgresql://postgres:pass@db.xxxx.supabase.co:5432/postgres
# If using local:   postgresql://marksheet_user:pass@localhost:5432/marksheet
DATABASE_URL="postgresql://user:password@your-host/your-db?sslmode=require"

# ── Auth (generate a strong secret) ──
# Run: openssl rand -hex 32
AUTH_SECRET="your-random-64-char-hex-secret"

# ── AI Provider (defaults — override via Console later) ──
AI_BASE_URL="https://openrouter.ai/api/v1"
AI_API_KEY="sk-or-v1-your-key"
AI_DEFAULT_MODEL="anthropic/claude-3.5-sonnet"
AI_MOCK="false"

# ── Email (for notifications & alerts) ──
SMTP_HOST="smtp.yourprovider.com"
SMTP_PORT="587"
SMTP_USER="noreply@myportal.sch.ng"
SMTP_PASS="your-smtp-password"
SMTP_FROM="noreply@myportal.sch.ng"

# ── Application ──
NEXT_PUBLIC_APP_URL="https://myportal.sch.ng"
NODE_ENV="production"
```

Save the file (Ctrl+O, then Ctrl+X in nano).

**Next.js reads `.env` (not `.env.production`), so copy it into place:**

```bash
cp .env.production .env
```

This creates `.env` (same directory, same content). The `.env.production` file is your backup template — keep it around so you can regenerate `.env` if needed.

**Security:** Lock down the file so only the app user can read secrets:
```bash
chmod 600 .env .env.production
```

---

## Step 4: Database Migration

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# Optional: Seed with demo data
npx prisma db seed
```

**Important:** The first time you run `prisma db push`, it creates all 40+ tables. On subsequent updates, run:

```bash
npx prisma generate
npx prisma db push
```

---

## Step 5: Build the Application

```bash
# Build Next.js
npm run build

# Test: start the production server
npm start
```

Verify it works locally: `curl http://localhost:3000`

---

## Step 6: PM2 Process Manager

```bash
# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'marksheet',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/home/yourusername/public_html/marksheet',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '1G',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable PM2 on reboot
```

---

## Step 7: CyberPanel — Create Website & Virtual Host

### Create the main website
1. **CyberPanel → Create Website**
   - Domain: `myportal.sch.ng`
   - Select PHP (won't be used, but CyberPanel needs it)
   - Leave other defaults

### Configure OpenLiteSpeed for Node.js proxy

In **CyberPanel → Virtual Hosts → myportal.sch.ng → Rewrite Rules**:

Create a rewrite rule that proxies all traffic to your Next.js port:

```
RewriteEngine On
RewriteCond %{HTTP_HOST} ^(.*)$
RewriteRule ^(.*)$ http://127.0.0.1:3000/$1 [P,L]
```

Or manually edit the OpenLiteSpeed config:

**CyberPanel → Virtual Hosts → myportal.sch.ng → OpenLiteSpeed Config → Context**

Add a context:

```
Type: Proxy
URI: /
Address: http://127.0.0.1:3000
```

### Enable ModSecurity (optional but recommended)

---

## Step 8: Subdomain Routing (schoolname.myportal.sch.ng)

### Create wildcard subdomain
In **CyberPanel → DNS → myportal.sch.ng**:

```
*.myportal.sch.ng  →  A  →  your-server-ip
```

### Configure LiteSpeed to pass the Host header

Edit `/usr/local/lsws/conf/vhosts/myportal.sch.ng/vhconf.conf`:

```xml
<rewrite>
  <rules>
    <rule name="nextjs-proxy">
      <match>^(.*)$</match>
      <action type="proxy" url="http://127.0.0.1:3000$1">
        <param>X-Forwarded-Host</param>
      </action>
    </rule>
  </rules>
</rewrite>
```

The key is that `Host` header reaches Next.js so your middleware can detect the subdomain.

### Next.js middleware for subdomain detection

Create `src/middleware.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const url = req.nextUrl.clone();

  // Console subdomain
  if (host.startsWith("console.")) {
    url.pathname = `/console${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Extract school subdomain
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www" && parts[0] !== "myportal") {
    // schoolname.myportal.sch.ng → set header for school detection
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-school-subdomain", parts[0]);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return NextResponse.next();
}
```

---

## Step 9: SSL / HTTPS

### Via CyberPanel (Let's Encrypt)
1. **CyberPanel → SSL → myportal.sch.ng**
2. Select **Let's Encrypt SSL**
3. Include `www.myportal.sch.ng` and `*.myportal.sch.ng`
4. Issue certificate

### Auto-renewal
CyberPanel auto-renews Let's Encrypt. Verify with:
```bash
/usr/local/lsws/fcgi-bin/lsphp5 /usr/local/cyberpanel/letsEncrypt.py --renew
```

---

## Step 10: Console Subdomain

If you want `console.myportal.sch.ng` as a standalone subdomain:

1. **CyberPanel → Create Website**
   - Domain: `console.myportal.sch.ng`
   - No PHP required

2. Point it to the same Node.js instance:
   ```
   RewriteEngine On
   RewriteRule ^(.*)$ http://127.0.0.1:3000/console/$1 [P,L]
   ```

---

## Step 11: Create Platform Owner Account

```bash
# SSH into server
cd /home/yourusername/public_html/marksheet

# Use Node to create a platform owner
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('your-strong-password', 12);
  const user = await prisma.user.create({
    data: {
      email: 'owner@myportal.sch.ng',
      passwordHash: hash,
      role: 'platform_owner',
      isActive: true,
    }
  });
  console.log('Platform owner created:', user.email);
}

main().catch(console.error).finally(() => prisma.\$disconnect());
"
```

Then log in at `https://console.myportal.sch.ng/login`

---

## Step 12: Custom Domains for Schools

When a school wants `portal.theirschool.com`:

1. School adds a **CNAME record** in their DNS:
   ```
   portal.theirschool.com  CNAME  schoolname.myportal.sch.ng
   ```

2. In your CyberPanel, add a **Parked Domain** or **Alias**:
   - **CyberPanel → Virtual Hosts → myportal.sch.ng → Add Domain Alias**
   - Add `portal.theirschool.com`

3. SSL:
   - For each custom domain, issue a Let's Encrypt cert in CyberPanel
   - Or use a wildcard cert for `*.myportal.sch.ng` + individual certs for custom domains

---

## Step 13: Maintenance & Updates

### Update code
```bash
cd /home/yourusername/public_html/marksheet
git pull
npm install
npx prisma generate
npx prisma db push  # if schema changed
npm run build
pm2 restart marksheet
```

### View logs
```bash
pm2 logs marksheet
tail -f logs/err.log
tail -f logs/out.log
```

### Monitor
```bash
pm2 monit
htop  # system resources
```

### Backup database
```bash
pg_dump marksheet > backup_$(date +%Y%m%d).sql
```

---

## Step 14: Security Checklist

- [ ] `AUTH_SECRET` is a strong random string (64+ hex chars)
- [ ] PostgreSQL is not exposed to the internet (check `pg_hba.conf`)
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] HTTPS enforced (auto-redirect from HTTP)
- [ ] PM2 restarts on reboot (`pm2 startup`)
- [ ] Fail2ban installed for SSH protection
- [ ] Regular backups configured (cron job for DB dump)
- [ ] Node.js and npm are up to date
- [ ] OpenLiteSpeed security rules applied (CyberPanel → Security)

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `ERR_CONNECTION_REFUSED` | PM2 not running. Run `pm2 start marksheet` |
| 502 Bad Gateway | Next.js crashed. Check `pm2 logs marksheet` |
| Blank page on subdomain | Check DNS propagation. Add `*.myportal.sch.ng` A record |
| Prisma connection error | Verify `DATABASE_URL` in `.env` and PostgreSQL is running |
| SSL not working | Re-issue Let's Encrypt cert including all subdomains |
| "Not authorised" on login | User doesn't have `platform_owner` role. Run the create-user script |

---

## File Structure Reference

```
/home/yourusername/public_html/marksheet/
├── .env                     # Production environment variables
├── ecosystem.config.js       # PM2 config
├── logs/                     # PM2 log output
│   ├── err.log
│   └── out.log
├── node_modules/
├── prisma/
│   └── schema.prisma         # Database schema
├── public/
├── src/
│   ├── app/
│   │   ├── (app)/            # School-facing routes
│   │   ├── (console)/        # Platform Owner Console
│   │   ├── api/              # API routes
│   │   ├── verify/           # Public result verification
│   │   ├── login/            # School login
│   │   └── middleware.ts     # Subdomain routing
│   ├── components/
│   ├── lib/
│   │   ├── auth/             # Authentication
│   │   ├── license.ts        # License enforcement
│   │   └── ...
│   └── ...
├── next.config.ts
└── package.json
```
