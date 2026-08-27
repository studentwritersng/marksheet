import { describe, it, expect } from "vitest";
import { checkSignupRateLimit, checkPasswordChangeRateLimit } from "./route-security";

describe("checkSignupRateLimit", () => {
  it("allows up to 5 per email per hour, then throttles", () => {
    const email = `signup-${Date.now()}@example.com`;
    let res: string | null = null;
    for (let i = 0; i < 5; i++) res = checkSignupRateLimit(email);
    expect(res).toBeNull();
    res = checkSignupRateLimit(email);
    expect(res).toMatch(/Too many sign-up attempts/);
  });

  it("permits different emails", () => {
    expect(checkSignupRateLimit(`a-${Date.now()}@example.com`)).toBeNull();
    expect(checkSignupRateLimit(`b-${Date.now()}@example.com`)).toBeNull();
  });
});

describe("checkPasswordChangeRateLimit", () => {
  it("allows up to 5 per user per 10 min, then throttles", () => {
    const email = `pw-${Date.now()}@example.com`;
    let res: string | null = null;
    for (let i = 0; i < 5; i++) res = checkPasswordChangeRateLimit(email);
    expect(res).toBeNull();
    res = checkPasswordChangeRateLimit(email);
    expect(res).toMatch(/Too many password-change attempts/);
  });
});
