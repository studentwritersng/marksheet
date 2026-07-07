import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { SchoolSettingsForm } from "./form";

export default async function SchoolSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const school = await prisma.school.findUnique({ where: { id: user.schoolId } });
  if (!school) return <p className="font-body-sm text-body-sm text-on-surface-variant">School not found.</p>;

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        School Settings
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Configure your school name, logo, address, motto, and contact details. This information appears on the portal header and report cards.
      </p>

      <div className="mt-6 max-w-2xl">
        <SchoolSettingsForm
          school={{
            name: school.name,
            address: school.address ?? "",
            logo: school.logo ?? "",
            signature: school.signature ?? "",
            stamp: school.stamp ?? "",
            phone: school.phone ?? "",
            email: school.email ?? "",
            motto: school.motto ?? "",
          }}
        />
      </div>
    </div>
  );
}
