import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", () => ({
  getLicenseByKey: vi.fn(),
  getCustomerById: vi.fn(),
}));

import * as db from "./db";
import { assertLicenseOwnedByEmail, emailsEqual } from "./stripeCustomerAccess";

describe("assertLicenseOwnedByEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("compares emails case-insensitively", () => {
    expect(emailsEqual("Buyer@Example.com", "buyer@example.com")).toBe(true);
    expect(emailsEqual("a@x.com", "b@x.com")).toBe(false);
  });

  it("allows the purchase email to manage billing for a linked license", async () => {
    vi.mocked(db.getLicenseByKey).mockResolvedValue({
      id: 1,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      customerId: 9,
    } as never);
    vi.mocked(db.getCustomerById).mockResolvedValue({
      id: 9,
      email: "buyer@example.com",
    } as never);

    const result = await assertLicenseOwnedByEmail("AAAA-BBBB-CCCC-DDDD", "Buyer@example.com");
    expect(result.customer.id).toBe(9);
  });

  it("rejects a mismatched email without an admin session", async () => {
    vi.mocked(db.getLicenseByKey).mockResolvedValue({
      id: 1,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      customerId: 9,
    } as never);
    vi.mocked(db.getCustomerById).mockResolvedValue({
      id: 9,
      email: "buyer@example.com",
    } as never);

    await expect(assertLicenseOwnedByEmail("AAAA-BBBB-CCCC-DDDD", "other@example.com")).rejects.toBeInstanceOf(
      TRPCError
    );
  });
});
