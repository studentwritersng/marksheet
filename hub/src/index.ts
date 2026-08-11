import express from "express";
import { getConfig } from "./config";
import { openDb } from "./db";

const cfg = getConfig();
const db = openDb();

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "marksheet-hub", db: (db.raw.prepare("SELECT COUNT(*) AS n FROM bundles").get() as { n: number }).n });
});

app.get("/admin/status", (_req, res) => {
  const bundles = db.getBundles().length;
  const pending = db.getLocalOnlyAttempts().length;
  res.json({ bundles, pendingSyncAttempts: pending });
});

app.listen(cfg.port, () => {
  console.log(`Marksheet hub listening on http://0.0.0.0:${cfg.port}`);
});