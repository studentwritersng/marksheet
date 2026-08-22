export interface ManagedSchoolSource {
  name?: string | null;
  shortcode?: string | null;
  id?: string | null;
  email?: string | null;
}

export function getManagedFrom(school: ManagedSchoolSource): string {
  const domain = process.env.MANAGED_EMAIL_DOMAIN || "marksheet.top";
  const words = (school.name || "").trim().split(/\s+/).filter(Boolean);
  const candidates = [...words, school.shortcode ?? "", school.id ?? ""];
  let local = "";
  for (const candidate of candidates) {
    const sanitized = candidate.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (sanitized) {
      local = sanitized;
      break;
    }
  }
  const display = (school.name || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${display}" <${local}@${domain}>`;
}

export function getManagedReplyTo(school: ManagedSchoolSource): string | undefined {
  return school.email?.trim() || undefined;
}
