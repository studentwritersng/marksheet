import crypto from "crypto";

/**
 * Generates a cryptographically random temporary password.
 * Uses a conservative alphabet that avoids ambiguous characters (0/O, 1/l/I).
 */
export function generateTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * Basic password policy check.
 * Returns an error string when the password is rejected, or null when valid.
 *
 * The only requirement is a minimum length of 8 characters. Letter-case and
 * numeric rules were removed because student passwords are auto-generated from
 * the student's date of birth (digits only) and admins need to be able to
 * reset passwords without inventing letter combinations.
 */
export function validatePasswordStrength(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  return null;
}