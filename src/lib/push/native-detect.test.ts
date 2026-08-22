import { describe, it, expect } from "vitest";
import { isNativeWithPushPlugin } from "./native-detect";

describe("isNativeWithPushPlugin", () => {
  it("false in a plain browser (no window.Capacitor)", () => {
    expect(isNativeWithPushPlugin(undefined)).toBe(false);
  });

  it("false when Capacitor exists but reports web", () => {
    expect(isNativeWithPushPlugin({ isNativePlatform: () => false, Plugins: {} })).toBe(false);
  });

  it("false when native but push plugin is absent", () => {
    expect(isNativeWithPushPlugin({ isNativePlatform: () => true, Plugins: {} })).toBe(false);
  });

  it("true only when native AND the push plugin is injected", () => {
    expect(
      isNativeWithPushPlugin({ isNativePlatform: () => true, Plugins: { PushNotifications: {} } }),
    ).toBe(true);
  });
});
