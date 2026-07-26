import { describe, expect, it } from "vitest";
import { computeRenewedExpiry, getRenewalUpdateIfEligible, isLicenseExpired } from "./licenseRenewal";
import type { License } from "../drizzle/schema";

const baseLicense = (overrides: Partial<License> = {}): License =>
  ({
    id: 1,
    licenseKey: "AAAA-BBBB-CCCC-DDDD",
    productId: 1,
    customerId: null,
    type: "subscription",
    status: "active",
    maxActivations: 1,
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    metadata: JSON.stringify({ autoRenew: true, renewalPeriodDays: 30 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as License;

describe("licenseRenewal", () => {
  it("detects expired licenses", () => {
    expect(isLicenseExpired(baseLicense(), new Date("2026-02-01T00:00:00.000Z"))).toBe(true);
  });

  it("returns renewal update for expired auto-renew subscriptions", () => {
    const update = getRenewalUpdateIfEligible(
      baseLicense(),
      { autoRenew: true, renewalPeriodDays: 30 },
      new Date("2026-02-01T00:00:00.000Z")
    );

    expect(update?.status).toBe("active");
    expect(update?.expiresAt.getTime()).toBeGreaterThan(new Date("2026-02-01T00:00:00.000Z").getTime());
  });

  it("computes renewed expiry from now when already expired", () => {
    const renewed = computeRenewedExpiry(
      new Date("2026-01-01T00:00:00.000Z"),
      30,
      new Date("2026-02-01T00:00:00.000Z")
    );

    expect(renewed.toISOString().slice(0, 10)).toBe("2026-03-03");
  });
});
