import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function generateRandomBytes(n = 32): string {
  return randomBytes(n).toString("hex");
}

export function deriveBundleKey(signingSecret: string, bundleId: string): string {
  return createHmac("sha256", signingSecret).update(`bundle-key:${bundleId}`).digest("hex");
}

const PREFIX = "msb1.";

export function encryptBundle(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("Bundle key must be 32 bytes hex.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}.${tag.toString("hex")}.${ct.toString("base64url")}`;
}

export function decryptBundle(payload: string, keyHex: string): string {
  if (!payload.startsWith(PREFIX)) throw new Error("Invalid bundle payload.");
  const [, ivHex, tagHex, ctB64] = payload.split(".");
  if (!ivHex || !tagHex || !ctB64) throw new Error("Invalid bundle payload.");
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const ct = Buffer.from(ctB64, "base64url");
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function answerChecksum(
  signingSecret: string,
  attemptId: string,
  questionId: string,
  clientTimestamp: string,
  answerPayload: string,
): string {
  return createHmac("sha256", signingSecret)
    .update(`answer:${attemptId}:${questionId}:${clientTimestamp}:${answerPayload}`)
    .digest("hex");
}

export function verifyAnswerChecksum(
  signingSecret: string,
  attemptId: string,
  questionId: string,
  clientTimestamp: string,
  answerPayload: string,
  expected: string,
): boolean {
  const actual = Buffer.from(
    answerChecksum(signingSecret, attemptId, questionId, clientTimestamp, answerPayload),
    "hex",
  );
  const exp = Buffer.from(expected ?? "", "hex");
  if (actual.length !== exp.length) return false;
  return timingSafeEqual(actual, exp);
}