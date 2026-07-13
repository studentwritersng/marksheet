import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { CreateClassForm } from "./create-class-form";
import { NerdcClassPicker } from "./nerdc-class-picker";
import { ClassRow } from "./class-row";
import Link from "next/link";
import { ExportButtons } from "@/components/export-buttons";

const LEVEL_ORDER = ["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"];

export default async function ClassesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  const admin = canManageSchool(perms);

  if (!admin || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const currentSession = await prisma.session.findFirst({
    where: { schoolId: user.schoolId, isCurrent: true },
  });
  const classes = await prisma.class.findMany({
    where: { schoolId: user.schoolId, archived: false },
    include: { _count: { select: { students: true } }, session: true },
    orderBy: [{ level: "asc" }, { section: "asc" }],
  });

  // Group by level keeping standard order
  const grouped = LEVEL_ORDER.reduce<Record<string, typeof classes>>((acc, lvl) => {
    const items = classes.filter((c) => c.level === lvl);
    if (items.length > 0) acc[lvl] = items;
    return acc;
  }, {});

  const csvHeaders = ["Level", "Class Name", "Section", "Department", "Students", "Session"];
  const csvRows = classes.map((c) => [
    c.level,
    c.name,
    c.section || "",
    c.department || "",
    String(c._count.students),
    c.session?.label ?? "",
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Classes</h1>
          <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
            {currentSession?.label ?? "No active session"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/promotion"
            className="rounded-lg border border-outline-variant px-4 py-2 font-label-md text-label-md text-on-surface hover:bg-surface-container-low"
          >
            Promotion
          </Link>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <CreateClassForm sessionId={currentSession?.id ?? ""} />
        <div className="flex items-center gap-2 pl-1">
          <span className="text-sm text-on-surface-variant">Or create from NERDC class levels:</span>
          <NerdcClassPicker />
        </div>
      </div>

      <div id="classes-content" className="mt-8 space-y-6">
        <div className="flex justify-end">
          <ExportButtons
            contentId="classes-content"
            filename={`Classes_${new Date().toISOString().slice(0, 10)}`}
            pdfTitle="Class List"
            csvData={{ headers: csvHeaders, rows: csvRows }}
          />
        </div>
        {Object.keys(grouped).length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">No classes yet. Create one above.</p>
        )}
        {Object.entries(grouped).map(([level, cls]) => (
          <div key={level}>
            <div className="flex items-center gap-3 mb-2">
              <h2 className="font-label-lg text-label-lg text-on-surface font-semibold">{level}</h2>
              <span className="font-label-sm text-label-sm text-on-surface-variant">
                {cls.reduce((sum, c) => sum + c._count.students, 0)} student{cls.reduce((sum, c) => sum + c._count.students, 0) !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {cls.map((c) => (
                <ClassRow
                  key={c.id}
                  classItem={{
                    id: c.id,
                    name: c.name,
                    section: c.section,
                    department: c.department,
                    studentCount: c._count.students,
                    hasTeacher: false,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}