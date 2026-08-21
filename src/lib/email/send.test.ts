import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const mockFindUnique = vi.fn();
const mockSendMail = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: { school: { findUnique: (...args: any[]) => mockFindUnique(...args) } },
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: (...args: any[]) => mockSendMail(...args) })),
  },
}));

import { sendEmail } from "./send";
import { encryptSecret, decryptSecret } from "@/lib/secrets";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-encryption-key-for-unit-tests";
});

beforeEach(() => {
  mockFindUnique.mockClear();
  mockSendMail.mockClear();
});

describe("sendEmail school SMTP resolution", () => {
  it("uses the school's own SMTP when configured", async () => {
    mockFindUnique.mockResolvedValueOnce({
      smtpEnabled: true,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: "school@gmail.com",
      smtpPassEnc: "app-password",
      smtpFrom: "school@gmail.com",
      smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-1" });

    expect(res.ok).toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "school-1" } }),
    );
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const sent = mockSendMail.mock.calls[0][0];
    expect(sent.to).toBe("parent@x.com");
    expect(sent.from).toBe("school@gmail.com");
  });

  it("returns SMTP_NOT_CONFIGURED when the school SMTP is disabled", async () => {
    mockFindUnique.mockResolvedValueOnce({
      smtpEnabled: false,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      smtpUser: "school@gmail.com",
      smtpPassEnc: "app-password",
      smtpFrom: null,
      smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-1" });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("SMTP_NOT_CONFIGURED");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("returns SMTP_NOT_CONFIGURED when the school is missing", async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "nope" });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("SMTP_NOT_CONFIGURED");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("uses the shared env SMTP when no schoolId is provided", async () => {
    process.env.SMTP_HOST = "smtp.env.com";
    process.env.SMTP_PORT = "587";

    const res = await sendEmail({ to: "owner@x.com", subject: "Hi" });

    expect(res.ok).toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0].to).toBe("owner@x.com");
  });
});

describe("crypto roundtrip", () => {
  it("decrypts an encrypted secret back to the plaintext", () => {
    const enc = encryptSecret("super-secret");
    expect(enc).not.toBe("super-secret");
    expect(decryptSecret(enc)).toBe("super-secret");
  });

  it("returns non-prefixed values unchanged", () => {
    expect(decryptSecret("plain-value")).toBe("plain-value");
  });
});
