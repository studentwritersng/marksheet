import { prisma } from "@/lib/prisma";

export async function authenticateHub(
  request: Request,
): Promise<{ hub: { id: string; schoolId: string; name: string; signingSecret: string } } | null> {
  const header = request.headers.get("authorization") ?? "";
  const apiKey = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!apiKey) return null;

  // Match by trying bcrypt against all active hubs is O(n); instead match by hash scan:
  const hubs = await prisma.hub.findMany({ where: { status: "active" }, select: { id: true, schoolId: true, name: true, signingSecret: true, apiKeyHash: true } });
  const bcrypt = (await import("bcryptjs")).default;
  for (const h of hubs) {
    const ok = await bcrypt.compare(apiKey, h.apiKeyHash);
    if (ok) {
      await prisma.hub.update({ where: { id: h.id }, data: { lastSeenAt: new Date() } });
      return { hub: { id: h.id, schoolId: h.schoolId, name: h.name, signingSecret: h.signingSecret } };
    }
  }
  return null;
}