import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Audit logging helper (PRD 11).
 * Every mutation to scores, question bank content, lesson notes, student
 * records, promotions, and result approvals must be logged with who/what/
 * before/after/when. Use this from server actions and API routes.
 */
export interface AuditInput {
  schoolId?: string | null;
  actorId?: string | null;
  actorAssignmentContext?: string | null;
  action: string; // create | update | delete | approve | reject | promote | revoke_code | ...
  entityType: string; // subject_result | question | lesson_note | student | ...
  entityId?: string | null;
  beforeValue?: Prisma.InputJsonValue | null;
  afterValue?: Prisma.InputJsonValue | null;
}

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      schoolId: input.schoolId ?? null,
      actorId: input.actorId ?? null,
      actorAssignmentContext: input.actorAssignmentContext ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      beforeValue: input.beforeValue ?? undefined,
      afterValue: input.afterValue ?? undefined,
    },
  });
}
