import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface HubConfig {
  cloudBaseUrl: string;
  apiKey: string;
  signingSecret: string;
  port: number;
  dataDir: string;
  syncIntervalMs: number;
  invigilatorCode: string;
  schoolName: string;
}

export function getConfig(configPath = resolve(import.meta.dirname, "../config.json")): HubConfig {
  const raw = readFileSync(configPath, "utf8");
  const cfg = JSON.parse(raw) as Partial<HubConfig>;
  if (!cfg.cloudBaseUrl || !cfg.apiKey || !cfg.signingSecret) {
    throw new Error("hub/config.json must define cloudBaseUrl, apiKey, and signingSecret.");
  }
  return {
    cloudBaseUrl: cfg.cloudBaseUrl.replace(/\/+$/, ""),
    apiKey: cfg.apiKey,
    signingSecret: cfg.signingSecret,
    port: cfg.port ?? 3210,
    dataDir: cfg.dataDir ?? "./data",
    syncIntervalMs: cfg.syncIntervalMs ?? 60000,
    invigilatorCode: cfg.invigilatorCode ?? process.env.INVIGILATOR_CODE ?? "",
    schoolName: cfg.schoolName ?? "Exam Hub",
  };
}