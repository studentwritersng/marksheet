"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email/send";

export interface DemoRequestResult {
  error?: string;
  success?: string;
}

/**
 * PRD 20 — Demo request / lead capture.
 * Public, unauthenticated form. Creates a DemoRequest record and notifies the
 * Platform Owner(s) by email. No account is created and nothing is unlocked.
 * Spam protection: a honeypot field (`website` in FormData) must be empty.
 */
export async function submitDemoRequestAction(
  _prev: DemoRequestResult,
  formData: FormData,
): Promise<DemoRequestResult> {
  const honeypot = String(formData.get("website") ?? "");
  if (honeypot) {
    // Bots fill every field — silently accept without doing anything.
    return { success: "Thanks! We'll be in touch shortly." };
  }

  const contactName = String(formData.get("contactName") ?? "").trim();
  const schoolName = String(formData.get("schoolName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim();
  const studentCountRange = String(formData.get("studentCountRange") ?? "").trim() || null;
  const message = String(formData.get("message") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "homepage").trim() || "homepage";

  if (!contactName || !schoolName || !email) {
    return { error: "Please fill in your name, school name, and email." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Please enter a valid email address." };
  }

  try {
    await prisma.demoRequest.create({
      data: { contactName, schoolName, phone, email, studentCountRange, message, source },
    });
  } catch {
    return { error: "Something went wrong submitting your request. Please try again." };
  }

  // Notify platform owners (sales-lead mechanism).
  try {
    const owners = await prisma.user.findMany({
      where: { role: "platform_owner", isActive: true },
      select: { email: true },
    });
    const subject = `New demo request — ${schoolName}`;
    const text = [
      `New demo request received.`,
      ``,
      `Contact: ${contactName}`,
      `School: ${schoolName}`,
      `Phone: ${phone ?? "—"}`,
      `Email: ${email}`,
      `Student count: ${studentCountRange ?? "Not specified"}`,
      `Source: ${source}`,
      message ? `Message: ${message}` : null,
      ``,
      `View in the Platform Owner Console → Demo Requests.`,
    ].filter(Boolean).join("\n");
    await Promise.all(
      owners.map((o) =>
        sendEmail({
          to: o.email,
          subject,
          text,
        }),
      ),
    );
  } catch {
    // Notification failure should not block the lead being recorded.
  }

  revalidatePath("/");
  return { success: "Thanks! Our team will reach out to schedule your demo." };
}
