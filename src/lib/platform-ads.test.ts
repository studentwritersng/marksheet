import { describe, it, expect } from "vitest";
import { filterActiveAdsForRole, type PlatformAdLike } from "./platform-ads";

const now = new Date("2026-08-27T00:00:00Z");
const future = new Date("2026-09-01T00:00:00Z");
const past = new Date("2026-08-01T00:00:00Z");

function ad(p: Partial<PlatformAdLike> & { id: string }): PlatformAdLike & { id: string } {
  return {
    active: true,
    expiresAt: null,
    targetRoles: ["staff"],
    createdAt: now,
    ...p,
  };
}

describe("filterActiveAdsForRole", () => {
  it("returns active, unexpired, role-matching ads newest-first", () => {
    const ads = [
      ad({ id: "old", targetRoles: ["staff"], createdAt: new Date("2026-08-20T00:00:00Z") }),
      ad({ id: "new", targetRoles: ["staff"], createdAt: new Date("2026-08-25T00:00:00Z") }),
    ];
    const res = filterActiveAdsForRole(ads, "staff", now);
    expect(res.map((a) => (a as any).id)).toEqual(["new", "old"]);
  });

  it("excludes expired ads", () => {
    const ads = [ad({ id: "exp", expiresAt: past })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(0);
  });

  it("excludes inactive ads", () => {
    const ads = [ad({ id: "off", active: false })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(0);
  });

  it("excludes ads not targeting the role", () => {
    const ads = [ad({ id: "x", targetRoles: ["student"] })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(0);
  });

  it("includes ads with null expiry", () => {
    const ads = [ad({ id: "forever", expiresAt: null })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(1);
  });

  it("includes ads expiring in the future", () => {
    const ads = [ad({ id: "soon", expiresAt: future })];
    expect(filterActiveAdsForRole(ads, "staff", now)).toHaveLength(1);
  });
});
