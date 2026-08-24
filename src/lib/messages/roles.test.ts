// src/lib/messages/roles.test.ts
import { describe, it, expect } from "vitest";
import { isMessagingStaffRole, participantTypeForRole } from "./roles";

describe("isMessagingStaffRole", () => {
  it("treats staff and all admin roles as messaging staff", () => {
    expect(isMessagingStaffRole("staff")).toBe(true);
    expect(isMessagingStaffRole("super_admin")).toBe(true);
    expect(isMessagingStaffRole("platform_owner")).toBe(true);
    expect(isMessagingStaffRole("proprietor")).toBe(true);
  });
  it("rejects non-staff roles", () => {
    for (const r of ["student", "parent", "referral", ""]) {
      expect(isMessagingStaffRole(r)).toBe(false);
    }
  });
});

describe("participantTypeForRole", () => {
  it("maps roles to participant types", () => {
    expect(participantTypeForRole("staff")).toBe("staff");
    expect(participantTypeForRole("proprietor")).toBe("staff");
    expect(participantTypeForRole("super_admin")).toBe("staff");
    expect(participantTypeForRole("platform_owner")).toBe("staff");
    expect(participantTypeForRole("parent")).toBe("parent");
    expect(participantTypeForRole("student")).toBe("student");
  });
});
