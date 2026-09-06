import { beforeEach, describe, expect, it } from "vitest";
import speakeasy from "speakeasy";
import { AttemptLimiter, isLocalAuthPath, isPublicApiPath } from "./rateLimit";
import {
  LocalAuthService,
  type LocalAdminRecord,
  type LocalAuthConfig,
  type LocalAuthStore,
  decryptTotpSecret,
  encryptTotpSecret,
  hashPassword,
  identifierMatches,
  safeEqualString,
  verifyPassword,
} from "./localAuth";

function memoryStore(initial?: LocalAdminRecord[]): LocalAuthStore {
  const data = new Map<string, LocalAdminRecord>();
  for (const row of initial ?? []) {
    data.set(row.openId, row);
  }
  return {
    async get(openId) {
      return data.get(openId);
    },
    async save(record) {
      data.set(record.openId, { ...record });
    },
  };
}

function testConfig(overrides: Partial<LocalAuthConfig> = {}): LocalAuthConfig {
  return {
    openId: "local-admin",
    name: "Local Admin",
    email: "admin@localhost",
    setupToken: "setup-secret-token",
    cookieSecret: "test-cookie-secret-at-least-32-chars",
    appId: "local-auth",
    localAuthEnabled: true,
    oauthAvailable: false,
    ...overrides,
  };
}

function currentTotp(secret: string): string {
  return speakeasy.totp({ secret, encoding: "base32" });
}

describe("password hashing", () => {
  it("hashes and verifies a password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong-password-value", hash)).toBe(false);
  });
});

describe("TOTP secret encryption", () => {
  it("round-trips a secret and fails with the wrong key", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptTotpSecret(secret, "cookie-secret-one");
    expect(encrypted.startsWith("v1.")).toBe(true);
    expect(encrypted).not.toContain(secret);

    expect(decryptTotpSecret(encrypted, "cookie-secret-one")).toBe(secret);
    expect(() => decryptTotpSecret(encrypted, "cookie-secret-two")).toThrow();
  });
});

describe("identifier matching", () => {
  const config = testConfig();

  it("accepts email, openId, or name case-insensitively", () => {
    expect(identifierMatches("admin@localhost", config)).toBe(true);
    expect(identifierMatches("LOCAL-ADMIN", config)).toBe(true);
    expect(identifierMatches("local admin", config)).toBe(true);
    expect(identifierMatches("stranger", config)).toBe(false);
  });
});

describe("safeEqualString", () => {
  it("compares strings without leaking length via throw", () => {
    expect(safeEqualString("abc", "abc")).toBe(true);
    expect(safeEqualString("abc", "abd")).toBe(false);
    expect(safeEqualString("short", "much-longer")).toBe(false);
  });
});

