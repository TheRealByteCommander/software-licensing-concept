import { describe, expect, it } from "vitest";
import { isPublicApiPath } from "./_core/rateLimit";

describe("public license API paths", () => {
  it("keeps activate/validate/deactivate reachable without an admin session", () => {
    expect(isPublicApiPath("/api.activate")).toBe(true);
    expect(isPublicApiPath("/api.validate")).toBe(true);
    expect(isPublicApiPath("/api.deactivate")).toBe(true);
    expect(isPublicApiPath("/twoFA.initiateActivation")).toBe(true);
    expect(isPublicApiPath("/twoFA.confirmActivation")).toBe(true);
  });

  it("keeps in-app Stripe buy/renew/cancel APIs public for product embeds", () => {
    expect(isPublicApiPath("/stripe.status")).toBe(true);
    expect(isPublicApiPath("/stripe.plans.listPublic")).toBe(true);
    expect(isPublicApiPath("/stripe.createCheckoutSession")).toBe(true);
    expect(isPublicApiPath("/stripe.getCheckoutResult")).toBe(true);
    expect(isPublicApiPath("/stripe.getLicenseBilling")).toBe(true);
    expect(isPublicApiPath("/stripe.createCustomerPortalSession")).toBe(true);
    expect(isPublicApiPath("/stripe.cancelSubscription")).toBe(true);
  });

  it("does not treat admin user management as a public path", () => {
    expect(isPublicApiPath("/users.list")).toBe(false);
    expect(isPublicApiPath("/users.setRole")).toBe(false);
    expect(isPublicApiPath("/products.create")).toBe(false);
  });
});
