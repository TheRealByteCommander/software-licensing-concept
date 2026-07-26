import { parseLicenseMetadata, buildLicenseMetadata } from "@shared/licenseMetadata";

export type LicenseFormState = {
  productId: string;
  customerId: string;
  type: "subscription" | "perpetual" | "node_locked" | "user_based" | "feature_based";
  maxActivations: string;
  expiresAt: string;
  status: "active" | "expired" | "revoked" | "grace_period";
  features: string;
  staleActivationDays: string;
  autoRenew: boolean;
  renewalPeriodDays: string;
};

export const emptyLicenseForm = (): LicenseFormState => ({
  productId: "",
  customerId: "",
  type: "perpetual",
  maxActivations: "1",
  expiresAt: "",
  status: "active",
  features: "",
  staleActivationDays: "",
  autoRenew: false,
  renewalPeriodDays: "365",
});

export function metadataFromForm(form: LicenseFormState): string | undefined {
  const features = form.features
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  return buildLicenseMetadata({
    features,
    staleActivationDays: form.staleActivationDays ? parseInt(form.staleActivationDays, 10) : undefined,
    autoRenew: form.autoRenew,
    renewalPeriodDays: form.renewalPeriodDays ? parseInt(form.renewalPeriodDays, 10) : undefined,
  });
}

export function formFromLicense(license: {
  productId: number;
  customerId?: number | null;
  type: LicenseFormState["type"];
  maxActivations?: number | null;
  expiresAt?: Date | string | null;
  status: LicenseFormState["status"];
  metadata?: string | null;
}): LicenseFormState {
  const metadata = parseLicenseMetadata(license.metadata);

  return {
    productId: license.productId.toString(),
    customerId: license.customerId ? license.customerId.toString() : "",
    type: license.type,
    maxActivations: String(license.maxActivations ?? 1),
    expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString().slice(0, 10) : "",
    status: license.status,
    features: metadata.features?.join(", ") ?? "",
    staleActivationDays: metadata.staleActivationDays ? String(metadata.staleActivationDays) : "",
    autoRenew: metadata.autoRenew ?? false,
    renewalPeriodDays: metadata.renewalPeriodDays ? String(metadata.renewalPeriodDays) : "365",
  };
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
