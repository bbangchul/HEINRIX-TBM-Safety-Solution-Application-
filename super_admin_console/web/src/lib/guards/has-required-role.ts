import type { AppRole } from "../types/rbac";

export function hasRequiredRole(currentRole: AppRole | null | undefined, allowedRoles: readonly AppRole[]): boolean {
  if (!currentRole) {
    return false;
  }
  return allowedRoles.includes(currentRole);
}

export function isProtectedDeletionTarget(role: AppRole): boolean {
  return role === "super_admin";
}
