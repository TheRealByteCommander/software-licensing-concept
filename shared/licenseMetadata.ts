export const DEFAULT_OFFLINE_GRACE_HOURS = 72;

export type LicenseMetadata = {
  features?: string[];
  staleActivationDays?: number;
  autoRenew?: boolean;
  renewalPeriodDays?: number;
  offlineGraceHours?: number;
};

function tryParseFeatureSource(value: string): unknown[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return trimmed.split(",");
}

/** Deduplicate feature flags, preserving first-seen casing (e.g. Trends, Export). */
export function normalizeFeatureList(features?: unknown): string[] {
  const raw = Array.isArray(features)
    ? features
    : typeof features === "string"
      ? tryParseFeatureSource(features)
      : [];

  const seen = new Set<string>();
  const out: string[] = [];

  for (const item of raw) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }

  return out;
}

export function serializeFeatureList(features?: unknown): string | undefined {
  const normalized = normalizeFeatureList(features);
  return normalized.length > 0 ? JSON.stringify(normalized) : undefined;
}

/**
 * Product defaults plus license extras.
 * A license that only stored `basic` still picks up product flags such as Trends/Export.
 */
export function resolveLicenseFeatures(
  productDefaults?: unknown,
  licenseFeatures?: unknown
): string[] {
  return normalizeFeatureList([
    ...normalizeFeatureList(productDefaults),
    ...normalizeFeatureList(licenseFeatures),
  ]);
}

export function normalizeOfflineGraceHours(value?: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(24 * 365, Math.max(1, Math.floor(value)));
  }
  return DEFAULT_OFFLINE_GRACE_HOURS;
}

export function getRenewalPeriodDays(metadata: LicenseMetadata): number {
  if (typeof metadata.renewalPeriodDays === "number" && Number.isFinite(metadata.renewalPeriodDays)) {
    return Math.max(1, Math.floor(metadata.renewalPeriodDays));
  }
  return 365;
}

export function parseLicenseMetadata(metadata?: string | null): LicenseMetadata {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata) as LicenseMetadata;
    if (!parsed || typeof parsed !== "object") return {};

    const normalized: LicenseMetadata = {};

    if (parsed.features !== undefined) {
      normalized.features = normalizeFeatureList(parsed.features);
    }

    if (typeof parsed.staleActivationDays === "number" && Number.isFinite(parsed.staleActivationDays)) {
      normalized.staleActivationDays = Math.max(1, Math.floor(parsed.staleActivationDays));
    }

    if (typeof parsed.autoRenew === "boolean") {
      normalized.autoRenew = parsed.autoRenew;
    }

    if (typeof parsed.renewalPeriodDays === "number" && Number.isFinite(parsed.renewalPeriodDays)) {
      normalized.renewalPeriodDays = Math.max(1, Math.floor(parsed.renewalPeriodDays));
    }

    if (typeof parsed.offlineGraceHours === "number" && Number.isFinite(parsed.offlineGraceHours)) {
      normalized.offlineGraceHours = normalizeOfflineGraceHours(parsed.offlineGraceHours);
    }

    return normalized;
  } catch {
    return {};
  }
}

export function buildLicenseMetadata(input: {
  features?: string[];
  staleActivationDays?: number;
  autoRenew?: boolean;
  renewalPeriodDays?: number;
  offlineGraceHours?: number;
}): string | undefined {
  const metadata: LicenseMetadata = {};

  const features = normalizeFeatureList(input.features);
  if (features.length) {
    metadata.features = features;
  }
  if (input.staleActivationDays && input.staleActivationDays > 0) {
    metadata.staleActivationDays = Math.floor(input.staleActivationDays);
  }
  if (input.autoRenew) {
    metadata.autoRenew = true;
    metadata.renewalPeriodDays = getRenewalPeriodDays({
      renewalPeriodDays: input.renewalPeriodDays,
    });
  }
  if (input.offlineGraceHours && input.offlineGraceHours !== DEFAULT_OFFLINE_GRACE_HOURS) {
    metadata.offlineGraceHours = normalizeOfflineGraceHours(input.offlineGraceHours);
  }

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined;
}
