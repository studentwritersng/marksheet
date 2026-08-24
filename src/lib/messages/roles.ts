// src/lib/messages/roles.ts

/** Sender/participant roles that behave like school staff in messaging. */
export const MESSAGING_STAFF_ROLES = ["staff", "super_admin", "platform_owner", "proprietor"] as const;

export function isMessagingStaffRole(role: string): boolean {
  return (MESSAGING_STAFF_ROLES as readonly string[]).includes(role);
}

/** ConversationParticipant.userType value for a User.role. */
export function participantTypeForRole(role: string): "staff" | "parent" | "student" {
  if (role === "parent") return "parent";
  if (role === "student") return "student";
  return "staff";
}
