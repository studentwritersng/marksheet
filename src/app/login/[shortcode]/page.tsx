import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { SchoolLoginForm } from "./login-form";

export default async function SchoolLoginPage({
  params,
}: {
  params: Promise<{ shortcode: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { shortcode } = await params;

  const school = await prisma.school.findUnique({
    where: { shortcode: shortcode.toUpperCase() },
    select: { id: true, name: true, logo: true, motto: true },
  });

  if (!school) notFound();

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
