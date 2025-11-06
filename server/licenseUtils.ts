import crypto from "crypto";
import jwt from "jsonwebtoken";
import { ENV } from "./_core/env";

/**
 * Generate a random license key in the format: XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const segments = 4;
  const segmentLength = 4;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  
  const parts: string[] = [];
  for (let i = 0; i < segments; i++) {
    let segment = "";
    for (let j = 0; j < segmentLength; j++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    parts.push(segment);
  }
  
  return parts.join("-");
}

/**
 * Generate a signed JWT token for license validation
 */
export function generateLicenseToken(payload: {
  licenseKey: string;
  productId: number;
  deviceId: string;
  expiresAt?: Date | null;
  features?: string[];
}): string {
  const tokenPayload = {
    licenseKey: payload.licenseKey,
    productId: payload.productId,
    deviceId: payload.deviceId,
    features: payload.features || [],
    iat: Math.floor(Date.now() / 1000),
  };

  // Set expiration based on license expiry or default to 7 days for offline validation
  const expiresIn = payload.expiresAt 
    ? Math.floor((payload.expiresAt.getTime() - Date.now()) / 1000)
    : 7 * 24 * 60 * 60; // 7 days

  return jwt.sign(tokenPayload, ENV.cookieSecret, { expiresIn });
}

/**
 * Verify and decode a license token
 */
export function verifyLicenseToken(token: string): any {
  try {
    return jwt.verify(token, ENV.cookieSecret);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
}

/**
 * Generate a device ID hash from device information
 */
export function generateDeviceId(deviceInfo: string): string {
  return crypto.createHash("sha256").update(deviceInfo).digest("hex");
}
