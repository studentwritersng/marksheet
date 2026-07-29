import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isGroupAddonActive } from "@/lib/addons/group-check";
import { StudentsPageClient } from "./students-page-client";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);
  const isTeacher = perms.classTeacherClassIds.size > 0 || perms.subjectTeacherClassIds.size > 0;

  if (!admin && !isTeacher || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }
  const schoolId = user.schoolId;

  const classIds = admin
    ? undefined
    : [...new Set([...perms.classTeacherClassIds, ...perms.subjectTeacherClassIds])];
  const classFilter = classIds && classIds.length > 0 ? { in: classIds } : undefined;

  const [students, classes, sessions, membership] = await Promise.all([
    prisma.student.findMany({
      where: { schoolId, ...(classFilter ? { currentClassId: classFilter } : {}) },
      include: {
        currentClass: { select: { name: true, level: true } },
        guardians: { select: { fullName: true, email: true, phone: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.class.findMany({
      where: { schoolId, archived: false, ...(classFilter ? { id: classFilter } : {}) },
      select: { id: true, name: true, level: true, section: true, department: true },
      orderBy: [{ level: "asc" }, { section: "asc" }],
    }),
    prisma.session.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, isCurrent: true },
    }),
    prisma.groupMembership.findUnique({
      where: { schoolId },
      select: { groupId: true },
    }),
  ]);

  let canTransferFromBranch = false;
  if (membership) {
    canTransferFromBranch = await isGroupAddonActive(membership.groupId, "Multi-Branch / Group of Schools");
  }

  const terms = await prisma.term.findMany({
    where: { session: { schoolId: user.schoolId } },
    select: { id: true, name: true, sessionId: true, isCurrent: true },
  });

  return (
    <StudentsPageClient
      students={students.map((s) => ({
        id: s.id,
        admissionNumber: s.admissionNumber,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        gender: s.gender,
        status: s.status,
        className: s.currentClass?.name ?? null,
        classLevel: s.currentClass?.level ?? null,
        guardianName: s.guardians[0]?.fullName ?? null,
        guardianPhone: s.guardians[0]?.phone ?? null,
        isClassCaptain: false,
        isViceClassCaptain: false,
      }))}
      classes={classes.map((c) => ({ id: c.id, name: c.name, level: c.level, section: c.section, department: c.department }))}
      sessions={sessions.map((s) => ({ id: s.id, label: s.label, isCurrent: s.isCurrent }))}
      terms={terms.map((t) => ({ id: t.id, name: t.name, sessionId: t.sessionId, isCurrent: t.isCurrent }))}
      canTransferFromBranch={canTransferFromBranch}
    />
  );
}
