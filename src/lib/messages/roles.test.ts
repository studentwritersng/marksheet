// src/lib/messages/roles.test.ts
import { describe, it, expect } from "vitest";
import { isMessagingStaffRole, participantTypeForRole } from "./roles";

describe("isMessagingStaffRole", () => {
  it("treats staff-like roles and all admin roles as messaging staff", () => {
    expect(isMessagingStaffRole("super_admin")).toBe(true);
    expect(isMessagingStaffRole("platform_owner")).toBe(true);
    expect(isMessagingStaffRole("proprietor")).toBe(true);
    expect(isMessagingStaffRole("teacher")).toBe(true);
    expect(isMessagingStaffRole("hod")).toBe(true);
    expect(isMessagingStaffRole("admin")).toBe(true);
  });
  it("rejects non-staff roles", () => {
    for (const r of ["student", "parent", "referral", ""]) {
      expect(isMessagingStaffRole(r as any)).toBe(false);
    }
  });
});

describe("participantTypeForRole", () => {
  it("maps roles to participant types", () => {
    expect(participantTypeForRole("super_admin")).toBe("admin");
    expect(participantTypeForRole("proprietor")).toBe("admin");
    expect(participantTypeForRole("platform_owner")).toBe("admin");
    expect(participantTypeForRole("admin")).toBe("admin");
    expect(participantTypeForRole("teacher")).toBe("teacher");
    expect(participantTypeForRole("hod")).toBe("teacher");
    expect(participantTypeForRole("student")).toBe("student");
    expect(participantTypeForRole("parent")).toBe("parent");
    expect(participantTypeForRole("referral" as any)).toBe("parent");
    expect(participantTypeForRole("" as any)).toBe("parent");
  });
});
