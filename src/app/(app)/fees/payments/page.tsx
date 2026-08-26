import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageFees } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  getStudentFeeSummaryBatch,
  type StudentFeeSummary,
} from "@/lib/fees/bursary";
import { PaymentsManager, type PaymentRecord } from "./payments-manager";

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

export default async function PaymentsPage(props: {
  searchParams: Promise<{ termId?: string; classId?: string }>;
}) {
  const searchParams = await props.searchParams;
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

  // Resolve the selected term from searchParams (defaults to the active term).
  const requestedTermId = searchParams.termId ?? activeTerm.id;
  const selectedTerm =
    currentSession.terms.find((t) => t.id === requestedTermId) ?? activeTerm;
  const selectedTermId = selectedTerm.id;
  const classId = searchParams.classId ?? undefined;

  // Classes for the filter dropdown.
  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const studentsWhere = {
    schoolId,
    ...(classId ? { currentClassId: classId } : {}),
  };

  const students = await prisma.student.findMany({
    where: studentsWhere,
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      currentClass: { select: { name: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const studentIds = students.map((s) => s.id);

  const summaryMap = await getStudentFeeSummaryBatch(schoolId, selectedTermId);

  const rows: PaymentRow[] = students.map((s) => ({
    id: s.id,
    admissionNumber: s.admissionNumber,
    name: `${s.firstName} ${s.lastName}`.trim(),
    className: s.currentClass?.name ?? "—",
    summary: summaryMap.get(s.id) ?? EMPTY_SUMMARY,
  }));

  // Load payment history for the displayed students in the selected term.
  const payments = studentIds.length
    ? await prisma.studentPayment.findMany({
        where: { schoolId, termId: selectedTermId, studentId: { in: studentIds } },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const history: PaymentRecord[] = payments.map((p) => ({
    id: p.id,
    studentId: p.studentId,
    amount: p.amount.toNumber(),
    method: p.method,
    note: p.note,
    paymentDate: p.paymentDate ? p.paymentDate.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">
        Payments
      </h1>
      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
        Record and review fee payments for{" "}
        <strong>{selectedTerm.name}</strong> ({currentSession.label}).
      </p>

      <form className="mt-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-col gap-1">
          <label className="font-label-md text-label-md text-on-surface">Term</label>
          <select name="termId" defaultValue={selectedTermId} className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest">
            {currentSession.terms.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-label-md text-label-md text-on-surface">Class</label>
          <select name="classId" defaultValue={classId ?? ""} className="rounded border border-outline-variant px-2 py-1 font-label-sm text-label-sm text-on-surface bg-surface-container-lowest">
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" className="bg-primary text-on-primary font-label-md text-label-md py-2 px-4 rounded hover:bg-primary-container">
          Filter
        </button>
      </form>

      <div className="mt-6">
        <PaymentsManager
          activeTermId={selectedTermId}
          activeTermName={selectedTerm.name}
          rows={rows}
          history={history}
        />
      </div>
    </div>
  );
}
