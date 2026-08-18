import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { isAddonActive } from "@/lib/addons/check";
import { CurriculumTrackerView } from "./curriculum-tracker-view";

export default async function CurriculumTrackerPage(props: {
  searchParams: Promise<{ childId?: string }>;
}) {
  const { childId } = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const addonActive = await isAddonActive(user.schoolId, "Period Tracker");
  if (!addonActive) {
    return (
      <div className="text-center py-12">
        <p className="font-body-md text-body-md text-on-surface-variant">Period Tracker addon is not active for this school.</p>
      </div>
    );
  }

  const schoolId = user.schoolId;
  const admin = canManageSchool(perms);

  // Determine which classes the user can see
  let classIds: string[] = [];
  let teacherSubjects: { subjectId: string; subjectName: string; classNames: string[] }[] = [];
  let studentClassId: string | null = null;
  let children: { id: string; name: string; className: string }[] = [];
  let selectedChildId: string | null = null;

  if (admin) {
    // Admin sees all classes
    const classes = await prisma.class.findMany({ where: { schoolId, archived: false }, select: { id: true } });
    classIds = classes.map((c) => c.id);
  } else if (user.role === "student" && user.userId) {
    // Student sees only their class
    const student = await prisma.student.findFirst({
      where: { userId: user.userId, schoolId },
      select: { currentClassId: true },
    });
    if (student?.currentClassId) {
      classIds = [student.currentClassId];
      studentClassId = student.currentClassId;
    }
  } else if (user.role === "staff" && user.staffId) {
    // Staff: subject teachers see their classes, class teachers see their class
    const assignments = await prisma.assignment.findMany({
      where: { staffId: user.staffId },
      include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } } },
    });
    const seenClassIds = new Set<string>();
    const subjectMap = new Map<string, { subjectId: string; subjectName: string; classNames: string[] }>();

    for (const a of assignments) {
      if (a.classId) {
        seenClassIds.add(a.classId);
      }
      if (a.assignmentType === "subject_teacher" && a.subject && a.class) {
        const existing = subjectMap.get(a.subject.id);
        if (existing) {
          existing.classNames.push(a.class.name);
        } else {
          subjectMap.set(a.subject.id, {
            subjectId: a.subject.id,
            subjectName: a.subject.name,
            classNames: [a.class.name],
          });
        }
      }
    }
    classIds = Array.from(seenClassIds);
    teacherSubjects = Array.from(subjectMap.values());
  } else if (user.role === "parent" && user.userId) {
    // Parent sees the curriculum for their linked wards; pick a child first.
    const guardians = await prisma.guardian.findMany({
      where: { parentUserId: user.userId, student: { schoolId } },
      include: {
        student: {
          include: { currentClass: { select: { id: true, name: true, level: true } } },
        },
      },
    });
    const wards = guardians
      .map((g) => g.student)
      .filter((s): s is typeof s & { currentClassId: string } => Boolean(s.currentClassId));

    children = wards.map((w) => ({
      id: w.id,
      name: `${w.firstName} ${w.lastName}`,
      className: w.currentClass?.name ?? "No class",
    }));

    if (wards.length > 0) {
      // Only honor a childId that belongs to this parent's own wards.
      const selected = wards.find((w) => w.id === childId) ?? wards[0];
      classIds = [selected.currentClassId];
      studentClassId = selected.currentClassId;
      selectedChildId = selected.id;
    }
  }

  if (user.role === "parent" && children.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-body-md text-body-md text-on-surface-variant">No wards linked to your account.</p>
      </div>
    );
  }

  if (classIds.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="font-body-md text-body-md text-on-surface-variant">No classes assigned to you.</p>
      </div>
    );
  }

  // Get current term
  const currentTerm = await prisma.term.findFirst({
    where: { session: { schoolId, isCurrent: true }, isCurrent: true },
    select: { name: true },
  });
  if (!currentTerm) {
    return (
      <div className="text-center py-12">
        <p className="font-body-md text-body-md text-on-surface-variant">No active term found.</p>
      </div>
    );
  }

  // Build tracker data for each class/subject
  const classes = await prisma.class.findMany({
    where: { id: { in: classIds } },
    select: { id: true, name: true, level: true },
    orderBy: { name: "asc" },
  });

  interface TrackerRow {
    className: string;
    subjectName: string;
    total: number;
    taught: number;
    pct: number;
    topics: { topic: string; week: number; taught: boolean }[];
  }

  const trackerData: TrackerRow[] = [];

  // term.name is enum "First"/"Second"/"Third" — CurriculumTopic.term stores "FIRST"/"SECOND"/"THIRD"
  const curriculumTermName = currentTerm.name.toUpperCase();

  for (const cls of classes) {
    // For subject teachers, only show their assigned subjects
    const classSubjects = admin || studentClassId
      ? await prisma.classSubject.findMany({
          where: { classId: cls.id },
          include: { subject: { select: { id: true, name: true } } },
        })
      : await prisma.classSubject.findMany({
          where: { classId: cls.id, subjectId: { in: teacherSubjects.map((t) => t.subjectId) } },
          include: { subject: { select: { id: true, name: true } } },
        });

    for (const cs of classSubjects) {
      // Get all curriculum topics for this class/subject/term
      const topics = await prisma.curriculumTopic.findMany({
        where: { classLevel: cls.level, subject: cs.subject.name, term: curriculumTermName },
        orderBy: [{ week: "asc" }, { weekSuffix: "asc" }],
        select: { id: true, topic: true, week: true },
      });
      if (topics.length === 0) continue;

      // Get taught topics
      const taught = await prisma.taughtTopic.findMany({
        where: { classId: cls.id, subjectId: cs.subject.id, teacherMarked: true, captainMarked: true },
        select: { curriculumTopicId: true },
      });
      const taughtIds = new Set(taught.map((t) => t.curriculumTopicId).filter(Boolean));

      trackerData.push({
        className: cls.name,
        subjectName: cs.subject.name,
        total: topics.length,
        taught: taughtIds.size,
        pct: Math.round((taughtIds.size / topics.length) * 100),
        topics: topics.map((t) => ({
          topic: t.topic,
          week: t.week,
          taught: taughtIds.has(t.id),
        })),
      });
    }
  }

  const overall = trackerData.reduce(
    (acc, r) => ({ taught: acc.taught + r.taught, total: acc.total + r.total }),
    { taught: 0, total: 0 },
  );
  const overallPct = overall.total > 0 ? Math.round((overall.taught / overall.total) * 100) : 0;

  return (
    <CurriculumTrackerView
      data={trackerData}
      overallPct={overallPct}
      overallTaught={overall.taught}
      overallTotal={overall.total}
      termName={currentTerm.name}
      isAdmin={admin}
      teacherSubjects={teacherSubjects}
      studentClassId={studentClassId}
      childrenList={children}
      selectedChildId={selectedChildId}
    />
  );
}
