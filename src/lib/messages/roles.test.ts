// src/lib/messages/roles.test.ts
import { describe, it, expect } from "vitest";
import { isMessagingStaffRole, participantTypeForRole } from "./roles";

describe("isMessagingStaffRole", () => {
  it("treats school staff and admin roles as messaging staff", () => {
    expect(isMessagingStaffRole("super_admin")).toBe(true);
    expect(isMessagingStaffRole("platform_owner")).toBe(true);
    expect(isMessagingStaffRole("proprietor")).toBe(true);
    expect(isMessagingStaffRole("staff")).toBe(true); // teachers, HODs, school-admins are all role "staff"
  });
  it("rejects non-staff roles", () => {
    for (const r of ["student", "parent", "referral", ""] as UserRole[]) {
      expect(isMessagingStaffRole(r)).toBe(false);
    }
  });
});

describe("participantTypeForRole", () => {
  it("maps roles to participant types", () => {
    expect(participantTypeForRole("super_admin")).toBe("staff");
    expect(participantTypeForRole("platform_owner")).toBe("staff");
    expect(participantTypeForRole("proprietor")).toBe("staff");
    expect(participantTypeForRole("staff")).toBe("staff");
    expect(participantTypeForRole("student")).toBe("student");
    expect(participantTypeForRole("parent")).toBe("parent");
    expect(participantTypeForRole("referral")).toBe("staff");
    expect(participantTypeForRole("" as UserRole)).toBe("staff");
  });
});
