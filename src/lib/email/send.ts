"use server";

import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/secrets";
import { getManagedFrom, getManagedReplyTo } from "./managed-from";

/**
 * Email sender.
 *
 * Resolution:
 * - No `schoolId` -> platform mail via the shared env SMTP (SMTP_HOST/PORT/USER/PASS/FROM).
 * - `schoolId` set, BYO SMTP fully configured (smtpEnabled + host/port/user/pass) -> the school's own SMTP.
 * - `schoolId` set, no BYO, RESEND_API_KEY present -> managed sending via Resend
 *   (from = "School Name" <firstword@MANAGED_EMAIL_DOMAIN>, replyTo = school.email).
 * - Otherwise -> hard-blocked: returns { ok: false, error: "SMTP_NOT_CONFIGURED" }.
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
      name: true,
      email: true,
      shortcode: true,
      id: true,
      smtpEnabled: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      smtpPassEnc: true,
      smtpFrom: true,
      smtpSecure: true,
    },
  });

  if (!school) {
    return { ok: false, error: "SMTP_NOT_CONFIGURED" };
  }

  // 1) BYO-SMTP takes precedence when fully configured.
  if (school.smtpEnabled && school.smtpHost && school.smtpPort && school.smtpUser && school.smtpPassEnc) {
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
      await transporter.sendMail({ from, to: options.to, subject: options.subject, text: options.text, html: options.html });
      return { ok: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[EMAIL ERROR]", message);
      return { ok: false, error: message };
    }
  }

  // 2) Managed sending via the platform Resend domain.
  if (process.env.RESEND_API_KEY) {
    return sendViaManaged(options, school);
  }

  // 3) Neither available.
  return { ok: false, error: "SMTP_NOT_CONFIGURED" };
}

async function sendViaManaged(
  options: EmailOptions,
  school: { name: string; email?: string | null; shortcode?: string | null; id: string },
): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.MANAGED_EMAIL_HOST || "smtp.resend.com";
  const port = parseInt(process.env.MANAGED_EMAIL_PORT || "587", 10);
  const pass = process.env.RESEND_API_KEY as string;
  const from = getManagedFrom(school);
  const replyTo = getManagedReplyTo(school);
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: "resend", pass },
    });
    await transporter.sendMail({ from, to: options.to, subject: options.subject, text: options.text, html: options.html, replyTo });
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
