import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { AiConfigClient } from "./client";

export default async function ConsoleAiConfigPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const providers = await prisma.aiProviderConfig.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <AiConfigClient
      providers={providers.map((p) => ({
        id: p.id,
        label: p.label,
        baseUrl: p.baseUrl,
        hasKey: !!p.apiKeyEncrypted,
        defaultModelName: p.defaultModelName,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
