import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { MarketingLandingPage } from "./(marketing)/landing-page";

export const metadata = {
  title: "Marksheet: Run the Whole School Term in One Place",
  description:
    "From syllabus upload to a verified report card. Marksheet runs sessions, terms, CA, exams and results for Nigerian secondary schools, offline-ready and tamper-proof.",
  openGraph: {
    title: "Marksheet: Run the whole school term in one place",
    description:
      "Syllabus, lesson notes, exams, AI grading and verified report cards for Nigerian secondary schools.",
    type: "website",
  },
};

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    if (user.role === "platform_owner") redirect("/console");
    if (user.role === "referral") redirect("/referral/dashboard");
    redirect("/dashboard");
  }

  return <MarketingLandingPage />;
}
