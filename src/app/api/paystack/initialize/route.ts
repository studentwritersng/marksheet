import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { initializeTransaction, paystackEnabled } from "@/lib/paystack";

export async function POST(req: NextRequest) {
  if (!paystackEnabled()) {
    return NextResponse.json({ error: "Paystack is not configured." }, { status: 503 });
  }

  let body: { email?: string; amount?: number; invoiceId?: string; invoiceNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { email, amount, invoiceId, invoiceNumber } = body;
  if (!email || !amount || !invoiceId) {
    return NextResponse.json({ error: "Missing email, amount or invoiceId." }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const origin = req.nextUrl.origin;
  const reference = `MS-${invoice.invoiceNumber}-${Date.now()}`;

  try {
    const data = await initializeTransaction({
      email,
      amount,
      reference,
      callbackUrl: `${origin}/paystack/callback`,
      metadata: { invoiceId, invoiceNumber },
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { paystackRef: reference, method: "paystack", status: "pending" },
    });

    return NextResponse.json({ authorizationUrl: data.authorization_url, reference });
  } catch (err) {
    console.error("Paystack initialization error:", err);
    return NextResponse.json({ error: "Payment initialization failed. Please try again." }, { status: 502 });
  }
}
