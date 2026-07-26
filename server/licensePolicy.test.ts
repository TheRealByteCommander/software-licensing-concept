import { describe, expect, it } from "vitest";
import { buildLicenseMetadata } from "@shared/licenseMetadata";
import { isActivationStale, parseLicenseMetadata } from "./licensePolicy";

describe("licensePolicy", () => {
  it("parses metadata safely and normalizes values", () => {
    const parsed = parseLicenseMetadata(
      JSON.stringify({ features: ["pro", 2, "team"], staleActivationDays: 14.7 })
    );

    expect(parsed.features).toEqual(["pro", "team"]);
    expect(parsed.staleActivationDays).toBe(14);
  });

  it("returns empty metadata for invalid JSON", () => {
    expect(parseLicenseMetadata("{bad json")).toEqual({});
  });

  it("builds metadata with auto-renew settings", () => {
    const metadata = buildLicenseMetadata({
      autoRenew: true,
      renewalPeriodDays: 30,
      features: ["pro"],
    });

    expect(JSON.parse(metadata!)).toMatchObject({
      autoRenew: true,
      renewalPeriodDays: 30,
      features: ["pro"],
    });
  });
});
