import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ImportCurriculumClient } from "./client";
import { ManualCurriculumClient } from "./manual-client";
import { getSubjectsByClass, getSystemEntries } from "./actions";

export default async function ConsoleCurriculumPage(props: {
  searchParams: Promise<{ tab?: string; class?: string; term?: string; subject?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const sp = await props.searchParams;
  const subjectsByClass = await getSubjectsByClass();
  const tab = sp.tab || "import";
  const selClass = sp.class || "JSS1";
  const selTerm = sp.term || "FIRST";
  const selSubject = sp.subject || subjectsByClass[selClass]?.[0] || "";
  const entries = await getSystemEntries(selClass, selTerm, selSubject);

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10">
        <a href="?tab=import"
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "import" ? "border-white text-white" : "border-transparent text-white/40 hover:text-white"
          }`}
        >Import from NERDC</a>
        <a href={`?tab=manual&class=${selClass}&term=${selTerm}&subject=${encodeURIComponent(selSubject)}`}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "manual" ? "border-white text-white" : "border-transparent text-white/40 hover:text-white"
          }`}
        >Manual Entry</a>
      </div>

      {tab === "import" ? (
        <ImportCurriculumClient subjectsByClass={subjectsByClass} />
      ) : (
        <ManualCurriculumClient
          subjectsByClass={subjectsByClass}
          classLevels={["JSS1", "JSS2", "JSS3", "SSS1", "SSS2", "SSS3"]}
          initialClass={selClass}
          initialTerm={selTerm}
          initialSubject={selSubject}
          initialEntries={entries}
        />
      )}
    </div>
  );
}
