export const APP_ROLES = [
  "super_admin",
  "company_admin",
  "project_admin",
  "worker",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const USER_STATUSES = ["active", "disabled", "pending"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const DELETION_PROTECTED_ROLES = ["super_admin"] as const;

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === "string" && (USER_STATUSES as readonly string[]).includes(value);
}

export function isDeletionProtectedRole(role: AppRole): boolean {
  return (DELETION_PROTECTED_ROLES as readonly string[]).includes(role);
}
