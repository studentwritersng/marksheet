export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://marksheet.ng";

/**
 * Login URL for credential emails: a school with a verified white-label domain
 * gets its own portal link; everyone else falls back to the platform domain.
 */
export function portalLoginUrl(school: {
  customDomain?: string | null;
  customDomainVerified?: boolean | null;
}): string {
  if (school.customDomain && school.customDomainVerified) {
    return `https://${school.customDomain}/login`;
  }
  return `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://marksheet.top"}/login`;
}
