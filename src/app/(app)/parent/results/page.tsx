import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAcademicHub } from "./actions";
import HubClient from "./hub-client";

export default async function ParentResultsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "parent") redirect("/login");

  const data = await getAcademicHub(user);

  return (
    <div className="flex flex-col gap-stack-lg">
      <div>
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">Academic Hub</h2>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Published results, homework and exams for your wards.</p>
      </div>
      <HubClient data={data} />
    </div>
  );
}
