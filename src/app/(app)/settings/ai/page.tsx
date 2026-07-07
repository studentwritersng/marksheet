import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { AiProviderForm } from "./form";

export default async function AiSettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "super_admin") redirect("/dashboard");

  const providers = await prisma.aiProviderConfig.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
        AI Provider Configuration
      </h2>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1">
        Configure AI providers for lesson note generation, essay grading, and question bank generation (PRD 14).
        All AI calls route through the active provider via the AI Gateway.
      </p>

      <div className="mt-6 space-y-6 max-w-2xl">
        {providers.map((p) => (
          <AiProviderForm key={p.id} provider={{
            id: p.id, label: p.label, baseUrl: p.baseUrl,
            defaultModelName: p.defaultModelName, isActive: p.isActive,
          }} />
        ))}
        <AiProviderForm provider={null} />
      </div>
    </div>
  );
}
