import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requireSchoolAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { WizardClient } from "./wizard-client";

export default async function TimetableWizardPage(props: {
  searchParams: Promise<{ restart?: string }>;
}) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  if (!user || !user.schoolId) redirect("/login");

  // Gate entire wizard behind the Timetable Generator addon
  const addonActive = await isAddonActive(user.schoolId, "Timetable Generator");
  if (!addonActive) {
    return (
      <div className="min-h-screen bg-surface py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-warning-container border border-warning text-warning px-4 py-3 rounded-xl font-body-sm text-body-sm">
            The Timetable Generator addon is not active for your school. Enable it on the{" "}
            <a href="/addons" className="underline font-semibold">Addons</a> page to access the setup wizard and automatic scheduler.
          </div>
          <div className="mt-4">
            <a href="/timetable" className="text-primary underline font-semibold text-sm">Back to Timetable</a>
          </div>
        </div>
      </div>
    );
  }

  // Handle restart — mark incomplete, keep previous data, start from intro
  if (sp.restart === "1") {
    await prisma.timetableWizard.upsert({
      where: { schoolId: user.schoolId },
      update: { completed: false, currentStep: 1 },
      create: { schoolId: user.schoolId, currentStep: 1, stepData: {}, completed: false },
    });
  }

  const school = await prisma.school.findUnique({
    where: { id: user.schoolId },
    select: { name: true },
  });

  return (
    <div className="min-h-screen bg-surface py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <WizardClient schoolId={user.schoolId} schoolName={school?.name ?? ""} />
      </div>
    </div>
  );
}
