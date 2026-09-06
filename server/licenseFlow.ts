import type { License } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { isLicenseExpired, getRenewalUpdateIfEligible } from "./licenseRenewal";
import { parseLicenseMetadata, type LicenseMetadata } from "./licensePolicy";
import { dispatchWebhookEvent } from "./webhooks";

/** Accepts either `productId` or `expectedProductId` from activate/validate clients. */
export function resolveExpectedProductId(input: {
  productId?: number;
  expectedProductId?: number;
}): number | undefined {
  const expected = input.expectedProductId ?? input.productId;
  return typeof expected === "number" && Number.isFinite(expected) ? expected : undefined;
}

export function assertLicenseMatchesProduct(
  licenseProductId: number,
  expectedProductId?: number
): void {
  if (expectedProductId == null) return;
  if (licenseProductId !== expectedProductId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `License belongs to product ${licenseProductId}, expected ${expectedProductId}`,
    });
  }
}

export async function prepareLicenseForUse(
  licenseKey: string,
  options?: { expectedProductId?: number }
): Promise<{
  license: License;
  metadata: LicenseMetadata;
}> {
  const current = await db.getLicenseByKey(licenseKey);
  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
  }

  assertLicenseMatchesProduct(current.productId, options?.expectedProductId);

  if (current.status === "revoked") {
    throw new TRPCError({ code: "FORBIDDEN", message: `License is ${current.status}` });
  }

  if (current.status === "expired") {
    throw new TRPCError({ code: "FORBIDDEN", message: "License has expired" });
  }

  const metadata = parseLicenseMetadata(current.metadata);
  let license = current;

  if (license.status !== "grace_period") {
    const renewal = getRenewalUpdateIfEligible(license, metadata);
    if (renewal) {
      await db.updateLicense(licenseKey, renewal);
      license = { ...license, ...renewal };
      void dispatchWebhookEvent("license.renewed", {
        licenseKey,
        productId: license.productId,
        expiresAt: renewal.expiresAt.toISOString(),
      });
    } else if (isLicenseExpired(license)) {
      await db.updateLicense(licenseKey, { status: "expired" });
      void dispatchWebhookEvent("license.expired", {
        licenseKey,
        productId: license.productId,
      });
      throw new TRPCError({ code: "FORBIDDEN", message: "License has expired" });
    }
  }

  if (license.status !== "active" && license.status !== "grace_period") {
    throw new TRPCError({ code: "FORBIDDEN", message: `License is ${license.status}` });
  }

  return { license, metadata };
}

export function licensesToCsv(
  rows: License[],
  productNameById: Map<number, string>,
  customerLabelById: Map<number, string>
): string {
  const headers = [
    "licenseKey",
    "product",
    "customer",
    "type",
    "status",
    "maxActivations",
    "expiresAt",
    "metadata",
    "createdAt",
  ];

  const escape = (value: unknown) => {
    const text = value == null ? "" : String(value);
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const lines = rows.map(license => [
    license.licenseKey,
    productNameById.get(license.productId) ?? license.productId,
    license.customerId ? customerLabelById.get(license.customerId) ?? license.customerId : "",
    license.type,
    license.status,
    license.maxActivations ?? "",
    license.expiresAt ? new Date(license.expiresAt).toISOString() : "",
    license.metadata ?? "",
    new Date(license.createdAt).toISOString(),
  ].map(escape).join(","));

  return [headers.join(","), ...lines].join("\n");
}
