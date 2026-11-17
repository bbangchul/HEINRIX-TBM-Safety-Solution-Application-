import type { AppRole } from "../shared/roles";
import { isDeletionProtectedRole } from "../shared/roles";
import { isSuperAdminClaim, type AuthClaims } from "../auth/claims";
import { isAllowedSuperAdminEmail, isAllowedSuperAdminEnvironment } from "../auth/policy";

export function requireRole(claims: AuthClaims | null | undefined, allowedRoles: readonly AppRole[]): AppRole {
  if (!claims || !allowedRoles.includes(claims.role)) {
    throw new Error("PERMISSION_DENIED");
  }
  return claims.role;
}

export function requireSuperAdmin(claims: AuthClaims | null | undefined): void {
  if (!claims || !isSuperAdminClaim(claims)) {
    throw new Error("SUPER_ADMIN_REQUIRED");
  }

  if (!claims.mfaVerified) {
    throw new Error("SUPER_ADMIN_MFA_REQUIRED");
  }

  if (!isAllowedSuperAdminEmail(claims.email)) {
    throw new Error("SUPER_ADMIN_DOMAIN_NOT_ALLOWED");
  }

  if (!isAllowedSuperAdminEnvironment(claims.environment)) {
    throw new Error("SUPER_ADMIN_ENVIRONMENT_MISMATCH");
  }
}

export function assertNotProtectedRoleTarget(role: AppRole): void {
  if (isDeletionProtectedRole(role)) {
    throw new Error("PROTECTED_ROLE_TARGET");
  }
}
