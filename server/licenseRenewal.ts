import type { License } from "../drizzle/schema";
import type { LicenseMetadata } from "./licensePolicy";
import { getRenewalPeriodDays } from "./licensePolicy";

export function computeRenewedExpiry(
  currentExpiresAt: Date,
  renewalPeriodDays: number,
  now: Date = new Date()
): Date {
  const base = currentExpiresAt > now ? currentExpiresAt : now;
  const result = new Date(base);
  result.setDate(result.getDate() + renewalPeriodDays);
  return result;
}

export function getRenewalUpdateIfEligible(
  license: License,
  metadata: LicenseMetadata,
  now: Date = new Date()
): { expiresAt: Date; status: "active" } | null {
  if (license.status === "revoked") return null;
  if (license.type !== "subscription" || !metadata.autoRenew) return null;
  if (!license.expiresAt) return null;

  const expiresAt = new Date(license.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt >= now) return null;

  return {
    expiresAt: computeRenewedExpiry(expiresAt, getRenewalPeriodDays(metadata), now),
    status: "active",
  };
}

export function isLicenseExpired(license: License, now: Date = new Date()): boolean {
  if (!license.expiresAt) return false;
  return new Date(license.expiresAt) < now;
}
