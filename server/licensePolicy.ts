export type { LicenseMetadata } from "@shared/licenseMetadata";
export {
  buildLicenseMetadata,
  getRenewalPeriodDays,
  parseLicenseMetadata,
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
