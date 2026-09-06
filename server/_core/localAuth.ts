import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { generateQRCodeDataUrl, generateTwoFASecret, verifyTOTP } from "../twoFAUtils";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV, isLocalAuthMode, isOAuthConfigured } from "./env";
import { AttemptLimiter } from "./rateLimit";

function scryptHash(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;
const MIN_PASSWORD_LENGTH = 12;
const PENDING_LOGIN_MS = 5 * 60 * 1000;
const ENROLLMENT_MS = 15 * 60 * 1000;
const ISSUER = "Byte Commander License Server";

export type LocalAdminRecord = {
  openId: string;
  passwordHash: string;
  totpSecretEncrypted: string;
};

export type LocalAuthStore = {
  get(openId: string): Promise<LocalAdminRecord | undefined>;
  save(record: LocalAdminRecord): Promise<void>;
};

export type LocalAuthConfig = {
  openId: string;
  name: string;
  email: string;
  setupToken: string;
  cookieSecret: string;
  appId: string;
  localAuthEnabled: boolean;
  oauthAvailable: boolean;
};

export type LocalAuthStatus = {
  localAuthEnabled: boolean;
  oauthAvailable: boolean;
  setupRequired: boolean;
  setupTokenRequired: boolean;
};

type PendingLoginClaims = {
  purpose: "local-auth-pending";
  openId: string;
};

type EnrollmentClaims = {
  purpose: "local-auth-enroll";
  openId: string;
  passwordHash: string;
  totpSecret: string;
};

let dummyPasswordHash: string | null = null;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptHash(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;
    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");
    if (!salt.length || expected.length !== SCRYPT_KEYLEN) return false;

    const derived = await scryptHash(password, salt, expected.length, { N: n, r, p });
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function deriveTotpKey(cookieSecret: string): Buffer {
  return createHash("sha256").update(`local-admin-totp:${cookieSecret}`).digest();
}

export function encryptTotpSecret(plaintext: string, cookieSecret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveTotpKey(cookieSecret), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

export function decryptTotpSecret(payload: string, cookieSecret: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Unsupported TOTP secret payload");
  }
  const iv = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");
  const data = Buffer.from(parts[3], "hex");
  const decipher = createDecipheriv("aes-256-gcm", deriveTotpKey(cookieSecret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function safeEqualString(left: string, right: string): boolean {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function identifierMatches(identifier: string, config: Pick<LocalAuthConfig, "openId" | "name" | "email">): boolean {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return false;
  const candidates = [config.openId, config.email, config.name]
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return candidates.includes(normalized);
}

async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await hashPassword("dummy-password-not-used");
  }
  return dummyPasswordHash;
}

function purposeSecret(cookieSecret: string): Uint8Array {
  return new TextEncoder().encode(cookieSecret);
}

export async function signPurposeToken(
  cookieSecret: string,
  claims: Record<string, unknown>,
  expiresInMs: number
): Promise<string> {
  const issuedAt = Date.now();
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(Math.floor(issuedAt / 1000))
    .setExpirationTime(Math.floor((issuedAt + expiresInMs) / 1000))
    .sign(purposeSecret(cookieSecret));
}

export async function verifyPurposeToken<T extends Record<string, unknown>>(
  cookieSecret: string,
  token: string,
  purpose: string
): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, purposeSecret(cookieSecret), {
      algorithms: ["HS256"],
    });
    if (payload.purpose !== purpose) return null;
    return payload as T;
  } catch {
    return null;
  }
}

export const dbLocalAuthStore: LocalAuthStore = {
  async get(openId) {
    const row = await db.getLocalAdminCredentials(openId);
    if (!row) return undefined;
    return {
      openId: row.openId,
      passwordHash: row.passwordHash,
      totpSecretEncrypted: row.totpSecretEncrypted,
    };
  },
  async save(record) {
    await db.saveLocalAdminCredentials(record);
  },
};

export class LocalAuthService {
  constructor(
    private readonly getConfig: () => LocalAuthConfig,
    private readonly store: LocalAuthStore,
    private readonly totpVerify: (secret: string, token: string) => boolean = verifyTOTP
  ) {}

  async getStatus(): Promise<LocalAuthStatus> {
    const config = this.getConfig();
    if (!config.localAuthEnabled) {
      return {
        localAuthEnabled: false,
        oauthAvailable: config.oauthAvailable,
        setupRequired: false,
        setupTokenRequired: false,
      };
    }
    const existing = await this.store.get(config.openId);
    return {
      localAuthEnabled: true,
      oauthAvailable: config.oauthAvailable,
      setupRequired: !existing,
      setupTokenRequired: Boolean(config.setupToken),
    };
  }

  async startLogin(identifier: string, password: string): Promise<{ pendingToken: string }> {
    const config = this.requireReadyConfig();
    const record = await this.store.get(config.openId);
    const hashToCheck = record?.passwordHash ?? (await getDummyPasswordHash());
    const passwordOk = await verifyPassword(password, hashToCheck);
    const identityOk = identifierMatches(identifier, config);

    if (!record || !passwordOk || !identityOk) {
      throw invalidCredentials();
    }

    const pendingToken = await signPurposeToken(
      config.cookieSecret,
      { purpose: "local-auth-pending", openId: config.openId } satisfies PendingLoginClaims,
      PENDING_LOGIN_MS
    );
    return { pendingToken };
  }

  async completeLogin(pendingToken: string, totpCode: string): Promise<{ openId: string; name: string }> {
    const config = this.requireReadyConfig();
    const claims = await verifyPurposeToken<PendingLoginClaims>(
      config.cookieSecret,
      pendingToken,
      "local-auth-pending"
    );
    if (!claims || claims.openId !== config.openId) {
      throw invalidCredentials();
    }

    const record = await this.store.get(config.openId);
    if (!record) {
      throw invalidCredentials();
    }

    let secret: string;
    try {
      secret = decryptTotpSecret(record.totpSecretEncrypted, config.cookieSecret);
    } catch {
      throw invalidCredentials();
    }

    if (!this.totpVerify(secret, totpCode.trim())) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid authentication code",
      });
    }

    return { openId: config.openId, name: config.name };
  }

  async startSetup(input: {
    password: string;
    confirmPassword: string;
    setupToken?: string;
  }): Promise<{ enrollmentToken: string; qrCode: string; secret: string }> {
    const config = this.requireCryptoConfig();
    if (!config.localAuthEnabled) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Local admin setup is disabled" });
    }

    const existing = await this.store.get(config.openId);
    if (existing) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Local admin is already configured",
      });
    }

    if (config.setupToken) {
      if (!input.setupToken || !safeEqualString(input.setupToken, config.setupToken)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid setup token",
        });
      }
    }

    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (input.password !== input.confirmPassword) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Passwords do not match",
      });
    }

    const passwordHash = await hashPassword(input.password);
    const { secret } = generateTwoFASecret(config.name || "Admin", ISSUER);
    if (!secret) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate TOTP secret" });
    }

    const enrollmentToken = await signPurposeToken(
      config.cookieSecret,
      {
        purpose: "local-auth-enroll",
        openId: config.openId,
        passwordHash,
        totpSecret: secret,
      } satisfies EnrollmentClaims,
      ENROLLMENT_MS
    );
    const qrCode = await generateQRCodeDataUrl(secret, config.name || "Admin", ISSUER);
    return { enrollmentToken, qrCode, secret };
  }

  async completeSetup(
    enrollmentToken: string,
    totpCode: string
  ): Promise<{ openId: string; name: string }> {
    const config = this.requireCryptoConfig();
    if (!config.localAuthEnabled) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Local admin setup is disabled" });
    }

    const existing = await this.store.get(config.openId);
    if (existing) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Local admin is already configured",
      });
    }

    const claims = await verifyPurposeToken<EnrollmentClaims>(
      config.cookieSecret,
      enrollmentToken,
      "local-auth-enroll"
    );
    if (!claims || claims.openId !== config.openId || !claims.passwordHash || !claims.totpSecret) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired setup session" });
    }

    if (!this.totpVerify(claims.totpSecret, totpCode.trim())) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid authentication code",
      });
    }

    await this.store.save({
      openId: config.openId,
      passwordHash: claims.passwordHash,
      totpSecretEncrypted: encryptTotpSecret(claims.totpSecret, config.cookieSecret),
    });

    return { openId: config.openId, name: config.name };
  }

  private requireCryptoConfig(): LocalAuthConfig {
    const config = this.getConfig();
    if (!config.cookieSecret) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "JWT_SECRET is required for local admin authentication",
      });
    }
    return config;
  }

  private requireReadyConfig(): LocalAuthConfig {
    const config = this.requireCryptoConfig();
    if (!config.localAuthEnabled) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Local admin login is disabled" });
    }
    return config;
  }
}

