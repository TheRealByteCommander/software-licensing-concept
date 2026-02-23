import { describe, expect, it, vi } from "vitest";
import { LicenseClient, LicensingApiError } from "./license-client";

describe("LicenseClient", () => {
  it("returns typed result for activation", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          data: {
            success: true,
            token: "jwt-token",
            message: "Activation successful",
          },
        },
      }),
    });

    const client = new LicenseClient({ baseUrl: "https://lic.example.com", fetchImpl: mockFetch as any });

    const result = await client.activate({
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      deviceId: "dev-1",
    });

    expect(result.success).toBe(true);
    expect(result.token).toBe("jwt-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("maps tRPC error envelopes to LicensingApiError", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: {
          code: "FORBIDDEN",
          message: "License is revoked",
        },
      }),
    });

    const client = new LicenseClient({ baseUrl: "https://lic.example.com", fetchImpl: mockFetch as any });

    await expect(
      client.activate({ licenseKey: "x", deviceId: "y" })
    ).rejects.toMatchObject<Partial<LicensingApiError>>({ code: "FORBIDDEN", status: 403 });
  });
});
