import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { BackupClient } from "./client";

export default async function SchoolBackupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const school = await prisma.school.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!school) notFound();

  return <BackupClient schoolId={school.id} schoolName={school.name} />;
}
