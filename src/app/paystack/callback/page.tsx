"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, Check, X } from "lucide-react";

function CallbackInner() {
  const params = useSearchParams();
  const reference = params.get("reference");
  const [status, setStatus] = useState<"loading" | "paid" | "failed">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!reference) {
      setStatus("failed");
      setMessage("Missing payment reference.");
      return;
    }
    fetch(`/api/paystack/verify?reference=${encodeURIComponent(reference)}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.ok && data.status === "paid") {
          setStatus("paid");
          // Send the user back to the originating console screen (e.g. /addons,
          // /billing). Registration uses "/" so it keeps the success card.
          const redirectTo = typeof data.redirectTo === "string" ? data.redirectTo : "/";
          if (redirectTo && redirectTo !== "/") {
            window.location.href = redirectTo;
          }
        } else {
          setStatus("failed");
          setMessage(data.error || "We could not confirm your payment. Our team will still verify it.");
        }
      })
      .catch(() => {
        setStatus("failed");
        setMessage("We could not reach the payment verifier. Our team will confirm your payment.");
      });
  }, [reference]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-mk-bg px-5 text-mk-fg">
      <div className="w-full max-w-md rounded-3xl border border-mk-border bg-mk-card p-8 text-center shadow-mk-lift">
        {status === "loading" && <p className="text-sm text-mk-muted-fg">Confirming your payment…</p>}
        {status === "paid" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
              <Check className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-mk-display text-2xl font-bold">Payment successful</h1>
            <p className="mt-3 text-sm text-mk-muted-fg">
              Thank you. Our team will call you within 24 hours to complete your school setup.
            </p>
          </>
        )}
        {status === "failed" && (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-red-100 text-red-600">
              <X className="h-8 w-8" />
            </div>
            <h1 className="mt-6 font-mk-display text-2xl font-bold">Payment not confirmed</h1>
            <p className="mt-3 text-sm text-mk-muted-fg">{message}</p>
          </>
        )}
        <Link
          href="/"
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-mk-ink px-6 py-3.5 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
        >
          Back to home
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

export default function PaystackCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-mk-bg text-mk-muted-fg">Loading…</div>}>
      <CallbackInner />
    </Suspense>
  );
}
