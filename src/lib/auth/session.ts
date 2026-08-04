import crypto from "crypto";

/**
 * Lightweight signed-cookie session (HMAC-SHA256 with AUTH_SECRET).
 * Payload is a compact JSON of the authenticated user's identity + role.
 * This avoids extra auth dependencies while remaining tamper-evident.
 */

export interface SessionPayload {
  userId: string;
  role: "super_admin" | "platform_owner" | "proprietor" | "staff" | "student" | "parent" | "referral";
  schoolId: string | null;
  staffId: string | null;
  email: string;
  mustChangePassword: boolean;
  // Proprietor-only — null for all other roles
  proprietorGroupId?: string | null;
  proprietorPermissionLevel?: "full" | "view_only" | null;
}

export const SESSION_COOKIE = "marksheet_session";
const MAX_AGE_SECONDS = 60 * 60 * 4; // 4 hours
export const ABSOLUTE_MAX_AGE_SECONDS = 60 * 60 * 24; // absolute expiry 24h

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
    // Random nonce regenerated on every issue — combined with a fresh token on
    // login, this mitigates session fixation.
    sid: crypto.randomBytes(24).toString("base64url"),
    iat: Math.floor(Date.now() / 1000),
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
      | (SessionPayload & { exp: number; iat?: number })
      | null;
    if (!body) return null;
    const now = Math.floor(Date.now() / 1000);
    if (body.exp < now) return null;
    // Absolute expiry: regardless of rolling refresh, force re-auth after 24h.
    if (body.iat && now - body.iat > ABSOLUTE_MAX_AGE_SECONDS) return null;
    return {
      userId: body.userId,
      role: body.role,
      schoolId: body.schoolId,
      staffId: body.staffId,
      email: body.email,
      mustChangePassword: body.mustChangePassword ?? false,
      proprietorGroupId: body.proprietorGroupId ?? null,
      proprietorPermissionLevel: body.proprietorPermissionLevel ?? null,
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;

/**
 * Shared cookie options. `secure` is enabled on any non-local environment
 * (staging, preview, production) rather than only when NODE_ENV === production.
 */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.VERCEL !== undefined || process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
