import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ProprietorChangePasswordForm } from "./form";

export default async function ProprietorChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/proprietor/login");
  if (user.role !== "proprietor") redirect("/dashboard");

  return (
    <main className="flex flex-1 items-center justify-center p-margin-mobile bg-surface">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Change Password</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Please set a new password to continue
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <ProprietorChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
