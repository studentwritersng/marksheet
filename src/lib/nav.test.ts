import { describe, it, expect } from "vitest";
import { buildNav } from "./nav";
import type { SessionPayload } from "@/lib/auth/session";
import type { EffectivePermissions } from "@/lib/auth/permissions";

function teacherPayload(): SessionPayload {
  return {
    userId: "user_1",
    role: "staff",
    schoolId: "school_1",
    staffId: "staff_1",
    email: "t@example.com",
    mustChangePassword: false,
  };
}

function teacherPerms(): EffectivePermissions {
  const visibleSubjectIds = new Set(["subj_1"]);
  return {
    isSuperAdmin: false,
    isSchoolAdmin: false,
    isExamOfficer: false,
    isFeeStatusManager: false,
    isBursar: false,
    isReceptionist: false,
    canManageHomework: false,
    assignments: [],
    subjectTeacherClassIds: new Set(),
    subjectTeacherSubjectIds: new Set(["subj_1"]),
    classTeacherClassIds: new Set(),
    hodSubjectIds: new Set(),
    visibleSubjectIds,
    visibleClassIds: new Set(),
  };
}

describe("buildNav teacher branch", () => {
  it("includes Essay Grading under the Assessments group", () => {
    const nav = buildNav(teacherPayload(), teacherPerms());
    const assessments = nav.find((n) => n.label === "Assessments");
    expect(assessments).toBeDefined();
    const children = assessments!.children ?? [];
    const essay = children.find((c) => c.label === "Essay Grading");
    expect(essay).toBeDefined();
    expect(essay!.href).toBe("/essay-grading");
  });
});
