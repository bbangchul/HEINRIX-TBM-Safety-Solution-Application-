import { isAppRole, type AppRole } from "../shared/roles";

export type EnvironmentName = "dev" | "stg" | "prod";

export interface AuthClaims {
  uid: string;
  email?: string;
  role: AppRole;
  companyIds: string[];
  projectIds: string[];
  mfaVerified: boolean;
  environment: EnvironmentName;
}

export function isEnvironmentName(value: unknown): value is EnvironmentName {
  return value === "dev" || value === "stg" || value === "prod";
}

export function normalizeClaims(input: Partial<AuthClaims> & { uid?: string }): AuthClaims {
  if (!input.uid) {
    throw new Error("AUTH_UID_REQUIRED");
  }

  const email = typeof input.email === "string" && input.email.trim().length > 0 ? input.email.trim().toLowerCase() : undefined;
  const role = isAppRole(input.role) ? input.role : "worker";
  const companyIds = Array.isArray(input.companyIds) ? input.companyIds.filter((v): v is string => typeof v === "string") : [];
  const projectIds = Array.isArray(input.projectIds) ? input.projectIds.filter((v): v is string => typeof v === "string") : [];
  const environment = isEnvironmentName(input.environment) ? input.environment : "dev";

  return {
    uid: input.uid,
    email,
    role,
    companyIds,
    projectIds,
    mfaVerified: Boolean(input.mfaVerified),
    environment,
  };
}

export function isSuperAdminClaim(claims: Pick<AuthClaims, "role"> | null | undefined): boolean {
  return claims?.role === "super_admin";
}
