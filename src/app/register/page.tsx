import { SchoolRegistrationForm } from "./school-registration-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const referralCode = params.ref || undefined;

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Marksheet School Registration</h1>
        <p className="text-sm text-gray-500 mt-1">Register your school to get started with Marksheet.</p>
      </div>
      <SchoolRegistrationForm defaultReferralCode={referralCode} />
    </main>
  );
}
