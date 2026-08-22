import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";

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
import { getManagedFrom, getManagedReplyTo } from "./managed-from";
import { encryptSecret, decryptSecret } from "@/lib/secrets";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "test-encryption-key-for-unit-tests";
});

beforeEach(() => {
  mockFindUnique.mockClear();
  mockSendMail.mockClear();
  delete process.env.RESEND_API_KEY;
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

describe("managed sender helpers", () => {
  it("builds a quoted from address from the school name's first word", () => {
    expect(getManagedFrom({ name: "Springfield Academy", shortcode: "SA", id: "s1" }))
      .toBe('"Springfield Academy" <springfield@marksheet.top>');
  });
  it("falls back to shortcode then id when the name is blank", () => {
    expect(getManagedFrom({ name: "", shortcode: "TDC", id: "s2" }))
      .toBe('"" <tdc@marksheet.top>');
    expect(getManagedFrom({ name: "   ", shortcode: null, id: "s3" }))
      .toBe('"   " <s3@marksheet.top>');
  });
  it("falls back past a first word with no alphanumeric characters", () => {
    expect(getManagedFrom({ name: "--- Academy", shortcode: "TDC", id: "s4" }))
      .toBe('"--- Academy" <academy@marksheet.top>');
  });
  it("escapes quotes and backslashes in the display name", () => {
    expect(getManagedFrom({ name: 'The "Best" School', shortcode: null, id: "s5" }))
      .toBe('"The \\"Best\\" School" <the@marksheet.top>');
  });
  it("returns the school email as reply-to when present", () => {
    expect(getManagedReplyTo({ email: "admin@springfield.com" })).toBe("admin@springfield.com");
    expect(getManagedReplyTo({ email: null })).toBeUndefined();
  });
});

describe("managed sender resolution", () => {
  const ORIGINAL_KEY = process.env.RESEND_API_KEY;
  beforeEach(() => { delete process.env.RESEND_API_KEY; });
  afterAll(() => { if (ORIGINAL_KEY) process.env.RESEND_API_KEY = ORIGINAL_KEY; });

  it("uses the managed Marksheet domain when RESEND_API_KEY is set and school has no BYO SMTP", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockFindUnique.mockResolvedValueOnce({
      name: "Springfield Academy", email: "admin@springfield.com", shortcode: "SA", id: "school-2",
      smtpEnabled: false, smtpHost: null, smtpPort: null, smtpUser: null, smtpPassEnc: null, smtpFrom: null, smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-2" });

    expect(res.ok).toBe(true);
    const sent = mockSendMail.mock.calls[0][0];
    expect(sent.from).toBe('"Springfield Academy" <springfield@marksheet.top>');
    expect(sent.replyTo).toBe("admin@springfield.com");
  });

  it("hard-blocks with SMTP_NOT_CONFIGURED when neither BYO SMTP nor RESEND_API_KEY is available", async () => {
    delete process.env.RESEND_API_KEY;
    mockFindUnique.mockResolvedValueOnce({
      name: "Springfield Academy", email: "admin@springfield.com", shortcode: "SA", id: "school-4",
      smtpEnabled: false, smtpHost: null, smtpPort: null, smtpUser: null, smtpPassEnc: null, smtpFrom: null, smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-4" });

    expect(res.ok).toBe(false);
    expect(res.error).toBe("SMTP_NOT_CONFIGURED");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("still prefers BYO SMTP over managed when both are available", async () => {
    process.env.RESEND_API_KEY = "re_test";
    mockFindUnique.mockResolvedValueOnce({
      name: "Springfield Academy", email: "admin@springfield.com", shortcode: "SA", id: "school-3",
      smtpEnabled: true, smtpHost: "smtp.gmail.com", smtpPort: 587, smtpUser: "school@gmail.com",
      smtpPassEnc: "app-password", smtpFrom: "school@gmail.com", smtpSecure: false,
    });

    const res = await sendEmail({ to: "parent@x.com", subject: "Hi", schoolId: "school-3" });

    expect(res.ok).toBe(true);
    expect(mockSendMail.mock.calls[0][0].from).toBe("school@gmail.com");
  });
});
