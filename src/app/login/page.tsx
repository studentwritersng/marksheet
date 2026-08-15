import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSchoolByRequestHost } from "@/lib/school-domain";
import { SchoolSearchForm } from "./search-form";
import { SchoolLoginForm } from "./[shortcode]/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "proprietor") redirect("/proprietor");
    redirect("/dashboard");
  }

  const host = (await headers()).get("host") ?? "";
  const school = await getSchoolByRequestHost(host);

  if (school) {
    return (
      <main className="flex flex-1 items-center justify-center p-margin-mobile bg-surface">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center overflow-hidden">
              {school.logo ? (
                <img src={school.logo} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              )}
            </div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{school.name}</h1>
            {school.motto && (
              <p className="font-body-md text-body-md text-on-surface-variant mt-1">{school.motto}</p>
            )}
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
            <SchoolLoginForm schoolId={school.id} schoolName={school.name} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-margin-mobile bg-surface">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Marksheet</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Find your school to sign in
          </p>
        </div>
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5">
          <SchoolSearchForm />
        </div>
      </div>
    </main>
  );
}
