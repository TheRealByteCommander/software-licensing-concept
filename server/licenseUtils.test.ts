import { describe, expect, it } from "vitest";
import {
  generateDeviceId,
  generateLicenseKey,
  generateLicenseToken,
  verifyLicenseToken,
} from "./licenseUtils";

describe("licenseUtils", () => {
  it("generates license keys in XXXX-XXXX-XXXX-XXXX format", () => {
    const key = generateLicenseKey();
    expect(key).toMatch(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/);
  });

  it("generates deterministic device hashes", () => {
    const info = "machine-id:abc123";
    expect(generateDeviceId(info)).toHaveLength(64);
    expect(generateDeviceId(info)).toBe(generateDeviceId(info));
  });

  it("creates and verifies a license token", () => {
    const token = generateLicenseToken({
      licenseKey: "ABCD-EFGH-IJKL-MNOP",
      productId: 42,
      deviceId: "device-1",
      features: ["pro"],
    });

    const payload = verifyLicenseToken(token) as {
      licenseKey: string;
      productId: number;
      deviceId: string;
      features: string[];
    };

    expect(payload.licenseKey).toBe("ABCD-EFGH-IJKL-MNOP");
    expect(payload.productId).toBe(42);
    expect(payload.deviceId).toBe("device-1");
    expect(payload.features).toEqual(["pro"]);
    expect(payload.offlineGraceHours).toBe(72);
    expect(payload.offlineUntil).toBe(payload.exp);
  });
});
