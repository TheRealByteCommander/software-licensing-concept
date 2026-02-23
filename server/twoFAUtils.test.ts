import { describe, expect, it } from "vitest";
import { generateBackupCodes, verifyTOTP } from "./twoFAUtils";

describe("twoFAUtils", () => {
  it("generates uppercase alphanumeric backup codes with requested count", () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);

    for (const code of codes) {
      expect(code).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it("returns false for clearly invalid TOTP", () => {
    expect(verifyTOTP("INVALIDSECRET", "000000")).toBe(false);
  });
});
