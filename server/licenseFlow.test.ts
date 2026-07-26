import { describe, expect, it } from "vitest";
import { licensesToCsv } from "./licenseFlow";
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