describe("LocalAuthService login + TOTP", () => {
  const totpSecret = speakeasy.generateSecret({ length: 20 }).base32 as string;
  let service: LocalAuthService;

  beforeEach(async () => {
    const config = testConfig();
    const store = memoryStore([
      {
        openId: config.openId,
        passwordHash: await hashPassword("super-secret-password"),
        totpSecretEncrypted: encryptTotpSecret(totpSecret, config.cookieSecret),
      },
    ]);
    service = new LocalAuthService(() => config, store);
  });

  it("rejects a wrong password without issuing a pending token", async () => {
    await expect(
      service.startLogin("admin@localhost", "not-the-password")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid credentials" });
  });

  it("rejects an unknown identifier even with the correct password", async () => {
    await expect(
      service.startLogin("not-the-admin", "super-secret-password")
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires TOTP after a correct password and fails closed on a wrong code", async () => {
    const { pendingToken } = await service.startLogin("admin@localhost", "super-secret-password");
    expect(pendingToken.length).toBeGreaterThan(20);

    await expect(service.completeLogin(pendingToken, "000000")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "Invalid authentication code",
    });
  });

  it("issues an admin identity after valid password + TOTP", async () => {
    const { pendingToken } = await service.startLogin("local-admin", "super-secret-password");
    const identity = await service.completeLogin(pendingToken, currentTotp(totpSecret));
    expect(identity).toEqual({ openId: "local-admin", name: "Local Admin" });
  });

  it("does not accept a TOTP code without a pending login token", async () => {
    await expect(service.completeLogin("not-a-token", currentTotp(totpSecret))).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("LocalAuthService first-time setup", () => {
  it("blocks setup when already configured", async () => {
    const config = testConfig();
    const service = new LocalAuthService(
      () => config,
      memoryStore([
        {
          openId: config.openId,
          passwordHash: await hashPassword("already-configured"),
          totpSecretEncrypted: encryptTotpSecret("MFRGGZDFMZTWQ2LK", config.cookieSecret),
        },
      ])
    );

    await expect(
      service.startSetup({
        password: "brand-new-password",
        confirmPassword: "brand-new-password",
        setupToken: config.setupToken,
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires the setup token when LOCAL_AUTH_SETUP_TOKEN is set", async () => {
    const service = new LocalAuthService(() => testConfig(), memoryStore());
    await expect(
      service.startSetup({
        password: "brand-new-password",
        confirmPassword: "brand-new-password",
        setupToken: "wrong-token",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED", message: "Invalid setup token" });
  });

  it("enrolls TOTP and then allows password + TOTP login", async () => {
    const config = testConfig();
    const store = memoryStore();
    let capturedSecret = "";
    const service = new LocalAuthService(() => config, store, (secret, token) => {
      capturedSecret = secret;
      return speakeasy.totp.verify({ secret, encoding: "base32", token, window: 2 });
    });

    const started = await service.startSetup({
      password: "brand-new-password",
      confirmPassword: "brand-new-password",
      setupToken: config.setupToken,
    });
    expect(started.qrCode.startsWith("data:image")).toBe(true);
    expect(started.secret).toBeTruthy();

    const identity = await service.completeSetup(started.enrollmentToken, currentTotp(started.secret));
    expect(identity.openId).toBe("local-admin");
    expect(capturedSecret).toBe(started.secret);

    const saved = await store.get("local-admin");
    expect(saved?.passwordHash.startsWith("scrypt$")).toBe(true);
    expect(saved?.totpSecretEncrypted.startsWith("v1.")).toBe(true);
    expect(saved?.totpSecretEncrypted).not.toContain(started.secret);

    const { pendingToken } = await service.startLogin("admin@localhost", "brand-new-password");
    const loggedIn = await service.completeLogin(pendingToken, currentTotp(started.secret));
    expect(loggedIn.openId).toBe("local-admin");
  });

  it("allows setup without a token only when no env token is configured", async () => {
    const config = testConfig({ setupToken: "" });
    const service = new LocalAuthService(() => config, memoryStore());
    const started = await service.startSetup({
      password: "brand-new-password",
      confirmPassword: "brand-new-password",
    });
    expect(started.enrollmentToken).toBeTruthy();
  });
});

describe("route classification", () => {
  it("rate-limits admin login/setup but not public license API paths", () => {
    expect(isLocalAuthPath("/auth.localLogin")).toBe(true);
    expect(isLocalAuthPath("/auth.localVerifyTotp")).toBe(true);
    expect(isLocalAuthPath("/auth.localSetupStart")).toBe(true);
    expect(isLocalAuthPath("/auth.localSetupConfirm")).toBe(true);
    expect(isLocalAuthPath("/auth.me")).toBe(false);
    expect(isLocalAuthPath("/api.activate")).toBe(false);
    expect(isPublicApiPath("/api.activate")).toBe(true);
    expect(isPublicApiPath("/api.validate")).toBe(true);
    expect(isPublicApiPath("/twoFA.initiateActivation")).toBe(true);
    expect(isPublicApiPath("/auth.localLogin")).toBe(false);
  });
});

describe("AttemptLimiter", () => {
  it("blocks further attempts after the configured maximum", () => {
    const limiter = new AttemptLimiter(60_000, 3);
    const req = { headers: {}, ip: "203.0.113.10" } as any;
    expect(limiter.consume(req).ok).toBe(true);
    expect(limiter.consume(req).ok).toBe(true);
    expect(limiter.consume(req).ok).toBe(true);
    const blocked = limiter.consume(req);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    }
  });
});
