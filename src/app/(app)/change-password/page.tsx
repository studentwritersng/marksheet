import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "./form";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="w-full max-w-md mx-auto">
        <div className="bg-white border border-outline-variant rounded-xl p-8 shadow-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#002046] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-white text-[28px]">lock</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Change Your Password</h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
              You must change your password before continuing.
            </p>
          </div>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
