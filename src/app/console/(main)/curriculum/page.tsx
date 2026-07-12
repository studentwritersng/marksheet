import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ImportCurriculumClient } from "./client";
import { getSubjectsByClass } from "./actions";

export default async function ConsoleCurriculumPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const subjectsByClass = getSubjectsByClass();

  return (
    <div>
      <ImportCurriculumClient subjectsByClass={subjectsByClass} />
    </div>
  );
}
