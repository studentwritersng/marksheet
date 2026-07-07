"use server";

import nodemailer from "nodemailer";

/**
 * Lightweight SMTP email sender using nodemailer.
 * All SMTP config is read from env (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM).
 * Falls back silently to console.log when env vars are missing (dev default).
 */

export interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@marksheet.dev";

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
