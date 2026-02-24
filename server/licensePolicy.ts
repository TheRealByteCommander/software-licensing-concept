export type LicenseMetadata = {
  features?: string[];
  staleActivationDays?: number;
};

export function parseLicenseMetadata(metadata?: string | null): LicenseMetadata {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata) as LicenseMetadata;
    if (!parsed || typeof parsed !== "object") return {};

    const normalized: LicenseMetadata = {};

    if (Array.isArray(parsed.features)) {
      normalized.features = parsed.features.filter((f): f is string => typeof f === "string");
    }

    if (typeof parsed.staleActivationDays === "number" && Number.isFinite(parsed.staleActivationDays)) {
      normalized.staleActivationDays = Math.max(1, Math.floor(parsed.staleActivationDays));
    }

    return normalized;
  } catch {
    return {};
  }
}

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
