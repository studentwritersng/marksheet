"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/current-user";

export interface AiActionResult { error?: string; success?: string; }

async function guard() {
  const user = await getCurrentUser();
  if (!user || user.role !== "platform_owner") return null;
  return user;
}

export async function upsertAiProviderAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const id = String(formData.get("id") ?? "").trim() || undefined;
  const label = String(formData.get("label") ?? "").trim();
  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const defaultModelName = String(formData.get("defaultModelName") ?? "").trim();
  const isActive = formData.get("isActive") === "on";

  if (!label || !baseUrl || !defaultModelName) {
    return { error: "Label, base URL, and default model are required." };
  }

  const upsertData: Record<string, unknown> = { label, baseUrl, defaultModelName, isActive };
  if (apiKey) upsertData.apiKeyEncrypted = apiKey;

  if (isActive) {
    await prisma.aiProviderConfig.updateMany({ data: { isActive: false } });
  }

  if (id) {
    await prisma.aiProviderConfig.update({ where: { id }, data: upsertData as never });
  } else {
    await prisma.aiProviderConfig.create({ data: upsertData as never });
  }

  await recordAudit({
    actorId: user.userId, action: id ? "update" : "create", entityType: "ai_provider_config",
    afterValue: { label, baseUrl, defaultModelName } as never,
  });

  revalidatePath("/console/ai");
  return { success: `AI provider "${label}" saved.` };
}

export async function deleteAiProviderAction(id: string): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const provider = await prisma.aiProviderConfig.findUnique({ where: { id }, select: { label: true } });
  await prisma.aiProviderConfig.delete({ where: { id } });

  await recordAudit({
    actorId: user.userId, action: "delete", entityType: "ai_provider_config",
    beforeValue: { label: provider?.label } as never,
  });

  revalidatePath("/console/ai");
  return { success: `AI provider deleted.` };
}

export async function testAiConnectionAction(_prev: AiActionResult, formData: FormData): Promise<AiActionResult> {
  const user = await guard();
  if (!user) return { error: "Not authorised." };

  const baseUrl = String(formData.get("baseUrl") ?? "").trim();
  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();

  if (!baseUrl || !apiKey || !model) {
    return { error: "Base URL, API key, and model are required to test." };
  }

  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "user", content: "Say 'ok' and nothing else." }], max_tokens: 10 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { error: `Connection failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}` };
    }
    return { success: "Connection successful! The provider responded correctly." };
  } catch (e: any) {
    return { error: `Connection error: ${e?.message ?? "Unknown error"}` };
  }
}
