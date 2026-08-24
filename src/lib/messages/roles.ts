// src/lib/messages/roles.ts

import type { UserRole } from "@prisma/client";

/** Sender/participant roles that behave like school staff in messaging. */
export const MESSAGING_STAFF_ROLES = [
  "super_admin", "proprietor", "platform_owner", "teacher", "hod", "admin",
] as const;

export function isMessagingStaffRole(role: UserRole): boolean {
  return (MESSAGING_STAFF_ROLES as readonly string[]).includes(role);
}

export type ParticipantType = "teacher" | "student" | "parent" | "admin";

/** ConversationParticipant.userType value for a User.role. */
export function participantTypeForRole(role: UserRole): ParticipantType {
  if (role === "super_admin" || role === "proprietor" || role === "platform_owner" || role === "admin") return "admin";
  if (role === "hod" || role === "teacher") return "teacher";
  if (role === "student") return "student";
  return "parent";
}
