import type { License, Product } from "../drizzle/schema";
import {
  DEFAULT_OFFLINE_GRACE_HOURS,
  normalizeFeatureList,
  normalizeOfflineGraceHours,
  parseLicenseMetadata,
  resolveLicenseFeatures,
} from "@shared/licenseMetadata";
import { computeOfflineWindow, generateLicenseToken } from "./licenseUtils";

export type LicenseAccessGrant = {
  token: string;
  features: string[];
  productId: number;
  offlineGraceHours: number;
  offlineUntil: string;
  licenseExpiresAt: string | null;
};

export function buildLicenseAccessGrant(input: {
  license: License;
  product?: Product | null;
  deviceId: string;
  now?: Date;
}): LicenseAccessGrant {
  const metadata = parseLicenseMetadata(input.license.metadata);
  const features = resolveLicenseFeatures(input.product?.defaultFeatures, metadata.features);
  const offlineGraceHours = normalizeOfflineGraceHours(
    metadata.offlineGraceHours ?? DEFAULT_OFFLINE_GRACE_HOURS
  );
  const now = input.now ?? new Date();
  const window = computeOfflineWindow({
    nowMs: now.getTime(),
    offlineGraceHours,
    licenseExpiresAt: input.license.expiresAt,
  });

  const token = generateLicenseToken({
    licenseKey: input.license.licenseKey,
    productId: input.license.productId,
    deviceId: input.deviceId,
    expiresAt: input.license.expiresAt,
    features,
    offlineGraceHours,
    now,
  });

  return {
    token,
    features,
    productId: input.license.productId,
    offlineGraceHours,
    offlineUntil: new Date(window.offlineUntil * 1000).toISOString(),
    licenseExpiresAt: input.license.expiresAt
      ? new Date(input.license.expiresAt).toISOString()
      : null,
  };
}

export function toActivationPayload(grant: LicenseAccessGrant, message: string) {
  return {
    success: true as const,
    token: grant.token,
    message,
    features: grant.features,
    productId: grant.productId,
    offlineGraceHours: grant.offlineGraceHours,
    offlineUntil: grant.offlineUntil,
  };
}

export function productDefaultFeatures(product?: Product | null): string[] {
  return normalizeFeatureList(product?.defaultFeatures);
}
