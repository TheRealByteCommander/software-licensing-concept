export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || "App";

export const APP_LOGO =
  import.meta.env.VITE_APP_LOGO || "/byte_commander_logo.png";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = String(import.meta.env.VITE_OAUTH_PORTAL_URL || "").trim();
  const appId = String(import.meta.env.VITE_APP_ID || "").trim();
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  if (!oauthPortalUrl || !appId) {
    console.error("[Auth] Missing VITE_OAUTH_PORTAL_URL or VITE_APP_ID");
    return "";
  }

  let baseUrl;
  try {
    baseUrl = new URL(oauthPortalUrl);
  } catch (err) {
    console.error("[Auth] Invalid VITE_OAUTH_PORTAL_URL", oauthPortalUrl, err);
    return "";
  }

  const url = new URL("/app-auth", baseUrl);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};