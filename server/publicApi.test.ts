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

  it("does not treat admin user management as a public path", () => {
    expect(isPublicApiPath("/users.list")).toBe(false);
    expect(isPublicApiPath("/users.setRole")).toBe(false);
    expect(isPublicApiPath("/products.create")).toBe(false);
  });
});
