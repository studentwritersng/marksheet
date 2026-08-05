import crypto from "crypto";

/**
 * At-rest secret encryption (AES-256-GCM).
 * Used to encrypt sensitive provider credentials (e.g. AI API keys) before
 * they are written to the database, so a database leak does not expose them.
 *
 * The encryption key is derived from ENCRYPTION_KEY, falling back to
 * AUTH_SECRET. ENCRYPTION_KEY should be set to a long random value and kept
 * stable: rotating it makes previously encrypted secrets undecryptable.
 */

const PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY (or AUTH_SECRET) is not set. Cannot encrypt secrets.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

/** Encrypt a plaintext secret. */
export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

/**
 * Decrypt a stored secret. Values not in the encrypted format (legacy rows
 * written before encryption was enabled) are returned unchanged.
 */
export function decryptSecret(stored: string): string {
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const parts = stored.slice(PREFIX.length).split(".");
  if (parts.length !== 3) return stored;

  const [ivB64, tagB64, cipherB64] = parts;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivB64, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Failed to decrypt a stored secret. Confirm ENCRYPTION_KEY / AUTH_SECRET has not changed.");
  }
}

/** True when the stored value is in the encrypted format. */
export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return !!stored && stored.startsWith(PREFIX);
}
