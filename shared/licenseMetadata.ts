export type LicenseMetadata = {
  features?: string[];
  staleActivationDays?: number;
  autoRenew?: boolean;
  renewalPeriodDays?: number;
};

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

    if (Array.isArray(parsed.features)) {
      normalized.features = parsed.features.filter((f): f is string => typeof f === "string");
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
}): string | undefined {
  const metadata: LicenseMetadata = {};

  if (input.features?.length) {
    metadata.features = input.features;
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

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined;
}
