import type { AppRole } from "../lib/types/rbac";

export interface AdminRoute {
  path: string;
  name: string;
  allowedRoles: readonly AppRole[];
}

export const ADMIN_ROUTES: readonly AdminRoute[] = [
  { path: "/admin", name: "대시보드", allowedRoles: ["super_admin"] },
  { path: "/admin/companies", name: "회사 관리", allowedRoles: ["super_admin"] },
  { path: "/admin/company-approval-requests", name: "회사 승인 요청", allowedRoles: ["super_admin"] },
  { path: "/admin/projects", name: "프로젝트 관리", allowedRoles: ["super_admin"] },
  { path: "/admin/memberships", name: "멤버십 관리", allowedRoles: ["super_admin"] },
  { path: "/admin/users", name: "사용자/권한", allowedRoles: ["super_admin"] },
  { path: "/admin/deletion-requests", name: "삭제 요청", allowedRoles: ["super_admin"] },
  { path: "/admin/audit-logs", name: "감사 로그", allowedRoles: ["super_admin"] },
  { path: "/admin/system-configs", name: "운영 설정", allowedRoles: ["super_admin"] },
];
