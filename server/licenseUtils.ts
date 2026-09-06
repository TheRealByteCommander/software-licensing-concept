import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";
import { DEFAULT_OFFLINE_GRACE_HOURS, normalizeOfflineGraceHours } from "@shared/licenseMetadata";

/**
 * Generate a random license key in the format: XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const segments = 4;
  const segmentLength = 4;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  const bytes = crypto.randomBytes(segments * segmentLength);
  const parts: string[] = [];

  for (let i = 0; i < segments; i++) {
    let segment = "";
    for (let j = 0; j < segmentLength; j++) {
      const byte = bytes[i * segmentLength + j];
      segment += chars[byte % chars.length];
    }
    parts.push(segment);
  }

  return parts.join("-");
}

export type OfflineWindow = {
  offlineGraceHours: number;
  offlineUntil: number;
  exp: number;
  licenseExpiresAt: number | null;
};

/** Offline JWT window: default 72h, never longer than the license expiry. */
export function computeOfflineWindow(input: {
  nowMs?: number;
  offlineGraceHours?: number;
  licenseExpiresAt?: Date | null;
}): OfflineWindow {
  const nowSec = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const offlineGraceHours = normalizeOfflineGraceHours(input.offlineGraceHours);
  const graceUntil = nowSec + offlineGraceHours * 60 * 60;
  const licenseExpiresAt = input.licenseExpiresAt
    ? Math.floor(new Date(input.licenseExpiresAt).getTime() / 1000)
    : null;
  const exp =
    licenseExpiresAt != null && Number.isFinite(licenseExpiresAt)
      ? Math.min(graceUntil, licenseExpiresAt)
      : graceUntil;

  return {
    offlineGraceHours,
    offlineUntil: exp,
    exp: Math.max(exp, nowSec + 1),
    licenseExpiresAt: licenseExpiresAt != null && Number.isFinite(licenseExpiresAt) ? licenseExpiresAt : null,
  };
}

export type LicenseTokenClaims = {
  licenseKey: string;
  productId: number;
  deviceId: string;
  features: string[];
  offlineGraceHours: number;
  offlineUntil: number;
  licenseExpiresAt: number | null;
  iat: number;
  exp: number;
};

/**
 * Generate a signed JWT token for license validation.
 * `exp` / `offlineUntil` are the offline grace window (72h by default).
 * `licenseExpiresAt` is the actual license end date (unix seconds) or null.
 */
export function generateLicenseToken(payload: {
  licenseKey: string;
  productId: number;
  deviceId: string;
  expiresAt?: Date | null;
  features?: string[];
  offlineGraceHours?: number;
  now?: Date;
}): string {
  const nowMs = payload.now?.getTime() ?? Date.now();
  const window = computeOfflineWindow({
    nowMs,
    offlineGraceHours: payload.offlineGraceHours ?? DEFAULT_OFFLINE_GRACE_HOURS,
    licenseExpiresAt: payload.expiresAt,
  });

  const tokenPayload: LicenseTokenClaims = {
    licenseKey: payload.licenseKey,
    productId: payload.productId,
    deviceId: payload.deviceId,
    features: payload.features || [],
    offlineGraceHours: window.offlineGraceHours,
    offlineUntil: window.offlineUntil,
    licenseExpiresAt: window.licenseExpiresAt,
    iat: Math.floor(nowMs / 1000),
    exp: window.exp,
  };

  return jwt.sign(tokenPayload, ENV.cookieSecret);
}

/**
 * Verify and decode a license token
 */
export function verifyLicenseToken(token: string): LicenseTokenClaims {
  try {
    return jwt.verify(token, ENV.cookieSecret) as LicenseTokenClaims;
  } catch {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Generate a device ID hash from device information
 */
export function generateDeviceId(deviceInfo: string): string {
  return crypto.createHash("sha256").update(deviceInfo).digest("hex");
}
