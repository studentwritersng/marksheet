import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CurriculumView } from "./curriculum-view";

export default async function CurriculumPage(props: {
  searchParams: Promise<{ classLevel?: string; term?: string; subject?: string }>;
}) {
  const sp = await props.searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const classLevels = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];
  const terms = ["FIRST", "SECOND", "THIRD"];

  const selectedClass = sp.classLevel || "JSS1";
  const selectedTerm = sp.term || "FIRST";
  const selectedSubject = sp.subject || "";

  // Get all subjects the school has (for the add-new dropdown)
  const schoolSubjects = await prisma.subject.findMany({
    where: { schoolId: user.schoolId },
    select: { name: true },
    orderBy: { name: "asc" },
  });
  const allSubjectNames = schoolSubjects.map((s) => s.name);

  // Also get subjects from curriculum for the filter
  const subjectsRaw = await prisma.curriculumTopic.findMany({
    where: { classLevel: selectedClass, schoolId: null },
    select: { subject: true },
    distinct: ["subject"],
    orderBy: { subject: "asc" },
  });
  const curriculumSubjects = subjectsRaw.map((s) => s.subject);
  const filterSubjects = curriculumSubjects.length > 0 ? curriculumSubjects : allSubjectNames;

  const effectiveSubject = selectedSubject || filterSubjects[0] || "";

  // Get topics: system defaults + school overrides
  const systemTopics = await prisma.curriculumTopic.findMany({
    where: { classLevel: selectedClass, term: selectedTerm, subject: effectiveSubject, schoolId: null },
    orderBy: { week: "asc" },
  });

  const overrideTopics = await prisma.curriculumTopic.findMany({
    where: { classLevel: selectedClass, term: selectedTerm, subject: effectiveSubject, schoolId: user.schoolId },
    orderBy: { week: "asc" },
  });
  const overrideMap = new Map(overrideTopics.map((t) => [t.week, t]));

  const merged = systemTopics.map((sys) => overrideMap.get(sys.week) ?? sys);
  for (const ov of overrideTopics) {
    if (!systemTopics.some((s) => s.week === ov.week)) {
      merged.push(ov);
    }
  }
  merged.sort((a, b) => a.week - b.week);

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        NERDC Curriculum
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Reference syllabus from the Nigerian Educational Research and Development Council.
        School admins can add new topics or override existing ones.
      </p>

      <div className="mt-6">
        <CurriculumView
          classLevels={classLevels}
          terms={terms}
          subjects={filterSubjects}
          allSubjects={allSubjectNames}
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          selectedSubject={effectiveSubject}
          topics={merged.map((t) => ({
            id: t.id,
            week: t.week,
            topic: t.topic,
            subTopics: (t.subTopics as string[]) ?? [],
            behaviouralObjectives: (t.behaviouralObjectives as string[]) ?? [],
            isOverride: !t.isSystem && t.schoolId !== null,
            isEditable: t.schoolId === null || t.schoolId === user.schoolId,
          }))}
        />
      </div>
    </div>
  );
}
