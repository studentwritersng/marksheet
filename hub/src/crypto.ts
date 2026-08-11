import { createDecipheriv, createHmac } from "node:crypto";

export function deriveBundleKey(signingSecret: string, bundleId: string): string {
  return createHmac("sha256", signingSecret).update(`bundle-key:${bundleId}`).digest("hex");
}

export function decryptBundle(payload: string, keyHex: string): string {
  const PREFIX = "msb1.";
  if (!payload.startsWith(PREFIX)) throw new Error("Invalid bundle payload.");
  const [, ivHex, tagHex, ctB64] = payload.split(".");
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}