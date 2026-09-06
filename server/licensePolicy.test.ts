import { describe, expect, it } from "vitest";
import { buildLicenseMetadata } from "@shared/licenseMetadata";
import {
  filterActiveActivations,
  isSeatLimitReached,
  parseLicenseMetadata,
} from "./licensePolicy";

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

describe("activation seats", () => {
  it("treats a soft-deactivated row as a free seat", () => {
    const rows = [
      { id: 1, deactivatedAt: new Date("2026-09-06T12:00:00.000Z") },
      { id: 2, deactivatedAt: null },
    ];

    expect(filterActiveActivations(rows)).toEqual([{ id: 2, deactivatedAt: null }]);
    expect(isSeatLimitReached(filterActiveActivations(rows).length, 1)).toBe(true);
  });

  it("allows re-activate after the only seat is deactivated (maxActivations=1)", () => {
    const afterDeactivate = [{ id: 1, deactivatedAt: new Date("2026-09-06T12:00:00.000Z") }];

    expect(filterActiveActivations(afterDeactivate)).toHaveLength(0);
    expect(isSeatLimitReached(0, 1)).toBe(false);
  });
});
