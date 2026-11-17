export const APP_ROLES = ["super_admin", "company_admin", "project_admin", "worker"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ADMIN_CONSOLE_ALLOWED_ROLES: readonly AppRole[] = ["super_admin"];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "슈퍼 관리자",
  company_admin: "회사 관리자",
  project_admin: "프로젝트 관리자",
  worker: "근로자",
};
