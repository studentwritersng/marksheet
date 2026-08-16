const SECRET = process.env.PAYSTACK_SECRET_KEY;

export function paystackEnabled(): boolean {
  return Boolean(SECRET);
}

interface InitArgs {
  email: string;
  amount: number; // in naira
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export async function initializeTransaction({
  email,
  amount,
  reference,
  callbackUrl,
  metadata,
}: InitArgs): Promise<{ authorization_url: string; access_code: string; reference: string }> {
  if (!SECRET) throw new Error("Paystack is not configured.");

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: Math.round(amount * 100), // kobo
      reference,
      callback_url: callbackUrl,
      metadata,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack initialize failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { status: boolean; data: { authorization_url: string; access_code: string; reference: string } };
  return json.data;
}

export async function verifyTransaction(reference: string): Promise<{
  status: string;
  reference: string;
  amount: number;
  metadata?: Record<string, unknown>;
}> {
  if (!SECRET) throw new Error("Paystack is not configured.");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Paystack verify failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    status: boolean;
    data: { status: string; reference: string; amount: number; metadata?: Record<string, unknown> };
  };
  return json.data;
}
