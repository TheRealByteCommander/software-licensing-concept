import { describe, expect, it } from "vitest";
import {
  DEFAULT_OFFLINE_GRACE_HOURS,
  normalizeFeatureList,
  resolveLicenseFeatures,
} from "@shared/licenseMetadata";
import { computeOfflineWindow, generateLicenseToken, verifyLicenseToken } from "./licenseUtils";
import { buildLicenseAccessGrant } from "./licenseGrant";
import type { License, Product } from "../drizzle/schema";

describe("resolveLicenseFeatures", () => {
  it("treats a non-empty license feature list as authoritative", () => {
    expect(resolveLicenseFeatures(["basic", "inspection", "Trends", "Export"], ["basic"])).toEqual([
      "basic",
    ]);
    expect(
      resolveLicenseFeatures(["basic", "inspection"], ["basic", "Trends", "Export"])
    ).toEqual(["basic", "Trends", "Export"]);
  });

  it("falls back to product defaults when license features are missing or empty", () => {
    expect(resolveLicenseFeatures(["basic", "inspection", "Trends", "Export"], [])).toEqual([
      "basic",
      "inspection",
      "Trends",
      "Export",
    ]);
    expect(resolveLicenseFeatures(["basic", "Trends"], undefined)).toEqual(["basic", "Trends"]);
  });

  it("falls back to basic when both sources are empty", () => {
    expect(resolveLicenseFeatures([], [])).toEqual(["basic"]);
    expect(resolveLicenseFeatures(undefined, undefined)).toEqual(["basic"]);
  });

  it("parses JSON or comma-separated product defaults", () => {
    expect(normalizeFeatureList('["basic","Trends"]')).toEqual(["basic", "Trends"]);
    expect(normalizeFeatureList("basic, Export")).toEqual(["basic", "Export"]);
  });
});

describe("computeOfflineWindow", () => {
  it("defaults to a 72 hour offline grace", () => {
    const nowMs = Date.parse("2026-09-06T12:00:00.000Z");
    const window = computeOfflineWindow({ nowMs });
    expect(window.offlineGraceHours).toBe(DEFAULT_OFFLINE_GRACE_HOURS);
    expect(window.exp - Math.floor(nowMs / 1000)).toBe(72 * 60 * 60);
    expect(window.offlineUntil).toBe(window.exp);
  });

  it("caps the offline window at the license expiry", () => {
    const nowMs = Date.parse("2026-09-06T12:00:00.000Z");
    const licenseExpiresAt = new Date("2026-09-06T13:00:00.000Z");
    const window = computeOfflineWindow({ nowMs, licenseExpiresAt });
    expect(window.exp).toBe(Math.floor(licenseExpiresAt.getTime() / 1000));
    expect(window.offlineGraceHours).toBe(72);
  });
});

describe("generateLicenseToken claims", () => {
  it("embeds features and a 72h offlineUntil claim", () => {
    const token = generateLicenseToken({
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      productId: 2,
      deviceId: "device-1",
      features: ["basic", "inspection", "Trends", "Export"],
    });

    const payload = verifyLicenseToken(token);
    expect(payload.features).toEqual(["basic", "inspection", "Trends", "Export"]);
    expect(payload.offlineGraceHours).toBe(72);
    expect(payload.offlineUntil).toBe(payload.exp);
    expect(payload.licenseExpiresAt).toBeNull();

    const now = Math.floor(Date.now() / 1000);
    expect(payload.exp).toBeGreaterThan(now + 71 * 3600);
    expect(payload.exp).toBeLessThanOrEqual(now + 72 * 3600 + 5);
  });
});

describe("buildLicenseAccessGrant", () => {
  const product = {
    id: 2,
    name: "AnomalyMatrix",
    description: null,
    require2FA: false,
    defaultFeatures: JSON.stringify(["basic", "inspection", "Trends", "Export"]),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Product;

  function licenseWithMetadata(metadata: string | null): License {
    return {
      id: 1,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      productId: 2,
      customerId: null,
      stripeSubscriptionId: null,
      type: "perpetual",
      status: "active",
      maxActivations: 1,
      expiresAt: null,
      metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as License;
  }

  it("keeps a BASIC license at metadata features only", () => {
    const grant = buildLicenseAccessGrant({
      license: licenseWithMetadata(JSON.stringify({ features: ["basic"] })),
      product,
      deviceId: "dev-1",
    });

    expect(grant.features).toEqual(["basic"]);
    expect(grant.offlineGraceHours).toBe(72);
    expect(Date.parse(grant.offlineUntil)).toBeGreaterThan(Date.now());
    expect(verifyLicenseToken(grant.token).features).toEqual(grant.features);
  });

  it("uses product defaults when license metadata has no features", () => {
    const grant = buildLicenseAccessGrant({
      license: licenseWithMetadata(null),
      product,
      deviceId: "dev-1",
    });

    expect(grant.features).toEqual(["basic", "inspection", "Trends", "Export"]);
  });
});
