import { referralLogoutAction } from "./actions";

export default function ReferralLogoutPage() {
  // Server component that triggers logout on mount via a form
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <form action={referralLogoutAction}>
        <button type="submit" className="text-sm text-gray-400">Signing out...</button>
      </form>
    </main>
  );
}
