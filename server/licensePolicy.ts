export type { LicenseMetadata } from "@shared/licenseMetadata";
export {
  buildLicenseMetadata,
  getRenewalPeriodDays,
  parseLicenseMetadata,
  resolveLicenseFeatures,
  normalizeFeatureList,
  DEFAULT_OFFLINE_GRACE_HOURS,
  DEFAULT_LICENSE_FEATURES,
} from "@shared/licenseMetadata";

export function isActivationStale(
  lastValidatedAt: Date | string | null | undefined,
  staleActivationDays: number,
  now: Date = new Date()
): boolean {
  if (!lastValidatedAt) return true;
  if (!Number.isFinite(staleActivationDays) || staleActivationDays < 1) return false;

  const last = new Date(lastValidatedAt);
  if (Number.isNaN(last.getTime())) return true;

  const maxAgeMs = staleActivationDays * 24 * 60 * 60 * 1000;
  return now.getTime() - last.getTime() > maxAgeMs;
}

/** A seat is occupied only while deactivatedAt is unset or not a real timestamp. */
export function isActiveActivation(row: { deactivatedAt?: Date | string | null }): boolean {
  if (row.deactivatedAt == null || row.deactivatedAt === "") return true;
  const at = new Date(row.deactivatedAt);
  return Number.isNaN(at.getTime());
}

export function filterActiveActivations<T extends { deactivatedAt?: Date | string | null }>(
  rows: T[]
): T[] {
  return rows.filter(isActiveActivation);
}

export function isSeatLimitReached(
  activeCount: number,
  maxActivations?: number | null
): boolean {
  if (maxActivations == null || maxActivations <= 0) return false;
  return activeCount >= maxActivations;
}
