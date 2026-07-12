import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { NerdcUploadClient } from "./client";
import { prisma } from "@/lib/prisma";

export default async function NerdcUploadPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const existing = await prisma.nerdcContent.findFirst({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <NerdcUploadClient hasExisting={!!existing} />
    </div>
  );
}
