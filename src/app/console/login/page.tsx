import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ConsoleLoginForm } from "./login-form";

export default async function ConsoleLoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "platform_owner") redirect("/console");
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0e1a] p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-gradient-to-br from-[#002046] to-[#1e3a5f] flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-[28px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-white">Platform Console</h1>
          <p className="font-body-md text-body-md text-white/50 mt-1">
            Platform owner access only
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6 backdrop-blur-sm">
          <ConsoleLoginForm />
        </div>
        <p className="mt-6 text-center font-label-sm text-label-sm text-white/30">
          Authorised personnel only
        </p>
      </div>
    </main>
  );
}
