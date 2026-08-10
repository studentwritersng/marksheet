import { describe, it, expect } from "vitest";
import {
  encryptBundle,
  decryptBundle,
  deriveBundleKey,
  answerChecksum,
  verifyAnswerChecksum,
} from "./crypto";

describe("crypto", () => {
  const secret = "test-signing-secret";
  const key = deriveBundleKey(secret, "bundle-1");

  it("derives a stable 64-char hex key per bundle", () => {
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(deriveBundleKey(secret, "bundle-1")).toBe(key);
    expect(deriveBundleKey(secret, "bundle-2")).not.toBe(key);
  });

  it("encrypts and decrypts round-trip", () => {
    const payload = JSON.stringify({ hello: "world", n: 42 });
    const enc = encryptBundle(payload, key);
    expect(enc.startsWith("msb1.")).toBe(true);
    expect(enc).not.toContain("world");
    expect(decryptBundle(enc, key)).toBe(payload);
  });

  it("fails to decrypt with a different key", () => {
    const enc = encryptBundle("secret", key);
    expect(() => decryptBundle(enc, deriveBundleKey(secret, "bundle-9"))).toThrow();
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptBundle("secret", key);
    const parts = enc.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptBundle(parts.join("."), key)).toThrow();
  });

  it("computes and verifies answer checksums", () => {
    const c = answerChecksum(secret, "att-1", "q-1", "2026-08-09T10:00:00Z", "opt-5");
    expect(verifyAnswerChecksum(secret, "att-1", "q-1", "2026-08-09T10:00:00Z", "opt-5", c)).toBe(true);
    expect(verifyAnswerChecksum(secret, "att-1", "q-1", "2026-08-09T10:00:00Z", "opt-6", c)).toBe(false);
  });
});