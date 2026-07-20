import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ProprietorLoginForm } from "./login-form";

export default async function ProprietorLoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "proprietor") redirect("/proprietor");
    if (user.role === "platform_owner") redirect("/console");
    redirect("/dashboard");
  }

  return (
    <main className="flex flex-1 items-center justify-center p-margin-mobile bg-surface">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>workspaces</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Proprietor Console</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Sign in to manage your school group
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <ProprietorLoginForm />
        </div>
        <div className="mt-4 text-center">
          <a href="/login" className="text-xs text-on-surface-variant hover:text-primary underline">
            Back to school login
          </a>
        </div>
      </div>
    </main>
  );
}
