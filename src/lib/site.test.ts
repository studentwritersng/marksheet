import { describe, it, expect, afterEach } from "vitest";
import { portalLoginUrl } from "./site";

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL;
});

describe("portalLoginUrl", () => {
  it("uses the school's verified custom domain", () => {
    expect(
      portalLoginUrl({ customDomain: "portal.springfield.com", customDomainVerified: true }),
    ).toBe("https://portal.springfield.com/login");
  });

  it("falls back to the platform domain when the custom domain is unverified or missing", () => {
    expect(portalLoginUrl({ customDomain: "portal.springfield.com", customDomainVerified: false })).toBe(
      "https://marksheet.top/login",
    );
    expect(portalLoginUrl({})).toBe("https://marksheet.top/login");
  });

  it("honours NEXT_PUBLIC_SITE_URL for the fallback", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    expect(portalLoginUrl({})).toBe("https://example.com/login");
  });
});
