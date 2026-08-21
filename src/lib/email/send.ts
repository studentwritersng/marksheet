"use server";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";

/**
 * Lightweight SMTP email sender using nodemailer.
 *
 * Resolution:
 * - No `schoolId`  -> platform mail via the shared env SMTP (SMTP_HOST/PORT/USER/PASS/FROM).
 * - `schoolId` set, configured (smtpEnabled + host/port/user/pass) -> the school's own SMTP.
 * - `schoolId` set, NOT configured -> hard-blocked: returns { ok: false, error: "SMTP_NOT_CONFIGURED" }.
 *   School mail never falls back to the shared env sender.
 */
export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  /** When present, route through the school's own SMTP sender. */
  schoolId?: string;
}

const ENV_FROM = process.env.SMTP_FROM ?? "noreply@marksheet.dev";

export async function sendEmail(
  options: EmailOptions,
): Promise<{ ok: boolean; error?: string }> {
  // Platform-level mail (no school context): shared env SMTP.
  if (!options.schoolId) {
    return sendViaEnv(options);
  }

  // School-scoped mail: resolve the school's SMTP config.
  const school = await prisma.school.findUnique({
    where: { id: options.schoolId },
    select: {
      smtpEnabled: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassEnc: true,
      smtpFrom: true,
      smtpSecure: true,
    },
  });

  if (
    !school ||
    !school.smtpEnabled ||
    !school.smtpHost ||
    !school.smtpPort ||
    !school.smtpUser ||
    !school.smtpPassEnc
  ) {
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }

  const port = school.smtpPort;
  const pass = decryptSecret(school.smtpPassEnc);
  const from = school.smtpFrom ?? school.smtpUser;

  try {
    const transporter = nodemailer.createTransport({
      host: school.smtpHost,
      port,
      secure: school.smtpSecure || port === 465,
      auth: { user: school.smtpUser, pass },
    });

    await transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EMAIL ERROR]", message);
    return { ok: false, error: message };
  }
}

async function sendViaEnv(
  options: EmailOptions,
): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !port) {
    console.log(`[DEV EMAIL] To: ${options.to} | Subject: ${options.subject}`);
    return { ok: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465,
      auth: user ? { user, pass: pass ?? "" } : undefined,
    });

    await transporter.sendMail({
      from: ENV_FROM,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[EMAIL ERROR]", message);
    return { ok: false, error: message };
  }
}
