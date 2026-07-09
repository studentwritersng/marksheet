import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolvePermissions, canManageSchool } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const perms = await resolvePermissions(user);
  if (!canManageSchool(perms) || !user.schoolId) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Not authorised.</p>;
  }

  const student = await prisma.student.findFirst({
    where: { id, schoolId: user.schoolId },
    include: {
      currentClass: { select: { name: true, level: true, section: true, department: true } },
      guardians: { select: { fullName: true, phone: true, email: true, relationship: true } },
      user: { select: { email: true, isActive: true } },
      subjectResults: {
        include: { subject: { select: { name: true } }, term: { include: { session: { select: { label: true } } } } },
        orderBy: [{ term: { session: { label: "desc" } } }, { term: { name: "desc" as const } }],
      },
      termResults: {
        include: { term: { include: { session: { select: { label: true } } } } },
        orderBy: [{ term: { session: { label: "desc" } } }, { term: { name: "desc" as const } }],
      },
    },
  });

  if (!student) {
    return <p className="font-body-sm text-body-sm text-on-surface-variant">Student not found.</p>;
  }

  const dob = student.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div>
      <Link href="/students" className="font-label-sm text-label-sm text-primary hover:underline">&larr; Back to Students</Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        {/* Profile card */}
        <div className="lg:col-span-1 bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
          {student.passportPhoto ? (
            <img src={student.passportPhoto} alt="" className="w-32 h-32 rounded-full object-cover mx-auto mb-4" />
          ) : (
            <div className="w-32 h-32 rounded-full bg-surface-container mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl font-semibold text-on-surface-variant">
                {student.firstName[0]}{student.lastName[0]}
              </span>
            </div>
          )}
          <h1 className="text-center font-headline-sm text-headline-sm text-on-surface">{student.firstName} {student.lastName}</h1>
          <p className="text-center font-label-sm text-label-sm text-primary mt-1">{student.admissionNumber}</p>
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant mt-1">{student.currentClass?.name || "No class"}{student.currentClass?.department ? ` (${student.currentClass.department})` : ""}</p>

          <hr className="my-4 border-outline-variant" />

          <dl className="space-y-2 font-body-sm text-body-sm">
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Status</dt>
              <dd className={student.status === "active" ? "text-green-700" : "text-on-surface-variant"}>{student.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Gender</dt>
              <dd className="text-on-surface">{student.gender || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Date of Birth</dt>
              <dd className="text-on-surface">{dob || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Ethnicity</dt>
              <dd className="text-on-surface">{student.ethnicity || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Religion</dt>
              <dd className="text-on-surface">{student.religion || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Login Email</dt>
              <dd className="text-on-surface">{student.user?.email || "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-on-surface-variant">Student Email</dt>
              <dd className="text-on-surface">{student.email || "—"}</dd>
            </div>
          </dl>

          {student.guardians.length > 0 && (
            <>
              <hr className="my-4 border-outline-variant" />
              <h3 className="font-label-sm text-label-sm text-on-surface-variant mb-2">Guardian</h3>
              {student.guardians.map((g) => (
                <div key={g.fullName} className="font-body-sm text-body-sm text-on-surface">
                  <p>{g.fullName} ({g.relationship})</p>
                  {g.phone && <p className="text-on-surface-variant">{g.phone}</p>}
                  {g.email && <p className="text-on-surface-variant">{g.email}</p>}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Scores & Results */}
        <div className="lg:col-span-2 space-y-6">
          {/* Term Results */}
          {student.termResults.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-4">Term Results</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container border-b border-outline-variant">
                    <tr>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Session</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Term</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Average</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {student.termResults.map((tr) => (
                      <tr key={tr.id} className="hover:bg-surface-container-low">
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{tr.term.session.label}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{tr.term.name}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{tr.overallAverage?.toFixed(1) ?? "—"}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{tr.overallPosition ? `${tr.overallPosition}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Subject Results */}
          {student.subjectResults.length > 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold mb-4">Subject Scores</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container border-b border-outline-variant">
                    <tr>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Session</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Term</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Subject</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Score</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Grade</th>
                      <th className="py-2 px-3 font-label-sm text-label-sm text-on-surface-variant">Position</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {student.subjectResults.map((sr) => (
                      <tr key={sr.id} className="hover:bg-surface-container-low">
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{sr.term.session.label}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{sr.term.name}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface font-medium">{sr.subject.name}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{sr.totalScore?.toFixed(1) ?? "—"}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{sr.grade || "—"}</td>
                        <td className="py-2 px-3 font-body-sm text-body-sm text-on-surface">{sr.subjectPosition ? `${sr.subjectPosition}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {student.subjectResults.length === 0 && student.termResults.length === 0 && (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6">
              <p className="font-body-sm text-body-sm text-on-surface-variant">No scores or results recorded yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
