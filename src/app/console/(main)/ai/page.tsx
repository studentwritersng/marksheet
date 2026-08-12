import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { redirect } from "next/navigation";
import { dailyWindowStart } from "@/lib/ai/rate-limit";
import { AiConfigClient } from "./client";

export default async function ConsoleAiConfigPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") redirect("/console/login");

  const providers = await prisma.aiProviderConfig.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "asc" }] });

  const settingsRow = await prisma.aiRateLimitSetting.findFirst();
  const rateLimitSettings = settingsRow
    ? {
        enabled: settingsRow.enabled,
        perUserDailyQuota: settingsRow.perUserDailyQuota,
        perUserPerMinuteBurst: settingsRow.perUserPerMinuteBurst,
        perSchoolDailyCap: settingsRow.perSchoolDailyCap,
        resetsAtUtc: settingsRow.resetsAtUtc,
      }
    : {
        enabled: true,
        perUserDailyQuota: 15,
        perUserPerMinuteBurst: 5,
        perSchoolDailyCap: 300,
        resetsAtUtc: "00:00",
      };

  const todayStart = dailyWindowStart(new Date(), rateLimitSettings.resetsAtUtc);
  const buckets = await prisma.aiRateLimitBucket.findMany({
    where: { windowStart: { gte: todayStart } },
    select: { key: true, count: true },
  });
  const groups = buckets.reduce((acc, b) => {
    const n = acc.get(b.key) ?? 0;
    acc.set(b.key, n + b.count);
    return acc;
  }, new Map<string, number>());
  const usage = {
    userDaily: [...groups.entries()].filter(([k]) => k.startsWith("user:") && k.includes(":day:")).reduce((s, [, c]) => s + c, 0),
    userMinute: [...groups.entries()].filter(([k]) => k.startsWith("user:") && k.includes(":min:")).reduce((s, [, c]) => s + c, 0),
    schoolDaily: [...groups.entries()].filter(([k]) => k.startsWith("school:")).reduce((s, [, c]) => s + c, 0),
  };

  return (
    <AiConfigClient
      providers={providers.map((p) => ({
        id: p.id,
        label: p.label,
        baseUrl: p.baseUrl,
        hasKey: !!p.apiKeyEncrypted,
        defaultModelName: p.defaultModelName,
        priority: p.priority,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
      }))}
      rateLimitSettings={rateLimitSettings}
      usage={usage}
    />
  );
}
