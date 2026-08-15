import { prisma } from "@/lib/prisma";

export function normalizeDomain(host: string): string {
  let h = host.trim().toLowerCase();
  h = h.replace(/^https?:\/\//, "");
  h = h.split("/")[0];
  h = h.split(":")[0];
  if (h.startsWith("www.")) h = h.slice(4);
  return h;
}

export function isMainDomain(host: string): boolean {
  const h = normalizeDomain(host);
  if (h === "localhost" || h.startsWith("localhost:")) return true;
  if (h.endsWith(".vercel.app")) return true;
  const main = (process.env.MAIN_DOMAIN || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .split(":")[0];
  if (main && h === main) return true;
  return false;
}

export async function getSchoolByRequestHost(
  host: string,
): Promise<{ id: string; name: string; logo: string | null; motto: string | null; shortcode: string | null } | null> {
  const domain = normalizeDomain(host);
  if (!domain || isMainDomain(domain)) return null;
  const school = await prisma.school.findUnique({
    where: { customDomain: domain },
    select: { id: true, name: true, logo: true, motto: true, shortcode: true, customDomainVerified: true },
  });
  if (!school || !school.customDomainVerified) return null;
  return {
    id: school.id,
    name: school.name,
    logo: school.logo,
    motto: school.motto,
    shortcode: school.shortcode,
  };
}
