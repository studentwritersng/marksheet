import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { referralLogoutAction } from "./actions";

export const metadata: Metadata = {
  title: "Signing out | Marksheet",
  description: "Signing you out of your Marksheet referral agent account.",
};

export default function ReferralLogoutPage() {
  return (
    <main className="marketing-root min-h-screen bg-mk-bg text-mk-fg">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-mk-secondary text-mk-secondary-fg">
          <LogOut className="h-6 w-6" />
        </div>
        <h1 className="mt-6 font-mk-display text-2xl font-bold">Sign out of your account?</h1>
        <p className="mt-2 text-sm text-mk-muted-fg">
          You can always log back in with your email and password.
        </p>
        <form action={referralLogoutAction} className="mt-8">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-mk-ink px-6 py-3 text-sm font-bold text-mk-ink-fg transition-colors hover:bg-mk-primary"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
        <Link
          href="/referral/dashboard"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mk-primary hover:underline"
        >
          Cancel and go back
        </Link>
      </div>
    </main>
  );
}
