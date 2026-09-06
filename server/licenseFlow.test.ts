import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  assertLicenseMatchesProduct,
  licensesToCsv,
  resolveExpectedProductId,
} from "./licenseFlow";
import type { License } from "../drizzle/schema";

describe("licensesToCsv", () => {
  it("exports license rows with headers", () => {
    const csv = licensesToCsv(
      [
        {
          id: 1,
          licenseKey: "AAAA-BBBB-CCCC-DDDD",
          productId: 1,
          customerId: 2,
          type: "subscription",
          status: "active",
          maxActivations: 1,
          expiresAt: new Date("2026-12-31T00:00:00.000Z"),
          metadata: "{\"features\":[\"pro\"]}",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        } as License,
      ],
      new Map([[1, "My Product"]]),
      new Map([[2, "Jane Doe <jane@example.com>"]])
    );

    expect(csv.split("\n")[0]).toContain("licenseKey,product,customer");
    expect(csv).toContain("AAAA-BBBB-CCCC-DDDD");
    expect(csv).toContain("My Product");
    expect(csv).toContain("Jane Doe <jane@example.com>");
  });
});

describe("product binding", () => {
  it("prefers expectedProductId over productId", () => {
    expect(resolveExpectedProductId({ productId: 1, expectedProductId: 2 })).toBe(2);
    expect(resolveExpectedProductId({ productId: 2 })).toBe(2);
    expect(resolveExpectedProductId({})).toBeUndefined();
  });

  it("allows activation when no expected product is sent", () => {
    expect(() => assertLicenseMatchesProduct(1)).not.toThrow();
  });

  it("allows activation when the license matches the expected product", () => {
    expect(() => assertLicenseMatchesProduct(2, 2)).not.toThrow();
  });

  it("rejects a license bound to a different product", () => {
    try {
      assertLicenseMatchesProduct(1, 2);
      throw new Error("expected FORBIDDEN");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect(error).toMatchObject({
        code: "FORBIDDEN",
        message: "License belongs to product 1, expected 2",
      });
    }
  });
});
