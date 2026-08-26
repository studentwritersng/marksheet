import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageFees } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getStudentFeeSummaryBatch,
  type StudentFeeSummary,
} from "@/lib/fees/bursary";
import { PaymentsManager } from "./payments-manager";

interface PaymentRow {
  id: string;
  admissionNumber: string;
  name: string;
  className: string;
  summary: StudentFeeSummary;
}

const EMPTY_SUMMARY: StudentFeeSummary = {
  expected: 0,
  paid: 0,
  balance: 0,
  overpaid: 0,
  status: "no_structure",
  hasStructure: false,
};

export default async function PaymentsPage() {
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
          Payments
        </h1>
        <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
          No current session/terms configured. Set up sessions and terms first.
        </p>
      </div>
    );
  }

  const students = await prisma.student.findMany({
    where: { schoolId },
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      currentClass: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const summaryMap = await getStudentFeeSummaryBatch(schoolId, activeTerm.id);

  const rows: PaymentRow[] = students.map((s) => ({
    id: s.id,
    admissionNumber: s.admissionNumber,
    name: `${s.firstName} ${s.lastName}`.trim(),
    className: s.currentClass?.name ?? "—",
    summary: summaryMap.get(s.id) ?? EMPTY_SUMMARY,
  }));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">
        Payments
      </h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Record and review fee payments for{" "}
        <strong>{activeTerm.name}</strong> ({currentSession.label}).
      </p>
      <div className="mt-6">
        <PaymentsManager
          activeTermId={activeTerm.id}
          activeTermName={activeTerm.name}
          rows={rows}
        />
      </div>
    </div>
  );
}
