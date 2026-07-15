import { prisma } from "@/lib/prisma";

export async function SchoolLicenseBanner({ schoolId }: { schoolId: string }) {
  const now = new Date();

  const license = await prisma.schoolLicense.findFirst({
    where: { schoolId, status: { in: ["active", "grace_period"] } },
    orderBy: { endDate: "desc" },
    select: { status: true, endDate: true, plan: { select: { name: true } } },
  });

  if (!license) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-[20px] text-red-600">gpp_bad</span>
        <p className="font-body-sm text-body-sm text-red-700">
          No license assigned. Contact the platform owner to activate your school.
        </p>
      </div>
    );
  }

  const daysRemaining = Math.ceil(
    (license.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Grace period — endDate passed
  if (license.status === "grace_period" || daysRemaining < 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-[20px] text-red-600">error</span>
        <div>
          <p className="font-body-sm text-body-sm text-red-700 font-medium">License Expired</p>
          <p className="font-body-sm text-body-sm text-red-600">
            Your {license.plan.name} license expired {Math.abs(daysRemaining)} day(s) ago. Renew now to avoid service interruption.
          </p>
        </div>
      </div>
    );
  }

  // Expiring within 7 days — warning
  if (daysRemaining <= 7) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-[20px] text-amber-600">warning</span>
        <div>
          <p className="font-body-sm text-body-sm text-amber-700 font-medium">License Expiring Soon</p>
          <p className="font-body-sm text-body-sm text-amber-600">
            Your {license.plan.name} license expires in {daysRemaining} day(s). Contact the platform owner to renew.
          </p>
        </div>
      </div>
    );
  }

  // More than 7 days — no banner
  return null;
}
