import { prisma } from "@/lib/prisma";
import { SchoolRegistrationForm } from "./school-registration-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const referralCode = params.ref || undefined;

  const [paymentMethods, setting] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.referralCommissionSetting.findFirst(),
  ]);

  const registrationFee = setting ? Number(setting.registrationFee) : 10000;

  const methods = paymentMethods.map((m) => ({
    id: m.id,
    type: m.type,
    label: m.label,
    details: m.details as { bankName?: string; accountNumber?: string; accountName?: string; instructions?: string } | null,
  }));

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center">
          <span className="material-symbols-outlined text-[32px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Marksheet School Registration</h1>
        <p className="text-sm text-gray-500 mt-1">Register your school to get started with Marksheet.</p>
      </div>
      <SchoolRegistrationForm
        defaultReferralCode={referralCode}
        paymentMethods={methods}
        registrationFee={registrationFee}
      />
    </main>
  );
}
