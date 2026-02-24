import { describe, expect, it } from "vitest";
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

  it("marks activations stale only after threshold", () => {
    const now = new Date("2026-02-24T12:00:00Z");
    const old = new Date("2026-02-10T11:59:00Z");
    const fresh = new Date("2026-02-20T12:00:00Z");

    expect(isActivationStale(old, 14, now)).toBe(true);
    expect(isActivationStale(fresh, 14, now)).toBe(false);
  });
});
