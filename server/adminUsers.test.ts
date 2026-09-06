import { describe, expect, it } from "vitest";
import { evaluateAdminUserChange, countActiveAdmins } from "@shared/adminUsers";

const admin = (id: number, extra: { disabled?: boolean } = {}) => ({
  id,
  role: "admin" as const,
  disabled: extra.disabled ?? false,
});

const member = (id: number, extra: { disabled?: boolean } = {}) => ({
  id,
  role: "user" as const,
  disabled: extra.disabled ?? false,
});

describe("evaluateAdminUserChange", () => {
  it("counts only non-disabled admins", () => {
    expect(countActiveAdmins([admin(1), admin(2, { disabled: true }), member(3)])).toBe(1);
  });

  it("allows promoting a regular user", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: member(2),
      users: [admin(1), member(2)],
      action: { type: "setRole", role: "admin" },
    });
    expect(decision).toEqual({ ok: true });
  });

  it("blocks self-demotion", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: admin(1),
      users: [admin(1), admin(2)],
      action: { type: "setRole", role: "user" },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.message).toMatch(/own admin role/i);
    }
  });

  it("blocks demoting the last active admin", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: admin(2),
      users: [admin(1, { disabled: true }), admin(2)],
      action: { type: "setRole", role: "user" },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.message).toMatch(/last active admin/i);
    }
  });

  it("blocks disabling your own account", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: admin(1),
      users: [admin(1), admin(2)],
      action: { type: "setDisabled", disabled: true },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.message).toMatch(/your own account/i);
    }
  });

  it("blocks disabling the last active admin", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: admin(2),
      users: [admin(1, { disabled: true }), admin(2)],
      action: { type: "setDisabled", disabled: true },
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.message).toMatch(/last active admin/i);
    }
  });

  it("allows disabling a non-admin user", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: member(3),
      users: [admin(1), member(3)],
      action: { type: "setDisabled", disabled: true },
    });
    expect(decision).toEqual({ ok: true });
  });

  it("allows re-enabling a disabled admin", () => {
    const decision = evaluateAdminUserChange({
      actorId: 1,
      target: admin(2, { disabled: true }),
      users: [admin(1), admin(2, { disabled: true })],
      action: { type: "setDisabled", disabled: false },
    });
    expect(decision).toEqual({ ok: true });
  });
});
