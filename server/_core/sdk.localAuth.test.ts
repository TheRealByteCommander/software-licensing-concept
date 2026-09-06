import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";

const envState = {
  appId: "",
  cookieSecret: "test-secret-at-least-32-chars-long!!",
  oAuthServerUrl: "",
  localAuthEnabled: true,
  localAuthOpenId: "local-admin",
  localAuthName: "Local Admin",
  localAuthEmail: "admin@localhost",
  ownerOpenId: "",
};

vi.mock("./env", () => ({
  ENV: envState,
  isOAuthConfigured: () => Boolean(envState.oAuthServerUrl && envState.appId),
  isLocalAuthMode: () => envState.localAuthEnabled || !(envState.oAuthServerUrl && envState.appId),
}));

vi.mock("../db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
}));

import { sdk } from "./sdk";
import * as db from "../db";

function requestWithCookie(cookie?: string): Request {
  return {
    headers: cookie ? { cookie } : {},
  } as Request;
}

describe("authenticateRequest local admin mode", () => {
  beforeEach(() => {
    envState.localAuthEnabled = true;
    envState.oAuthServerUrl = "";
    envState.appId = "";
    envState.localAuthOpenId = "local-admin";
    vi.clearAllMocks();
    vi.mocked(db.getUserByOpenId).mockResolvedValue(undefined);
  });

  it("rejects unauthenticated requests instead of auto-granting admin", async () => {
    await expect(sdk.authenticateRequest(requestWithCookie())).rejects.toMatchObject({
      statusCode: 403,
      message: "Invalid session cookie",
    });
    expect(db.upsertUser).not.toHaveBeenCalled();
  });

  it("rejects a session for a different openId", async () => {
    const token = await sdk.createSessionToken("someone-else", { name: "Other" });
    await expect(
      sdk.authenticateRequest(requestWithCookie(`${COOKIE_NAME}=${token}`))
    ).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("authenticates the local admin when a valid session cookie is present", async () => {
    const token = await sdk.createSessionToken("local-admin", { name: "Local Admin" });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 1,
      openId: "local-admin",
      name: "Local Admin",
      email: "admin@localhost",
      loginMethod: "local",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);

    const user = await sdk.authenticateRequest(requestWithCookie(`${COOKIE_NAME}=${token}`));
    expect(user.openId).toBe("local-admin");
    expect(user.role).toBe("admin");
    expect(db.upsertUser).toHaveBeenCalled();
  });

  it("falls back to an in-memory admin only after a valid session is verified", async () => {
    const token = await sdk.createSessionToken("local-admin", { name: "Local Admin" });
    const user = await sdk.authenticateRequest(requestWithCookie(`${COOKIE_NAME}=${token}`));
    expect(user.openId).toBe("local-admin");
    expect(user.role).toBe("admin");
    expect(user.loginMethod).toBe("local");
  });
});

describe("authenticateRequest OAuth mode", () => {
  beforeEach(() => {
    envState.localAuthEnabled = false;
    envState.oAuthServerUrl = "https://oauth.example.com";
    envState.appId = "bc-app";
    vi.clearAllMocks();
    vi.mocked(db.getUserByOpenId).mockResolvedValue(undefined);
  });

  it("still requires a session cookie when OAuth is configured", async () => {
    await expect(sdk.authenticateRequest(requestWithCookie())).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("loads the OAuth user from the database when the session is valid", async () => {
    const token = await sdk.createSessionToken("oauth-user", { name: "OAuth User" });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({
      id: 9,
      openId: "oauth-user",
      name: "OAuth User",
      email: "user@example.com",
      loginMethod: "email",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);

    const user = await sdk.authenticateRequest(requestWithCookie(`${COOKIE_NAME}=${token}`));
    expect(user.openId).toBe("oauth-user");
    expect(user.name).toBe("OAuth User");
  });
});