export function readLocalAuthConfig(): LocalAuthConfig {
  return {
    openId: ENV.localAuthOpenId || "local-admin",
    name: ENV.localAuthName || "Local Admin",
    email: ENV.localAuthEmail || "admin@localhost",
    setupToken: ENV.localAuthSetupToken,
    cookieSecret: ENV.cookieSecret,
    appId: ENV.appId || "local-auth",
    localAuthEnabled: isLocalAuthMode(),
    oauthAvailable: isOAuthConfigured(),
  };
}

export const localAuthService = new LocalAuthService(readLocalAuthConfig, dbLocalAuthStore);

export const localAuthAttemptLimiter = new AttemptLimiter(
  Math.max(60_000, ENV.localAuthLoginWindowMs || 900_000),
  Math.max(1, ENV.localAuthLoginMaxAttempts || 8)
);

export function consumeLocalAuthAttempt(req: Request): void {
  const result = localAuthAttemptLimiter.consume(req);
  if (!result.ok) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many login or setup attempts. Try again in ${result.retryAfterSeconds} seconds.`,
    });
  }
}

export async function issueLocalAdminSession(
  req: Request,
  res: Response,
  identity: { openId: string; name: string }
): Promise<void> {
  const config = readLocalAuthConfig();
  await db.upsertUser({
    openId: identity.openId,
    name: config.name,
    email: config.email,
    loginMethod: "local",
    role: "admin",
    lastSignedIn: new Date(),
  });

  const { sdk } = await import("./sdk");
  const sessionToken = await sdk.createSessionToken(identity.openId, {
    name: identity.name || config.name,
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

function invalidCredentials(): TRPCError {
  return new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid credentials",
  });
}
