import express from "express";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { getConfig } from "./config";
import { openDb } from "./db";
import { parsePayload, saveAnswers, signIn, signInStudent, startAttempt, submitAttempt, tickAttempt } from "./exam-taking";
import { syncDown, syncUp } from "./sync";
import type { IncomingAnswer } from "./exam-taking";

const cfg = getConfig();
const db = openDb();

const app = express();
app.use(express.json({ limit: "2mb" }));

function authOk(req: express.Request): boolean {
  const provided = String(req.headers["x-invigilator-code"] ?? "");
  const expected = cfg.invigilatorCode;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!authOk(req)) return res.status(401).json({ error: "Unauthorised." });
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "marksheet-hub", db: (db.raw.prepare("SELECT COUNT(*) AS n FROM bundles").get() as { n: number }).n });
});

app.get("/admin/status", (_req, res) => {
  const bundles = db.getBundles().length;
  const pending = db.getLocalOnlyAttempts().length;
  res.json({ bundles, pendingSyncAttempts: pending });
});

// --- Student flows ---

app.get("/api/open-sessions", (_req, res) => {
  try {
    const sessions = db
      .getOpenBundles()
      .map((b) => {
        try {
          const payload = parsePayload(b.payload);
          return {
            bundleId: b.bundleId,
            subjectName: payload.exam.subjectName,
            classNames: payload.exam.classNames,
            termLabel: payload.exam.termLabel,
            durationMinutes: payload.durationMinutes,
            questionCount: payload.questions.length,
            openedAt: b.openedAt,
          };
        } catch {
          return null;
        }
      })
      .filter((s) => s !== null);
    res.json({ sessions });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Failed to list sessions." });
  }
});

app.post("/api/sign-in", (req, res) => {
  try {
    const { bundleId, admissionNumber, pin } = (req.body ?? {}) as Record<string, string>;
    if (!bundleId || !admissionNumber || !pin) {
      return res.status(400).json({ error: "bundleId, admissionNumber, and pin are required." });
    }
    const result = signIn(db, bundleId, admissionNumber, pin);
    if (!result.ok) {
      return res.status(401).json({ error: result.error, lockoutSeconds: result.lockoutSeconds });
    }
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Sign-in failed." });
  }
});

app.post("/api/student/sign-in", (req, res) => {
  try {
    const { admissionNumber, pin } = (req.body ?? {}) as Record<string, string>;
    if (!admissionNumber || !pin) {
      return res.status(400).json({ error: "admissionNumber and pin are required." });
    }
    const result = signInStudent(db, admissionNumber, pin);
    if (!result.ok) {
      return res.status(401).json({ error: result.error, lockoutSeconds: result.lockoutSeconds });
    }
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message ?? "Sign-in failed." });
  }
});

app.post("/api/attempts/start", (req, res) => {
  try {
    const { bundleId, studentId } = (req.body ?? {}) as Record<string, string>;
    if (!bundleId || !studentId) {
      return res.status(400).json({ error: "bundleId and studentId are required." });
    }
    const result = startAttempt(db, bundleId, studentId);
    if (!result.ok) return res.status(404).json({ error: result.error });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Failed to start." });
  }
});

app.post("/api/attempts/:id/autosave", (req, res) => {
  try {
    const { answers } = (req.body ?? {}) as { answers?: IncomingAnswer[] };
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "answers must be an array." });
    }
    res.json(saveAnswers(db, req.params.id, answers, cfg.signingSecret));
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Autosave failed." });
  }
});

app.post("/api/attempts/:id/tick", (req, res) => {
  try {
    res.json(tickAttempt(db, req.params.id));
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Tick failed." });
  }
});

app.post("/api/attempts/:id/submit", (req, res) => {
  try {
    const { answers } = (req.body ?? {}) as { answers?: IncomingAnswer[] };
    if (!Array.isArray(answers)) {
      return res.status(400).json({ error: "answers must be an array." });
    }
    const result = submitAttempt(db, req.params.id, answers, cfg.signingSecret);
    if (!result.ok) return res.status(409).json({ error: result.error });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Submit failed." });
  }
});

// --- Admin flows ---

app.get("/api/admin/status", requireAdmin, (_req, res) => {
  const bundles = db.getBundles().length;
  const pending = db.getLocalOnlyAttempts().length;
  res.json({ bundles, pendingSyncAttempts: pending });
});

