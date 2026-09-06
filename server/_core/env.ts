export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  localAuthEnabled: process.env.LOCAL_AUTH_ENABLED === "true",
  localAuthOpenId: process.env.LOCAL_AUTH_OPEN_ID ?? "local-admin",
  localAuthName: process.env.LOCAL_AUTH_NAME ?? "Local Admin",
  localAuthEmail: process.env.LOCAL_AUTH_EMAIL ?? "admin@localhost",
  localAuthSetupToken: process.env.LOCAL_AUTH_SETUP_TOKEN ?? "",
  localAuthLoginWindowMs: parseInt(process.env.LOCAL_AUTH_LOGIN_WINDOW_MS ?? "900000", 10),
  localAuthLoginMaxAttempts: parseInt(process.env.LOCAL_AUTH_LOGIN_MAX_ATTEMPTS ?? "8", 10),
  isProduction: process.env.NODE_ENV === "production",
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "60000", 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "120", 10),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  appBaseUrl: process.env.APP_BASE_URL ?? "",
};

export function isOAuthConfigured(
  env: Pick<typeof ENV, "oAuthServerUrl" | "appId"> = ENV
): boolean {
  return Boolean(env.oAuthServerUrl && env.appId);
}

/** Self-hosted local admin mode: explicit flag, or OAuth is not configured. */
export function isLocalAuthMode(
  env: Pick<typeof ENV, "localAuthEnabled" | "oAuthServerUrl" | "appId"> = ENV
): boolean {
  return env.localAuthEnabled || !isOAuthConfigured(env);
}
