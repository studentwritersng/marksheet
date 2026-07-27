import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { VerifyClient } from "./client";

export default async function SchoolVerifyPage(props: {
  params: Promise<{ shortcode: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { shortcode } = await props.params;
  const { code } = await props.searchParams;

  const school = await prisma.school.findFirst({
    where: { shortcode: shortcode.toUpperCase() },
    select: { name: true, logo: true, motto: true },
  });

  if (!school) notFound();

  return (
    <VerifyClient
      schoolName={school.name}
      schoolLogo={school.logo}
      schoolMotto={school.motto}
      shortcode={shortcode.toUpperCase()}
      initialCode={code ?? ""}
    />
  );
}
