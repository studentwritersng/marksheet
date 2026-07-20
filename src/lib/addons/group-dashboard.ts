import { prisma } from "@/lib/prisma";

export interface BranchSummary {
  schoolId: string;
  schoolName: string;
  stage: string;
  suspended: boolean;
  enrollment: number;
  latestTermAverage: number | null;
  licenseStatus: string | null; // active / expired / grace_period / suspended / none
  licenseEndDate: string | null;
  isStale: boolean; // license expired → data may be stale
}

export interface SubjectComparison {
  subjectId: string;
  subjectName: string;
  branchAverages: { schoolId: string; schoolName: string; average: number | null }[];
}

export interface TransferRecord {
  id: string;
  originSchoolName: string;
  destinationSchoolName: string;
  originStudentName: string;
  originAdmissionNumber: string;
  destinationStudentName: string;
  destinationAdmissionNumber: string;
  transferredAt: string;
  initiatedBy: string | null;
  notes: string | null;
}

export interface GroupDashboardData {
  groupId: string;
  groupName: string;
  feeGroupStage: string | null;
  branches: BranchSummary[];
  subjectComparisons: SubjectComparison[];
  transfers: TransferRecord[];
}

/**
 * Build the full proprietor dashboard data for a school group.
 * Aggregates enrollment, latest-term performance, license status,
 * subject-level comparison, and transfer records — all scoped to the group.
 */
export async function getGroupDashboardData(groupId: string): Promise<GroupDashboardData> {
  const group = await prisma.schoolGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      memberships: {
        include: {
          school: {
            select: {
              id: true,
              name: true,
              stage: true,
              suspended: true,
              _count: { select: { students: { where: { status: "active" } } } },
            },
          },
        },
      },
    },
  });

  const schoolIds = group.memberships.map((m) => m.schoolId);

  // ── Per-branch latest term performance + license status ────────────────
  const branches: BranchSummary[] = [];

  for (const m of group.memberships) {
    const school = m.school;

    // Find the current term for this school
    const currentTerm = await prisma.term.findFirst({
      where: {
        session: { schoolId: school.id, isCurrent: true },
        isCurrent: true,
      },
      select: { id: true },
    });

    let latestTermAverage: number | null = null;
    if (currentTerm) {
      const termResults = await prisma.termResult.findMany({
        where: {
          termId: currentTerm.id,
          student: { schoolId: school.id, status: "active" },
          overallAverage: { not: null },
        },
        select: { overallAverage: true },
      });
      if (termResults.length > 0) {
        const sum = termResults.reduce((s, r) => s + (r.overallAverage ?? 0), 0);
        latestTermAverage = Math.round((sum / termResults.length) * 100) / 100;
      }
    }

    // License status
    const license = await prisma.schoolLicense.findFirst({
      where: { schoolId: school.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, endDate: true },
    });

    const now = new Date();
    const isStale = license
      ? (license.status === "expired" || license.endDate < now)
      : false;

    branches.push({
      schoolId: school.id,
      schoolName: school.name,
      stage: school.stage,
      suspended: school.suspended,
      enrollment: school._count.students,
      latestTermAverage,
      licenseStatus: license?.status ?? "none",
      licenseEndDate: license?.endDate.toISOString() ?? null,
      isStale,
    });
  }

  // ── Subject comparison across branches ──────────────────────────────────
  // Get all subjects that appear in any branch's current term results
  const allSubjects = await prisma.subject.findMany({
    where: { schoolId: { in: schoolIds } },
    select: { id: true, name: true, schoolId: true },
  });

  // Group subjects by name (same subject name across branches = comparable)
  const subjectNames = Array.from(new Set(allSubjects.map((s) => s.name)));

  const subjectComparisons: SubjectComparison[] = [];

  for (const subjectName of subjectNames) {
    const branchAverages: { schoolId: string; schoolName: string; average: number | null }[] = [];

    for (const branch of branches) {
      // Find subject IDs matching this name in this school
      const subjIds = allSubjects
        .filter((s) => s.schoolId === branch.schoolId && s.name === subjectName)
        .map((s) => s.id);

      if (subjIds.length === 0) {
        branchAverages.push({ schoolId: branch.schoolId, schoolName: branch.schoolName, average: null });
        continue;
      }

      // Get the current term for this school
      const currentTerm = await prisma.term.findFirst({
        where: {
          session: { schoolId: branch.schoolId, isCurrent: true },
          isCurrent: true,
        },
        select: { id: true },
      });

      if (!currentTerm) {
        branchAverages.push({ schoolId: branch.schoolId, schoolName: branch.schoolName, average: null });
        continue;
      }

      const subjectResults = await prisma.subjectResult.findMany({
        where: {
          termId: currentTerm.id,
          subjectId: { in: subjIds },
          student: { schoolId: branch.schoolId, status: "active" },
          totalScore: { not: null },
        },
        select: { totalScore: true },
      });

      if (subjectResults.length === 0) {
        branchAverages.push({ schoolId: branch.schoolId, schoolName: branch.schoolName, average: null });
        continue;
      }

      const sum = subjectResults.reduce((s, r) => s + (r.totalScore ?? 0), 0);
      const avg = Math.round((sum / subjectResults.length) * 100) / 100;
      branchAverages.push({ schoolId: branch.schoolId, schoolName: branch.schoolName, average: avg });
    }

    // Only include subjects where at least one branch has data
    if (branchAverages.some((b) => b.average !== null)) {
      subjectComparisons.push({
        subjectId: "",
        subjectName,
        branchAverages,
      });
    }
  }

  // Fix subjectId (we used a placeholder above — use the name as id for keying)
  subjectComparisons.forEach((s) => { s.subjectId = s.subjectName; });

  // ── Transfer records ─────────────────────────────────────────────────────
  const transferRecords = await prisma.groupStudentTransferRecord.findMany({
    where: { groupId },
    orderBy: { transferredAt: "desc" },
    include: {
      originSchool: { select: { name: true } },
      destinationSchool: { select: { name: true } },
      originStudent: { select: { firstName: true, lastName: true, admissionNumber: true } },
      destinationStudent: { select: { firstName: true, lastName: true, admissionNumber: true } },
    },
  });

  const transfers: TransferRecord[] = transferRecords.map((t) => ({
    id: t.id,
    originSchoolName: t.originSchool.name,
    destinationSchoolName: t.destinationSchool.name,
    originStudentName: `${t.originStudent.firstName} ${t.originStudent.lastName}`,
    originAdmissionNumber: t.originStudent.admissionNumber,
    destinationStudentName: `${t.destinationStudent.firstName} ${t.destinationStudent.lastName}`,
    destinationAdmissionNumber: t.destinationStudent.admissionNumber,
    transferredAt: t.transferredAt.toISOString(),
    initiatedBy: t.initiatedBy,
    notes: t.notes,
  }));

  return {
    groupId: group.id,
    groupName: group.name,
    feeGroupStage: group.feeGroupStage,
    branches,
    subjectComparisons,
    transfers,
  };
}
