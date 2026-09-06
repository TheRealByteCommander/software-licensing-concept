import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

vi.mock("./db", () => ({
  getLatestActivationByDeviceAndLicense: vi.fn(),
  deactivateActivation: vi.fn(),
  deleteActivationTokensForDevice: vi.fn(),
}));

vi.mock("./webhooks", () => ({
  dispatchWebhookEvent: vi.fn(),
}));

import * as db from "./db";
import { releaseLicenseSeat } from "./licenseFlow";

describe("releaseLicenseSeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft-deactivates the activation and deletes related tokens so the seat is reusable", async () => {
    vi.mocked(db.getLatestActivationByDeviceAndLicense).mockResolvedValue({
      id: 41,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      deviceId: "device-1",
      deviceInfo: null,
      activatedAt: new Date("2026-09-01T00:00:00.000Z"),
      lastValidatedAt: new Date("2026-09-01T00:00:00.000Z"),
      deactivatedAt: null,
    });
    vi.mocked(db.deactivateActivation).mockResolvedValue(undefined as never);
    vi.mocked(db.deleteActivationTokensForDevice).mockResolvedValue(undefined as never);

    const result = await releaseLicenseSeat("AAAA-BBBB-CCCC-DDDD", "device-1");

    expect(result).toEqual({ alreadyReleased: false });
    expect(db.deactivateActivation).toHaveBeenCalledWith(41);
    expect(db.deleteActivationTokensForDevice).toHaveBeenCalledWith(
      "AAAA-BBBB-CCCC-DDDD",
      "device-1"
    );
  });

  it("is idempotent when the seat is already released and still clears tokens", async () => {
    vi.mocked(db.getLatestActivationByDeviceAndLicense).mockResolvedValue({
      id: 41,
      licenseKey: "AAAA-BBBB-CCCC-DDDD",
      deviceId: "device-1",
      deviceInfo: null,
      activatedAt: new Date("2026-09-01T00:00:00.000Z"),
      lastValidatedAt: new Date("2026-09-01T00:00:00.000Z"),
      deactivatedAt: new Date("2026-09-06T12:00:00.000Z"),
    });
    vi.mocked(db.deleteActivationTokensForDevice).mockResolvedValue(undefined as never);

    const result = await releaseLicenseSeat("AAAA-BBBB-CCCC-DDDD", "device-1");

    expect(result).toEqual({ alreadyReleased: true });
    expect(db.deactivateActivation).not.toHaveBeenCalled();
    expect(db.deleteActivationTokensForDevice).toHaveBeenCalledWith(
      "AAAA-BBBB-CCCC-DDDD",
      "device-1"
    );
  });

  it("rejects when no activation exists for the device", async () => {
    vi.mocked(db.getLatestActivationByDeviceAndLicense).mockResolvedValue(undefined);
    vi.mocked(db.deleteActivationTokensForDevice).mockResolvedValue(undefined as never);

    try {
      await releaseLicenseSeat("AAAA-BBBB-CCCC-DDDD", "device-1");
      throw new Error("expected NOT_FOUND");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect(error).toMatchObject({
        code: "NOT_FOUND",
        message: "Activation not found",
      });
    }

    expect(db.deleteActivationTokensForDevice).toHaveBeenCalledWith(
      "AAAA-BBBB-CCCC-DDDD",
      "device-1"
    );
  });
});
