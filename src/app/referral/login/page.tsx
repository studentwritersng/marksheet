import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ReferralLoginForm } from "./login-form";

export default async function ReferralLoginPage() {
  const user = await getCurrentUser();
  if (user?.role === "referral") redirect("/referral/dashboard");

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>share</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Referral Agent Login</h1>
        <p className="text-sm text-gray-500 mt-1">Sign in to manage your referrals and commissions.</p>
      </div>
      <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-lg p-6">
        <ReferralLoginForm />
        <p className="text-center text-xs text-gray-400 mt-4">
          Not registered? <a href="/referral" className="text-blue-600 hover:underline">Create an account</a>
        </p>
      </div>
    </main>
  );
}
