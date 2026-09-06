export type AdminUserRole = "user" | "admin";

export type AdminUserRecord = {
  id: number;
  role: AdminUserRole;
  disabled?: boolean | null;
};

export type AdminUserAction =
  | { type: "setRole"; role: AdminUserRole }
  | { type: "setDisabled"; disabled: boolean };

export type AdminUserDecision =
  | { ok: true }
  | { ok: false; message: string };

function isActiveAdmin(user: AdminUserRecord): boolean {
  return user.role === "admin" && !user.disabled;
}

export function countActiveAdmins(users: AdminUserRecord[]): number {
  return users.filter(isActiveAdmin).length;
}

/**
 * Guardrails for admin-user mutations.
 * Prevents self-lockout and removing the last active admin.
 */
export function evaluateAdminUserChange(input: {
  actorId: number;
  target: AdminUserRecord;
  users: AdminUserRecord[];
  action: AdminUserAction;
}): AdminUserDecision {
  const { actorId, target, users, action } = input;
  const activeAdmins = countActiveAdmins(users);
  const targetIsLastActiveAdmin = isActiveAdmin(target) && activeAdmins <= 1;

  if (action.type === "setRole") {
    if (target.role === action.role) {
      return { ok: true };
    }
    if (target.id === actorId && action.role !== "admin") {
      return { ok: false, message: "You cannot demote your own admin role" };
    }
    if (targetIsLastActiveAdmin && action.role !== "admin") {
      return { ok: false, message: "Cannot demote the last active admin" };
    }
    return { ok: true };
  }

  if (target.disabled === action.disabled) {
    return { ok: true };
  }
  if (target.id === actorId && action.disabled) {
    return { ok: false, message: "You cannot disable your own account" };
  }
  if (targetIsLastActiveAdmin && action.disabled) {
    return { ok: false, message: "Cannot disable the last active admin" };
  }
  return { ok: true };
}
