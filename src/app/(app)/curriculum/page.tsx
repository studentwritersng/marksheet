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

  const classLevels = ["JSS1", "JSS2", "JSS3", "SS1", "SS2", "SS3"];
  const terms = ["FIRST", "SECOND", "THIRD"];

  const selectedClass = sp.classLevel || "JSS1";
  const selectedTerm = sp.term || "FIRST";
  const selectedSubject = sp.subject || "";

  // Get all distinct subjects for this class level from the curriculum
  const subjectsRaw = await prisma.curriculumTopic.findMany({
    where: { classLevel: selectedClass, schoolId: null },
    select: { subject: true },
    distinct: ["subject"],
    orderBy: { subject: "asc" },
  });
  const subjects = subjectsRaw.map((s) => s.subject);

  const effectiveSubject = selectedSubject || subjects[0] || "";

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

  // Merge: overrides take precedence
  const merged = systemTopics.map((sys) => overrideMap.get(sys.week) ?? sys);
  // Add any extra weeks from overrides not in system
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
        School admins can override any topic for customisation.
      </p>

      <div className="mt-6">
        <CurriculumView
          classLevels={classLevels}
          terms={terms}
          subjects={subjects}
          selectedClass={selectedClass}
          selectedTerm={selectedTerm}
          selectedSubject={effectiveSubject}
          topics={merged.map((t) => ({
            id: t.id,
            week: t.week,
            topic: t.topic,
            subTopics: (t.subTopics as string[]) ?? [],
            isOverride: !t.isSystem && t.schoolId !== null,
            isEditable: t.schoolId === null || t.schoolId === user.schoolId,
          }))}
        />
      </div>
    </div>
  );
}
