import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { school: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { normalizeDomain, getSchoolByRequestHost, isMainDomain } from "./school-domain";

describe("normalizeDomain", () => {
  it("lowercases, drops scheme, port and www", () => {
    expect(normalizeDomain("https://WWW.Portal.StMarys.sch.ng:3000/")).toBe("portal.stmarys.sch.ng");
    expect(normalizeDomain("PORTAL.STMARYS.SCH.NG")).toBe("portal.stmarys.sch.ng");
  });
});

describe("getSchoolByRequestHost", () => {
  it("returns the school for a matching verified domain", async () => {
    (prisma.school.findUnique as any).mockResolvedValue({
      id: "s1", name: "St Marys", logo: null, motto: null, shortcode: "SMS", customDomainVerified: true,
    });
    const s = await getSchoolByRequestHost("portal.stmarys.sch.ng");
    expect(s?.id).toBe("s1");
    expect(s?.shortcode).toBe("SMS");
  });

  it("returns null when no school matches", async () => {
    (prisma.school.findUnique as any).mockResolvedValue(null);
    expect(await getSchoolByRequestHost("nope.example.com")).toBeNull();
  });

  it("returns null when the domain is stored but not verified", async () => {
    (prisma.school.findUnique as any).mockResolvedValue({
      id: "s1", name: "X", logo: null, motto: null, shortcode: "X", customDomainVerified: false,
    });
    expect(await getSchoolByRequestHost("portal.stmarys.sch.ng")).toBeNull();
  });
});

describe("isMainDomain", () => {
  it("treats MAIN_DOMAIN and localhost as main", () => {
    process.env.MAIN_DOMAIN = "marksheet.com";
    expect(isMainDomain("marksheet.com")).toBe(true);
    expect(isMainDomain("localhost:3000")).toBe(true);
    expect(isMainDomain("portal.stmarys.sch.ng")).toBe(false);
  });
});
