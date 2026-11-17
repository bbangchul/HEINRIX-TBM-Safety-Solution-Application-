import type { IdTokenResult } from "firebase/auth";
import type { AdminAuthClaims } from "../types/auth";
import { APP_ROLES, type AppRole } from "../types/rbac";

function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function hasSecondFactor(claims: Record<string, unknown>): boolean {
  const firebaseClaims = claims.firebase;
  if (!firebaseClaims || typeof firebaseClaims !== "object") {
    return false;
  }

  const signInSecondFactor = (firebaseClaims as Record<string, unknown>).sign_in_second_factor;
  return typeof signInSecondFactor === "string" && signInSecondFactor.trim().length > 0;
}

export function parseClaims(tokenResult: IdTokenResult): AdminAuthClaims {
  const claims = tokenResult.claims ?? {};

  const role = isAppRole(claims.role) ? claims.role : undefined;
  const companyIds = normalizeStringArray(claims.companyIds);
  const projectIds = normalizeStringArray(claims.projectIds);
  const environment = claims.environment === "dev" || claims.environment === "stg" || claims.environment === "prod"
    ? claims.environment
    : undefined;
  const mfaVerified = Boolean(claims.mfaVerified) || hasSecondFactor(claims);

  return {
    role,
    companyIds,
    projectIds,
    mfaVerified,
    environment,
  };
}
