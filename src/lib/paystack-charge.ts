import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { initializeTransaction, paystackEnabled } from "@/lib/paystack";

export type ChargeKind = "school_plan" | "school_addon" | "group_addon";

export interface ChargeInput {
  email: string;
  /** Amount in naira (converted to kobo by the Paystack lib). */
  amount: number;
  schoolId?: string | null;
  groupId?: string | null;
  kind: ChargeKind;
  metadata?: Record<string, unknown>;
  /** Where the user should land after paying (read back from the callback page). */
  redirectTo?: string;
}

export interface ChargeOutput {
  authorizationUrl: string;
  reference: string;
}

/**
 * Create a pending PaymentIntent and start a Paystack transaction, returning the
 * redirect URL. The `redirectTo` is stored in the intent metadata and surfaced
 * by the verify route so the callback page can return the user to the right
 * console screen after payment.
 */
export async function createPaystackCharge(input: ChargeInput): Promise<ChargeOutput> {
  if (!paystackEnabled()) throw new Error("Paystack is not configured.");
  if (!input.email) throw new Error("A contact email is required to start payment.");
  if (!input.amount || input.amount <= 0) throw new Error("Invalid payment amount.");

  const reference = `PS-${input.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const metadata = { ...(input.metadata ?? {}), redirectTo: input.redirectTo ?? "/" };

  await prisma.paymentIntent.create({
    data: {
      schoolId: input.schoolId ?? null,
      groupId: input.groupId ?? null,
      amount: input.amount,
      email: input.email,
      status: "pending",
      paystackRef: reference,
      kind: input.kind,
      metadata: metadata as object,
    },
  });

  // Build an absolute callback URL from the incoming request headers.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_APP_URL ?? "");
  const callbackUrl = `${origin}/paystack/callback`;

  const data = await initializeTransaction({
    email: input.email,
    amount: input.amount,
    reference,
    callbackUrl,
    metadata: { kind: input.kind, ...(input.metadata ?? {}) },
  });

  return { authorizationUrl: data.authorization_url, reference };
}