app.post("/api/admin/sync", requireAdmin, async (_req, res) => {
  try {
    const { pulled, uploaded } = await runSync();
    res.json({ ok: true, pulled, uploaded });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Sync failed." });
  }
});

app.get("/api/admin/bundles/:bundleId/pins", requireAdmin, (req, res) => {
  try {
    const row = db.getBundleWithStatus(String(req.params.bundleId));
    if (!row) return res.status(404).json({ error: "Bundle not found." });
    const payload = parsePayload(row.payload);
    const roster = payload.roster.map((r) => ({
      admissionNumber: r.admissionNumber,
      studentName: `${r.firstName} ${r.lastName}`.trim(),
      pin: r.pin,
    }));
    res.json({ bundleId: row.bundleId, subjectName: payload.exam.subjectName, roster });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "Failed to load PINs." });
  }
});

app.get("/api/admin/sessions", requireAdmin, (_req, res) => {
  try {
    const sessions = db.getBundles().map((b) => {
      const row = db.getBundleWithStatus(b.bundleId)!;
      let info: { subjectName?: string; termLabel?: string; durationMinutes?: number } = {};
      try {
        const payload = parsePayload(row.payload);
        info = {
          subjectName: payload.exam.subjectName,
          termLabel: payload.exam.termLabel,
          durationMinutes: payload.durationMinutes,
        };
      } catch {
        // leave info empty; session list still works
      }
      return { bundleId: row.bundleId, ...info, status: row.sessionOpen === 1 ? "open" : "closed" };
    });
    res.json({ sessions });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Failed to list sessions." });
  }
});

app.post("/api/admin/sessions/:bundleId/open", requireAdmin, (req, res) => {
  try {
    const bundleId = String(req.params.bundleId);
    const row = db.getBundleWithStatus(bundleId);
    if (!row) return res.status(404).json({ error: "Bundle not found." });
    const payload = parsePayload(row.payload);
    const requested = Number((req.body ?? {}).durationMinutes);
    const duration = Number.isFinite(requested) && requested > 0 ? requested : payload.durationMinutes;
    db.setSessionOpen(row.bundleId, true, duration);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Failed to open session." });
  }
});

app.post("/api/admin/sessions/:bundleId/close", requireAdmin, (req, res) => {
  try {
    db.setSessionOpen(String(req.params.bundleId), false);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message ?? "Failed to close session." });
  }
});

// --- Branding (school name + logo) ---

const BRANDING_DIR = resolve(import.meta.dirname, "../branding");
const LOGO_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

function findLogo(): string | null {
  for (const ext of LOGO_EXTENSIONS) {
    const p = join(BRANDING_DIR, `logo${ext}`);
    if (existsSync(p)) return p;
  }
  return null;
}

app.get("/api/branding", (_req, res) => {
  res.json({
    schoolName: cfg.schoolName,
    logoUrl: findLogo() ? "/branding/logo" : null,
  });
});

app.get("/branding/logo", (_req, res) => {
  const logo = findLogo();
  if (!logo) return res.sendStatus(404);
  res.sendFile(logo);
});

// --- SPA static serving ---

const PUBLIC_DIR = resolve(import.meta.dirname, "../dist/public");
const INDEX_HTML = join(PUBLIC_DIR, "index.html");

app.use(express.static(PUBLIC_DIR));
app.get(["/", "/login", "/admin", "/admin/*"], (_req, res) => {
  if (existsSync(INDEX_HTML)) {
    res.sendFile(INDEX_HTML);
  } else {
    res.status(404).send("SPA not built yet. Run `npm run build:spa` inside hub/.");
  }
});

// --- Sync loop: pull released bundles + push submitted attempts automatically ---

async function runSync(): Promise<{ pulled: number; uploaded: number }> {
  const pulled = await syncDown(db);
  const { uploaded } = await syncUp(db);
  return { pulled, uploaded };
}

async function tickSync(): Promise<void> {
  try {
    const { pulled, uploaded } = await runSync();
    if (pulled > 0 || uploaded > 0) {
      console.log(`[sync] pulled ${pulled} bundle(s), uploaded ${uploaded} attempt(s)`);
    }
  } catch (e: any) {
    console.error(`[sync] failed: ${e?.message ?? e}`);
  }
}

// Initial sync shortly after boot, then every syncIntervalMs.
setTimeout(() => {
  tickSync();
}, 1500);
setInterval(tickSync, cfg.syncIntervalMs);

app.listen(cfg.port, () => {
  console.log(`Marksheet hub listening on http://0.0.0.0:${cfg.port}`);
});
