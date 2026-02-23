import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";

/**
 * Generate a new 2FA secret for a product
 */
export function generateTwoFASecret(productName: string, issuer: string = "License Server") {
  const secret = speakeasy.generateSecret({
    name: `${issuer} (${productName})`,
    issuer,
    length: 32,
  });

  return {
    secret: secret.base32 || "",
  };
}

/**
 * Generate QR code image as data URL
 */
export async function generateQRCodeDataUrl(secret: string, productName: string, issuer: string = "License Server"): Promise<string> {
  const otpauth = speakeasy.otpauthURL({
    secret,
    label: `${issuer} (${productName})`,
    issuer,
    encoding: "base32",
  });

  return await QRCode.toDataURL(otpauth);
}

/**
 * Verify a TOTP token
 */
export function verifyTOTP(secret: string, token: string, window: number = 2): boolean {
  try {
    const verified = speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window,
    });
    return verified;
  } catch (error) {
    return false;
  }
}

/**
 * Generate backup codes for 2FA
 */
export function generateBackupCodes(count: number = 10): string[] {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const codeLength = 8;
  const codes: string[] = [];

  while (codes.length < count) {
    const bytes = crypto.randomBytes(codeLength);
    let code = "";
    for (let i = 0; i < codeLength; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    if (!codes.includes(code)) {
      codes.push(code);
    }
  }

  return codes;
}

/**
 * Verify and consume a backup code
 */
export function verifyBackupCode(code: string, backupCodes: string[]): boolean {
  return backupCodes.includes(code.toUpperCase());
}

/**
 * Hash a backup code for storage
 */
export function hashBackupCode(code: string): string {
  // In production, use proper hashing (bcrypt, argon2, etc.)
  // For now, we'll use a simple approach
  return Buffer.from(code).toString("base64");
}
