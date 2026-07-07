import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CreateSessionForm } from "./create-session-form";
import { SessionCard } from "./session-card";

export default async function SessionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const sessions = await prisma.session.findMany({
    where: { schoolId: user.schoolId },
    include: { terms: { orderBy: { name: "asc" } } },
    orderBy: { label: "desc" },
  });

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">Sessions &amp; Terms</h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Each session has exactly three terms. Only one session and one term can
        be current at a time.
      </p>

      <div className="mt-6">
        <CreateSessionForm />
      </div>

      <div className="mt-8 space-y-4">
        {sessions.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No sessions yet.</p>
        )}
        {sessions.map((s) => (
          <SessionCard
            key={s.id}
            session={{
              id: s.id,
              label: s.label,
              status: s.status,
              isCurrent: s.isCurrent,
              terms: s.terms.map((t) => ({
                id: t.id,
                name: t.name,
                isCurrent: t.isCurrent,
                startDate: t.startDate?.toISOString().slice(0, 10) ?? "",
                endDate: t.endDate?.toISOString().slice(0, 10) ?? "",
              })),
            }}
          />
        ))}
      </div>
    </div>
  );
}
