import type { AppRole } from "./rbac";

export interface AdminAuthClaims {
  role?: AppRole;
  companyIds?: string[];
  projectIds?: string[];
  mfaVerified?: boolean;
  environment?: "dev" | "stg" | "prod";
}

export interface AuthSession {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  claims: AdminAuthClaims;
}

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";
