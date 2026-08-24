import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { SchoolLoginForm } from "./login-form";
import { LoginDesignRenderer } from "./designs";
import { SchoolMemory, DifferentSchoolLink } from "./school-memory-client";
import {
  resolveLoginTexts,
  isLoginDesign,
  type LoginDesign,
  type LoginTexts,
} from "@/lib/portal-theme";

export default async function SchoolLoginPage({
  params,
}: {
  params: Promise<{ shortcode: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const { shortcode } = await params;

  const school = await prisma.school.findUnique({
    where: { shortcode: shortcode.toUpperCase() },
    select: {
      id: true,
      name: true,
      logo: true,
      motto: true,
      portalTheme: true,
      loginDesign: true,
      loginImage: true,
      loginTexts: true,
    },
  });

  if (!school) notFound();

  const design: LoginDesign = isLoginDesign(school.loginDesign) ? school.loginDesign : "classic";
  const texts: LoginTexts = resolveLoginTexts(design, school.loginTexts as LoginTexts | null);

  const now = new Date();
  const allAnnouncements = await prisma.announcement.findMany({
    where: { schoolId: school.id },
    orderBy: { publishedAt: "desc" },
    take: 10,
  });
  const announcements = allAnnouncements
    .filter(
      (a) =>
        (!a.publishedAt || a.publishedAt <= now) &&
        (!a.expiresAt || a.expiresAt > now),
    )
    .slice(0, 4)
    .map((a) => ({
      id: a.id,
      title: a.title,
      content: a.content,
      publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    }));

  return (
    <div data-portal-theme={school.portalTheme || "blue"}>
      <SchoolMemory shortcode={shortcode} />
      <LoginDesignRenderer
        design={design}
        school={{ name: school.name, logo: school.logo, motto: school.motto }}
        texts={texts}
        image={school.loginImage}
        announcements={announcements}
      >
        <SchoolLoginForm schoolId={school.id} schoolName={school.name} />
      </LoginDesignRenderer>
      <DifferentSchoolLink />
    </div>
  );
}
