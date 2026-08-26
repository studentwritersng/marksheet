import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageFees } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { FeesManager } from "./fees-manager";

export default async function FeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const perms = await resolvePermissions(user);
  if (!canManageFees(perms) || !user.schoolId) {
    return (
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Not authorised.
      </p>
    );
  }
  const schoolId = user.schoolId;

  const currentSession = await prisma.session.findFirst({
    where: { schoolId, isCurrent: true },
    include: { terms: { orderBy: { name: "asc" } } },
  });

  const activeTerm =
    currentSession?.terms.find((t) => t.isCurrent) ??
    currentSession?.terms[0];

  if (!activeTerm || !currentSession) {
    return (
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Fee Items
        </h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          No current session/terms configured. Set up sessions and terms first.
        </p>
      </div>
    );
  }

  // Distinct class levels for this school (used for the level selector).
  const classes = await prisma.class.findMany({
    where: { schoolId },
    distinct: ["level"],
    select: { level: true },
    orderBy: { level: "asc" },
  });
  const levels = classes.map((c) => c.level);

  // Fee items for the active term.
  const items = await prisma.feeItem.findMany({
    where: { schoolId, termId: activeTerm.id },
    orderBy: { level: "asc" },
  });
  const feeItems = items.map((it) => ({
    id: it.id,
    level: it.level,
    name: it.name,
    amount: Number(it.amount),
  }));

  // Other terms in the school to copy from.
  const otherTerms = await prisma.term.findMany({
    where: { session: { schoolId }, id: { not: activeTerm.id } },
    include: { session: { select: { label: true } } },
    orderBy: [{ session: { label: "desc" } }, { name: "asc" }],
  });
  const sourceTerms = otherTerms.map((t) => ({
    id: t.id,
    label: t.session.label,
    termName: t.name,
  }));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">
        Fee Items
      </h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Define the fees charged per class level for the active term.
      </p>
      <div className="mt-6">
        <FeesManager
          activeTermId={activeTerm.id}
          activeTermName={activeTerm.name}
          sessionLabel={currentSession.label}
          levels={levels}
          feeItems={feeItems}
          sourceTerms={sourceTerms}
        />
      </div>
    </div>
  );
}
