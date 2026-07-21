import { prisma } from "@/lib/prisma";

export interface BranchDetail {
  schoolId: string;
  schoolName: string;
  stage: string;
  suspended: boolean;
  enrollment: number;
  staffCount: number;
  subjectCount: number;
  classCount: number;
  latestTermAverage: number | null;
  licenseStatus: string;
  licenseEndDate: string | null;
  isStale: boolean;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo: string | null;
  motto: string | null;
}

export interface BranchSubjectPerformance {
  subjectName: string;
  averageScore: number | null;
  studentCount: number;
}

export interface BranchClassPerformance {
  className: string;
  level: string;
  averageScore: number | null;
  studentCount: number;
}

export interface BranchTransferSummary {
  incoming: number;
  outgoing: number;
}

export interface DeepBranchData {
  branch: BranchDetail;
  subjectPerformance: BranchSubjectPerformance[];
  classPerformance: BranchClassPerformance[];
  transfers: BranchTransferSummary;
  licenseHistory: {
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    planName: string;
  }[];
  recentTransfers: {
    id: string;
    direction: "in" | "out";
    otherSchoolName: string;
    studentName: string;
    admissionNumber: string;
    transferredAt: string;
  }[];
}

export async function getBranchList(groupId: string): Promise<BranchDetail[]> {
  const group = await prisma.schoolGroup.findUniqueOrThrow({
    where: { id: groupId },
    include: {
      memberships: {
        include: {
          school: {
            select: {
              id: true, name: true, stage: true, suspended: true,
              address: true, phone: true, email: true, logo: true, motto: true,
              _count: {
                  select: {
                    students: { where: { status: "active" } },
                    staff: true,
                    subjects: true,
                  },
                },
            },
          },
        },
      },
    },
  });

  const branches: BranchDetail[] = [];

  for (const m of group.memberships) {
    const school = m.school;

    // Class count (queried separately since School doesn't have a direct classes relation)
    const classCount = await prisma.class.count({
      where: { schoolId: school.id, archived: false },
    });

    // Latest term average
    const currentTerm = await prisma.term.findFirst({
      where: { session: { schoolId: school.id, isCurrent: true }, isCurrent: true },
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

    // License
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
      staffCount: school._count.staff,
      subjectCount: school._count.subjects,
      classCount,
      latestTermAverage,
      licenseStatus: license?.status ?? "none",
      licenseEndDate: license?.endDate.toISOString() ?? null,
      isStale,
      address: school.address,
      phone: school.phone,
      email: school.email,
      logo: school.logo,
      motto: school.motto,
    });
  }

  return branches;
}

export async function getDeepBranchData(groupId: string, schoolId: string): Promise<DeepBranchData | null> {
  // Verify school is in this group
  const membership = await prisma.groupMembership.findUnique({
    where: { schoolId },
  });
  if (!membership || membership.groupId !== groupId) return null;

  const branches = await getBranchList(groupId);
  const branch = branches.find((b) => b.schoolId === schoolId);
  if (!branch) return null;

  // Subject performance
  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { id: true },
  });

  const subjectPerformance: BranchSubjectPerformance[] = [];

  if (currentTerm) {
    const subjects = await prisma.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });

    for (const subject of subjects) {
      const results = await prisma.subjectResult.findMany({
        where: {
          termId: currentTerm.id,
          subjectId: subject.id,
          student: { schoolId, status: "active" },
          totalScore: { not: null },
        },
        select: { totalScore: true },
      });

      if (results.length > 0) {
        const sum = results.reduce((s, r) => s + (r.totalScore ?? 0), 0);
        subjectPerformance.push({
          subjectName: subject.name,
          averageScore: Math.round((sum / results.length) * 100) / 100,
          studentCount: results.length,
        });
      }
    }
  }

  // Class performance
  const classPerformance: BranchClassPerformance[] = [];

  if (currentTerm) {
    const classes = await prisma.class.findMany({
      where: { schoolId, archived: false },
      select: { id: true, name: true, level: true },
    });

    for (const cls of classes) {
      const termResults = await prisma.termResult.findMany({
        where: {
          termId: currentTerm.id,
          student: { schoolId, status: "active", currentClassId: cls.id },
          overallAverage: { not: null },
        },
        select: { overallAverage: true },
      });

      const studentCount = await prisma.student.count({
        where: { schoolId, status: "active", currentClassId: cls.id },
      });

      let avg: number | null = null;
      if (termResults.length > 0) {
        const sum = termResults.reduce((s, r) => s + (r.overallAverage ?? 0), 0);
        avg = Math.round((sum / termResults.length) * 100) / 100;
      }

      classPerformance.push({
        className: cls.name,
        level: cls.level,
        averageScore: avg,
        studentCount,
      });
    }
  }

  // Transfers
  const incomingCount = await prisma.groupStudentTransferRecord.count({
    where: { destinationSchoolId: schoolId, groupId },
  });
  const outgoingCount = await prisma.groupStudentTransferRecord.count({
    where: { originSchoolId: schoolId, groupId },
  });

  // Recent transfers (last 10)
  const recentTransferRecords = await prisma.groupStudentTransferRecord.findMany({
    where: { groupId, OR: [{ originSchoolId: schoolId }, { destinationSchoolId: schoolId }] },
    orderBy: { transferredAt: "desc" },
    take: 10,
    include: {
      originSchool: { select: { name: true } },
      destinationSchool: { select: { name: true } },
      originStudent: { select: { firstName: true, lastName: true, admissionNumber: true } },
      destinationStudent: { select: { firstName: true, lastName: true, admissionNumber: true } },
    },
  });

  // License history
  const licenseHistory = await prisma.schoolLicense.findMany({
    where: { schoolId },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { plan: { select: { name: true } } },
  });

  return {
    branch,
    subjectPerformance: subjectPerformance.sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)),
    classPerformance: classPerformance.sort((a, b) => a.level.localeCompare(b.level)),
    transfers: { incoming: incomingCount, outgoing: outgoingCount },
    licenseHistory: licenseHistory.map((l) => ({
      id: l.id,
      status: l.status,
      startDate: l.startDate.toISOString(),
      endDate: l.endDate.toISOString(),
      planName: l.plan.name,
    })),
    recentTransfers: recentTransferRecords.map((t) => {
      const isIncoming = t.destinationSchoolId === schoolId;
      const student = isIncoming ? t.destinationStudent : t.originStudent;
      const otherSchool = isIncoming ? t.originSchool : t.destinationSchool;
      return {
        id: t.id,
        direction: isIncoming ? "in" as const : "out" as const,
        otherSchoolName: otherSchool.name,
        studentName: `${student.firstName} ${student.lastName}`,
        admissionNumber: student.admissionNumber,
        transferredAt: t.transferredAt.toISOString(),
      };
    }),
  };
}
