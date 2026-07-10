import crypto from "crypto";

/**
 * Lightweight signed-cookie session (HMAC-SHA256 with AUTH_SECRET).
 * Payload is a compact JSON of the authenticated user's identity + role.
 * This avoids extra auth dependencies while remaining tamper-evident.
 */

export interface SessionPayload {
  userId: string;
  role: "super_admin" | "platform_owner" | "staff" | "student" | "parent";
  schoolId: string | null;
  staffId: string | null;
  email: string;
  mustChangePassword: boolean;
}

export const SESSION_COOKIE = "marksheet_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 hours

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(payload: SessionPayload): string {
  const body = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;

  const expected = sign(encoded);
  // constant-time comparison
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const body = JSON.parse(Buffer.from(encoded, "base64url").toString()) as
      | (SessionPayload & { exp: number })
      | null;
    if (!body) return null;
    if (body.exp < Math.floor(Date.now() / 1000)) return null;
    return {
      userId: body.userId,
      role: body.role,
      schoolId: body.schoolId,
      staffId: body.staffId,
      email: body.email,
      mustChangePassword: body.mustChangePassword ?? false,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
