import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function SchoolsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "super_admin" && user.role !== "platform_owner")) redirect("/dashboard");

  const schools = await prisma.school.findMany({ orderBy: { name: "asc" } });

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        Schools
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Platform-wide school management.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {schools.map((s) => (
          <div key={s.id} className="card-light hover:border-primary transition-colors">
            <div className="font-label-md text-label-md text-on-surface-variant mb-1">School</div>
            <div className="font-headline-sm text-headline-sm text-on-surface font-semibold">{s.name}</div>
            {s.address && <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">{s.address}</p>}
            <div className="mt-3 flex gap-2 text-sm">
              {s.phone && <span className="text-on-surface-variant">{s.phone}</span>}
              {s.email && <span className="text-on-surface-variant">{s.email}</span>}
            </div>
          </div>
        ))}
        {schools.length === 0 && (
          <p className="text-on-surface-variant font-body-sm text-body-sm">No schools registered yet.</p>
        )}
      </div>
    </div>
  );
}
