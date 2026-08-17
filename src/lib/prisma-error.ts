import { Prisma } from "@prisma/client";

/**
 * Turn a Prisma (or generic) error into a short, user-facing message.
 * `context` lets the caller say what was being done, e.g. a student/parent
 * name or email, so the message points the user at the offending row/field.
 */
export function formatPrismaError(err: unknown, context?: string): string {
  const where = context ? ` (${context})` : "";

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = err.meta?.target;
        const field = Array.isArray(target)
          ? target.join(", ")
          : typeof target === "string"
            ? target
            : "a unique field";
        if (field.toLowerCase().includes("email")) {
          return `A user with that email address already exists. Email addresses must be unique — please use a different email${where}.`;
        }
        return `A record with the same ${field} already exists${where}.`;
      }
      case "P2003":
        return `This action references information that no longer exists${where}.`;
      case "P2025":
        return `The record you are trying to change was not found${where}.`;
      case "P2000":
        return `Some of the information entered is too long for the database${where}.`;
      case "P2014":
        return `The operation failed because related records still exist${where}.`;
      default:
        return `A database error occurred (${err.code})${where}.`;
    }
  }

  if (err instanceof Error) {
    return err.message || "An unexpected error occurred.";
  }
  return "An unexpected error occurred.";
}
