import { TRPCError } from "@trpc/server";
import * as db from "./db";
import type { Customer, License } from "../drizzle/schema";

export function emailsEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

/**
 * End-customer billing (buy/renew/cancel) is embedded in the product, not licadmin.
 * Public APIs authenticate the caller with license key + purchase email.
 */
export async function assertLicenseOwnedByEmail(
  licenseKey: string,
  email: string
): Promise<{ license: License; customer: Customer }> {
  const license = await db.getLicenseByKey(licenseKey);
  if (!license) {
    throw new TRPCError({ code: "NOT_FOUND", message: "License not found" });
  }

  if (!license.customerId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "License is not linked to a customer; billing stays with the vendor admin",
    });
  }

  const customer = await db.getCustomerById(license.customerId);
  if (!customer || !emailsEqual(customer.email, email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Email does not match this license",
    });
  }

  return { license, customer };
}
