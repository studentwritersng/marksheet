export interface ManagedSchoolSource {
  name?: string | null;
  shortcode?: string | null;
  id?: string | null;
  email?: string | null;
}

export function getManagedFrom(school: ManagedSchoolSource): string {
  const domain = process.env.MANAGED_EMAIL_DOMAIN || "marksheet.top";
  const display = (school.name || "").trim();
  const raw = display.split(/\s+/)[0] || school.shortcode || school.id || "";
  const local = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `"${display}" <${local}@${domain}>`;
}

export function getManagedReplyTo(school: ManagedSchoolSource): string | undefined {
  return school.email?.trim() || undefined;
}
