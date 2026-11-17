import type {
  AuditLogDoc,
  CompanyApprovalRequestDoc,
  CompanyApprovalRequestStatus,
  CompanyDoc,
  CompanyStatus,
  DeletionRequestDoc,
  DeletionRequestStatus,
  MembershipDoc,
  MembershipStatus,
  ProjectDoc,
  ProjectStatus,
  SystemConfigDoc,
  UserDoc,
  UserStatus,
} from "../types/firestore";
import type { AppRole } from "../types/rbac";
import { callCallable, isFunctionsReady, postFunctionJson } from "./functions-client";

interface ListResponse<T> {
  items: T[];
}

type UnknownRecord = Record<string, unknown>;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toUserDoc(raw: UnknownRecord): UserDoc {
  return {
    id: String(raw.id ?? ""),
    role: (raw.role as AppRole) ?? "worker",
    status: (raw.status as UserStatus) ?? "pending",
    email: String(raw.email ?? ""),
    displayName: String(raw.displayName ?? ""),
    phoneNumber: raw.phoneNumber ? String(raw.phoneNumber) : undefined,
    photoUrl: raw.photoUrl ? String(raw.photoUrl) : undefined,
    companyIds: asArray<string>(raw.companyIds),
    projectIds: asArray<string>(raw.projectIds),
    superAdminProtected: Boolean(raw.superAdminProtected),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toCompanyDoc(raw: UnknownRecord): CompanyDoc {
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    code: String(raw.code ?? ""),
    status: (raw.status as CompanyStatus) ?? "active",
    ownerUid: String(raw.ownerUid ?? ""),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toCompanyApprovalRequestDoc(raw: UnknownRecord): CompanyApprovalRequestDoc {
  return {
    id: String(raw.requestId ?? raw.id ?? ""),
    companyId: String(raw.approvedCompanyId ?? raw.existingCompanyId ?? raw.companyId ?? ""),
    requesterUid: String(raw.requesterUid ?? ""),
    requesterEmail: raw.requesterEmail ? String(raw.requesterEmail) : null,
    requesterName: raw.requesterName ? String(raw.requesterName) : null,
    companyName: raw.companyName ? String(raw.companyName) : null,
    businessRegNoMasked: raw.businessRegNoMasked ? String(raw.businessRegNoMasked) : null,
    bizAddress: raw.bizAddress ? String(raw.bizAddress) : null,
    existingCompanyId: raw.existingCompanyId ? String(raw.existingCompanyId) : null,
    approvedCompanyId: raw.approvedCompanyId ? String(raw.approvedCompanyId) : null,
    status: (raw.status as CompanyApprovalRequestStatus) ?? "pending",
    reason: raw.reason ? String(raw.reason) : null,
    rejectReason: raw.rejectReason ? String(raw.rejectReason) : null,
    reviewedBy: raw.reviewedByUid ? String(raw.reviewedByUid) : raw.reviewedBy ? String(raw.reviewedBy) : null,
    reviewedAt: raw.reviewedAt,
    submittedAt: raw.submittedAt,
    businessLicenseFileName: raw.businessLicenseFileName ? String(raw.businessLicenseFileName) : null,
    businessLicenseDownloadUrl: raw.businessLicenseDownloadUrl ? String(raw.businessLicenseDownloadUrl) : null,
    createdAt: raw.submittedAt ?? raw.createdAt,
    updatedAt: raw.reviewedAt ?? raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toProjectDoc(raw: UnknownRecord): ProjectDoc {
  return {
    id: String(raw.id ?? ""),
    companyId: String(raw.companyId ?? ""),
    name: String(raw.name ?? ""),
    status: (raw.status as ProjectStatus) ?? "active",
    startDate: raw.startDate ? String(raw.startDate) : null,
    endDate: raw.endDate ? String(raw.endDate) : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toDeletionRequestDoc(raw: UnknownRecord): DeletionRequestDoc {
  return {
    id: String(raw.id ?? ""),
    requesterUid: String(raw.requesterUid ?? ""),
    targetUid: String(raw.targetUid ?? ""),
    targetRole: (raw.targetRole as AppRole) ?? "worker",
    status: (raw.status as DeletionRequestStatus) ?? "requested",
    reason: raw.reason ? String(raw.reason) : null,
    reviewComment: raw.reviewComment ? String(raw.reviewComment) : null,
    reviewedBy: raw.reviewedBy ? String(raw.reviewedBy) : null,
    reviewedAt: raw.reviewedAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toMembershipDoc(raw: UnknownRecord): MembershipDoc {
  return {
    id: String(raw.id ?? ""),
    uid: String(raw.uid ?? ""),
    companyId: String(raw.companyId ?? ""),
    projectId: raw.projectId ? String(raw.projectId) : null,
    role: (raw.role as AppRole) ?? "worker",
    status: (raw.status as MembershipStatus) ?? "active",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toAuditLogDoc(raw: UnknownRecord): AuditLogDoc {
  return {
    id: String(raw.id ?? ""),
    actorUid: String(raw.actorUid ?? ""),
    actorRole: (raw.actorRole as AppRole) ?? "super_admin",
    action: String(raw.action ?? ""),
    resourceType: String(raw.resourceType ?? ""),
    resourceId: String(raw.resourceId ?? ""),
    companyId: raw.companyId ? String(raw.companyId) : null,
    projectId: raw.projectId ? String(raw.projectId) : null,
    before: (raw.before as Record<string, unknown> | null | undefined) ?? null,
    after: (raw.after as Record<string, unknown> | null | undefined) ?? null,
    metadata: (raw.metadata as Record<string, unknown> | null | undefined) ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

function toSystemConfigDoc(raw: UnknownRecord): SystemConfigDoc {
  return {
    id: String(raw.id ?? ""),
    category: String(raw.category ?? ""),
    value: raw.value,
    description: raw.description ? String(raw.description) : undefined,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    createdBy: raw.createdBy ? String(raw.createdBy) : undefined,
    updatedBy: raw.updatedBy ? String(raw.updatedBy) : undefined,
  };
}

let mockUsers: UserDoc[] = [
  {
    id: "u_super_1",
    role: "super_admin",
    status: "active",
    email: "superadmin@heinrix.com",
    displayName: "안전한하루 Root",
    companyIds: ["company_alpha"],
    projectIds: ["project_a"],
    superAdminProtected: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "u_pm_1",
    role: "project_admin",
    status: "active",
    email: "pm1@heinrix.com",
    displayName: "Project Admin 1",
    companyIds: ["company_alpha"],
    projectIds: ["project_a"],
    superAdminProtected: false,
    updatedAt: new Date().toISOString(),
  },
];

let mockCompanies: CompanyDoc[] = [
  {
    id: "company_alpha",
    name: "Alpha Construction",
    code: "ALPHA",
    status: "active",
    ownerUid: "u_super_1",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "company_beta",
    name: "Beta Engineering",
    code: "BETA",
    status: "inactive",
    ownerUid: "u_super_1",
    updatedAt: new Date().toISOString(),
  },
];

let mockProjects: ProjectDoc[] = [
  {
    id: "project_a",
    companyId: "company_alpha",
    name: "A Tower",
    status: "active",
    startDate: "2026-01-02",
    endDate: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "project_b",
    companyId: "company_beta",
    name: "B Site",
    status: "archived",
    startDate: "2025-03-01",
    endDate: "2025-12-01",
    updatedAt: new Date().toISOString(),
  },
];

let mockCompanyApprovalRequests: CompanyApprovalRequestDoc[] = [
  {
    id: "car_001",
    companyId: "company_alpha",
    requesterUid: "u_pm_1",
    requesterEmail: "worker1@heinrix.com",
    requesterName: "현장 관리자 1",
    companyName: "Alpha Construction",
    businessRegNoMasked: "123-45-***67",
    bizAddress: "Seoul",
    existingCompanyId: "company_alpha",
    status: "pending",
    businessLicenseFileName: "alpha-license.pdf",
    businessLicenseDownloadUrl: "https://example.com/alpha-license.pdf",
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "car_002",
    companyId: "company_beta",
    requesterUid: "u_pm_1",
    requesterEmail: "worker2@heinrix.com",
    requesterName: "현장 관리자 2",
    companyName: "Beta Engineering",
    businessRegNoMasked: "456-78-***90",
    bizAddress: "Busan",
    existingCompanyId: "company_beta",
    status: "approved",
    reviewedBy: "u_super_1",
    reviewedAt: new Date().toISOString(),
    businessLicenseFileName: "beta-license.pdf",
    businessLicenseDownloadUrl: "https://example.com/beta-license.pdf",
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

let mockDeletionRequests: DeletionRequestDoc[] = [
  {
    id: "dr_001",
    requesterUid: "u_pm_1",
    targetUid: "u_worker_1",
    targetRole: "worker",
    status: "requested",
    reason: "퇴사",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: "dr_002",
    requesterUid: "u_pm_1",
    targetUid: "u_worker_2",
    targetRole: "worker",
    status: "approved",
    reason: "중복 계정",
    reviewedBy: "u_super_1",
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

let mockMemberships: MembershipDoc[] = [
  {
    id: "u_pm_1_company_alpha_project_a",
    uid: "u_pm_1",
    companyId: "company_alpha",
    projectId: "project_a",
    role: "project_admin",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
  {
    id: "u_worker_1_company_alpha_project_a",
    uid: "u_worker_1",
    companyId: "company_alpha",
    projectId: "project_a",
    role: "worker",
    status: "active",
    updatedAt: new Date().toISOString(),
  },
];

export interface UsersQuery {
  limit?: number;
  role?: AppRole;
  status?: UserStatus;
}

export interface CompaniesQuery {
  limit?: number;
  status?: CompanyStatus;
}

export interface CompanyApprovalRequestsQuery {
  limit?: number;
  status?: CompanyApprovalRequestStatus;
}

export interface ProjectsQuery {
  limit?: number;
  companyId?: string;
  status?: ProjectStatus;
}

export interface DeletionRequestsQuery {
  limit?: number;
  status?: DeletionRequestStatus;
}

export interface MembershipsQuery {
  limit?: number;
  uid?: string;
  companyId?: string;
  projectId?: string;
  role?: AppRole;
  status?: MembershipStatus;
}

export interface AuditLogsQuery {
  limit?: number;
  actorUid?: string;
  actorRole?: AppRole;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SystemConfigsQuery {
  limit?: number;
  category?: string;
  keyword?: string;
}

export interface DashboardOverviewQuery {
  recentLimit?: number;
}

export type DashboardWarningLevel = "info" | "warning" | "danger";

export interface DashboardWarning {
  code: string;
  level: DashboardWarningLevel;
  title: string;
  description: string;
  count?: number;
}

export interface DashboardKpi {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  activeProjects: number;
  pendingDeletionRequests: number;
  inReviewDeletionRequests: number;
}

export interface DashboardOverview {
  kpi: DashboardKpi;
  warnings: DashboardWarning[];
  recentDeletionRequests: DeletionRequestDoc[];
  recentAuditLogs: AuditLogDoc[];
  generatedAt?: unknown;
}

export interface UpsertCompanyInput {
  companyId?: string;
  name: string;
  code: string;
  status?: CompanyStatus;
}

export interface SetCompanyStatusInput {
  companyId: string;
  status: CompanyStatus;
}

export interface UpsertProjectInput {
  projectId?: string;
  companyId: string;
  name: string;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
}

export interface ArchiveProjectInput {
  projectId: string;
}

export interface SetUserRoleInput {
  uid: string;
  role: AppRole;
}

export interface SetUserStatusInput {
  uid: string;
  status: UserStatus;
}

export interface ReviewDeletionRequestInput {
  requestId: string;
  status: DeletionRequestStatus;
  reviewComment?: string;
}

export interface ReviewCompanyApprovalRequestInput {
  requestId: string;
  status: CompanyApprovalRequestStatus;
  rejectReason?: string;
}

export interface UpsertMembershipInput {
  membershipId?: string;
  uid: string;
  companyId: string;
  projectId?: string | null;
  role: AppRole;
  status?: MembershipStatus;
}

export interface DeleteMembershipInput {
  membershipId: string;
}

export type DeleteUserMode = "anonymize" | "hard_delete";

export interface DeleteOrAnonymizeUserInput {
  uid: string;
  mode?: DeleteUserMode;
  deleteAuth?: boolean;
  reason?: string;
}

export interface UpsertSystemConfigInput {
  configKey: string;
  category: string;
  value: unknown;
  description?: string;
}

export interface UpdateSystemConfigInput {
  configKey: string;
  category?: string;
  value?: unknown;
  description?: string;
}

const ALLOWED_DELETION_REVIEW_TRANSITIONS: Record<DeletionRequestStatus, readonly DeletionRequestStatus[]> = {
  requested: ["in_review", "approved", "rejected", "cancelled"],
  in_review: ["approved", "rejected", "cancelled"],
  approved: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
};

function canReviewDeletionRequestTransition(from: DeletionRequestStatus, to: DeletionRequestStatus): boolean {
  return ALLOWED_DELETION_REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

const ALLOWED_COMPANY_APPROVAL_REVIEW_TRANSITIONS: Record<
  CompanyApprovalRequestStatus,
  readonly CompanyApprovalRequestStatus[]
> = {
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
  cancelled: [],
};

function canReviewCompanyApprovalRequestTransition(
  from: CompanyApprovalRequestStatus,
  to: CompanyApprovalRequestStatus
): boolean {
  return ALLOWED_COMPANY_APPROVAL_REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

function applyLimit<T>(rows: T[], limit?: number): T[] {
  if (!limit || limit < 1) {
    return rows;
  }
  return rows.slice(0, limit);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildMembershipId(uid: string, companyId: string, projectId?: string | null): string {
  return [uid, companyId, projectId ?? "root"].join("_");
}

function buildDashboardWarnings(kpi: DashboardKpi): DashboardWarning[] {
  const warnings: DashboardWarning[] = [];

  if (kpi.pendingDeletionRequests > 0) {
    warnings.push({
      code: "pending_deletion_requests",
      level: kpi.pendingDeletionRequests >= 10 ? "danger" : "warning",
      title: "삭제 요청 대기 건 존재",
      description: "요청 대기 건이 남아 있습니다. 정책 SLA 내 처리 여부를 확인해 주세요.",
      count: kpi.pendingDeletionRequests,
    });
  }

  if (kpi.inReviewDeletionRequests > 0) {
    warnings.push({
      code: "in_review_deletion_requests",
      level: kpi.inReviewDeletionRequests >= 10 ? "danger" : "warning",
      title: "검토 중 삭제 요청 존재",
      description: "검토 단계가 누적되고 있습니다. 담당자 할당 및 처리 우선순위를 점검해 주세요.",
      count: kpi.inReviewDeletionRequests,
    });
  }

  if (kpi.totalUsers > 0 && kpi.disabledUsers >= kpi.activeUsers) {
    warnings.push({
      code: "disabled_ratio_high",
      level: "warning",
      title: "비활성 사용자 비중 높음",
      description: "비활성 사용자 수가 활성 사용자 수 이상입니다. 계정 정리/운영 정책을 확인해 주세요.",
      count: kpi.disabledUsers,
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      code: "healthy",
      level: "info",
      title: "현재 운영 경고 없음",
      description: "핵심 지표 기준으로 즉시 대응이 필요한 경고가 없습니다.",
    });
  }

  return warnings;
}

export const adminApi = {
  usingMockData: !isFunctionsReady,

  async getDashboardOverview(query: DashboardOverviewQuery = {}): Promise<DashboardOverview> {
    const recentLimit =
      typeof query.recentLimit === "number" && Number.isFinite(query.recentLimit)
        ? Math.min(20, Math.max(1, Math.trunc(query.recentLimit)))
        : 6;

    if (!isFunctionsReady) {
      const kpi: DashboardKpi = {
        totalUsers: mockUsers.length,
        activeUsers: mockUsers.filter((row) => row.status === "active").length,
        disabledUsers: mockUsers.filter((row) => row.status === "disabled").length,
        activeProjects: mockProjects.filter((row) => row.status === "active").length,
        pendingDeletionRequests: mockDeletionRequests.filter((row) => row.status === "requested").length,
        inReviewDeletionRequests: mockDeletionRequests.filter((row) => row.status === "in_review").length,
      };

      const recentDeletionRequests = applyLimit(
        [...mockDeletionRequests].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
        recentLimit
      );

      const recentAuditLogs: AuditLogDoc[] = recentDeletionRequests.map((row, index) => ({
        id: `mock_audit_${row.id}`,
        actorUid: row.reviewedBy ?? row.requesterUid,
        actorRole: "super_admin",
        action: "deletion_request.review",
        resourceType: "deletionRequests",
        resourceId: row.id,
        metadata: {
          source: "mock",
          sequence: index + 1,
        },
        createdAt: row.updatedAt ?? row.createdAt ?? nowIso(),
      }));

      return {
        kpi,
        warnings: buildDashboardWarnings(kpi),
        recentDeletionRequests,
        recentAuditLogs,
        generatedAt: nowIso(),
      };
    }

    const response = await callCallable<
      DashboardOverviewQuery,
      {
        kpi: DashboardKpi;
        warnings: DashboardWarning[];
        recentDeletionRequests: UnknownRecord[];
        recentAuditLogs: UnknownRecord[];
        generatedAt?: unknown;
      }
    >("adminGetDashboardOverview", { recentLimit });

    return {
      kpi: response.kpi,
      warnings: asArray<DashboardWarning>(response.warnings),
      recentDeletionRequests: asArray<UnknownRecord>(response.recentDeletionRequests).map(toDeletionRequestDoc),
      recentAuditLogs: asArray<UnknownRecord>(response.recentAuditLogs).map(toAuditLogDoc),
      generatedAt: response.generatedAt,
    };
  },

  async upsertCompany(input: UpsertCompanyInput): Promise<{ companyId: string }> {
    if (!isFunctionsReady) {
      const companyId = input.companyId ?? makeLocalId("company");
      const timestamp = nowIso();
      const index = mockCompanies.findIndex((row) => row.id === companyId);

      if (index >= 0) {
        mockCompanies[index] = {
          ...mockCompanies[index],
          name: input.name,
          code: input.code,
          status: input.status ?? mockCompanies[index].status,
          updatedAt: timestamp,
        };
      } else {
        mockCompanies = [
          {
            id: companyId,
            name: input.name,
            code: input.code,
            status: input.status ?? "active",
            ownerUid: "u_super_1",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...mockCompanies,
        ];
      }

      return { companyId };
    }

    return callCallable<UpsertCompanyInput, { companyId: string }>("adminUpsertCompany", input);
  },

  async setCompanyStatus(input: SetCompanyStatusInput): Promise<{ companyId: string; status: CompanyStatus }> {
    if (!isFunctionsReady) {
      const index = mockCompanies.findIndex((row) => row.id === input.companyId);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }

      mockCompanies[index] = {
        ...mockCompanies[index],
        status: input.status,
        updatedAt: nowIso(),
      };

      return { companyId: input.companyId, status: input.status };
    }

    return callCallable<SetCompanyStatusInput, { companyId: string; status: CompanyStatus }>(
      "adminSetCompanyStatus",
      input
    );
  },

  async upsertProject(input: UpsertProjectInput): Promise<{ projectId: string }> {
    if (!isFunctionsReady) {
      const projectId = input.projectId ?? makeLocalId("project");
      const timestamp = nowIso();
      const index = mockProjects.findIndex((row) => row.id === projectId);

      if (index >= 0) {
        mockProjects[index] = {
          ...mockProjects[index],
          companyId: input.companyId,
          name: input.name,
          status: input.status ?? mockProjects[index].status,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          updatedAt: timestamp,
        };
      } else {
        mockProjects = [
          {
            id: projectId,
            companyId: input.companyId,
            name: input.name,
            status: input.status ?? "active",
            startDate: input.startDate ?? null,
            endDate: input.endDate ?? null,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...mockProjects,
        ];
      }

      return { projectId };
    }

    return callCallable<UpsertProjectInput, { projectId: string }>("adminUpsertProject", {
      ...input,
      startDate: input.startDate ?? undefined,
      endDate: input.endDate ?? undefined,
    });
  },

  async archiveProject(input: ArchiveProjectInput): Promise<{ projectId: string; status: ProjectStatus }> {
    if (!isFunctionsReady) {
      const index = mockProjects.findIndex((row) => row.id === input.projectId);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }

      mockProjects[index] = {
        ...mockProjects[index],
        status: "archived",
        updatedAt: nowIso(),
      };

      return { projectId: input.projectId, status: "archived" };
    }

    return callCallable<ArchiveProjectInput, { projectId: string; status: ProjectStatus }>(
      "adminArchiveProject",
      input
    );
  },

  async setUserRole(
    input: SetUserRoleInput
  ): Promise<{ uid: string; role: AppRole; membershipsSynced: number }> {
    if (!isFunctionsReady) {
      const index = mockUsers.findIndex((row) => row.id === input.uid);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }

      if (mockUsers[index].role === "super_admin" && input.role !== "super_admin") {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      mockUsers[index] = {
        ...mockUsers[index],
        role: input.role,
        updatedAt: nowIso(),
      };

      let membershipsSynced = 0;
      if (input.role !== "super_admin") {
        mockMemberships = mockMemberships.map((row) => {
          if (row.uid !== input.uid || row.role === input.role) {
            return row;
          }
          membershipsSynced += 1;
          return {
            ...row,
            role: input.role,
            updatedAt: nowIso(),
          };
        });
      }

      return { uid: input.uid, role: input.role, membershipsSynced };
    }

    return callCallable<SetUserRoleInput, { uid: string; role: AppRole; membershipsSynced: number }>(
      "adminSetUserRole",
      input
    );
  },

  async setUserStatus(input: SetUserStatusInput): Promise<{ uid: string; status: UserStatus }> {
    if (!isFunctionsReady) {
      const index = mockUsers.findIndex((row) => row.id === input.uid);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }

      if (mockUsers[index].role === "super_admin" && mockUsers[index].status !== input.status) {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      mockUsers[index] = {
        ...mockUsers[index],
        status: input.status,
        updatedAt: nowIso(),
      };

      return { uid: input.uid, status: input.status };
    }

    return callCallable<SetUserStatusInput, { uid: string; status: UserStatus }>("adminSetUserStatus", input);
  },

  async deleteOrAnonymizeUser(
    input: DeleteOrAnonymizeUserInput
  ): Promise<{
    uid: string;
    mode: DeleteUserMode;
    userDeleted: boolean;
    authDeleted: boolean;
    membershipsAffected: number;
    deletionRequestsUpdated: number;
  }> {
    if (!isFunctionsReady) {
      const index = mockUsers.findIndex((row) => row.id === input.uid);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }
      if (mockUsers[index].role === "super_admin" || mockUsers[index].superAdminProtected) {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      const mode: DeleteUserMode = input.mode ?? "anonymize";
      const membershipsAffected = mockMemberships.filter((row) => row.uid === input.uid).length;

      if (mode === "hard_delete") {
        mockUsers = mockUsers.filter((row) => row.id !== input.uid);
        mockMemberships = mockMemberships.filter((row) => row.uid !== input.uid);
        return {
          uid: input.uid,
          mode,
          userDeleted: true,
          authDeleted: Boolean(input.deleteAuth ?? true),
          membershipsAffected,
          deletionRequestsUpdated: 0,
        };
      }

      const anonymizedId = `deleted:${input.uid}`;
      mockUsers[index] = {
        ...mockUsers[index],
        role: "worker",
        status: "disabled",
        displayName: "Deleted User",
        email: `${anonymizedId}@deleted.local`,
        phoneNumber: undefined,
        photoUrl: undefined,
        companyIds: [],
        projectIds: [],
        updatedAt: nowIso(),
      };
      mockMemberships = mockMemberships.map((row) =>
        row.uid === input.uid ? { ...row, status: "inactive", updatedAt: nowIso() } : row
      );

      return {
        uid: input.uid,
        mode,
        userDeleted: false,
        authDeleted: Boolean(input.deleteAuth ?? false),
        membershipsAffected,
        deletionRequestsUpdated: 0,
      };
    }

    return callCallable<
      DeleteOrAnonymizeUserInput,
      {
        uid: string;
        mode: DeleteUserMode;
        userDeleted: boolean;
        authDeleted: boolean;
        membershipsAffected: number;
        deletionRequestsUpdated: number;
      }
    >("adminDeleteOrAnonymizeUser", input);
  },

  async reviewDeletionRequest(
    input: ReviewDeletionRequestInput
  ): Promise<{ requestId: string; status: DeletionRequestStatus }> {
    if (!isFunctionsReady) {
      const index = mockDeletionRequests.findIndex((row) => row.id === input.requestId);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }

      if (mockDeletionRequests[index].targetRole === "super_admin") {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      const currentStatus = mockDeletionRequests[index].status;
      if (!canReviewDeletionRequestTransition(currentStatus, input.status)) {
        throw new Error("INVALID_ARGUMENT");
      }

      mockDeletionRequests[index] = {
        ...mockDeletionRequests[index],
        status: input.status,
        reviewComment: input.reviewComment ?? null,
        reviewedBy: "u_super_1",
        reviewedAt: nowIso(),
        updatedAt: nowIso(),
      };

      return { requestId: input.requestId, status: input.status };
    }

    return callCallable<ReviewDeletionRequestInput, { requestId: string; status: DeletionRequestStatus }>(
      "adminReviewDeletionRequest",
      input
    );
  },

  async reviewCompanyApprovalRequest(
    input: ReviewCompanyApprovalRequestInput
  ): Promise<{ requestId: string; status: CompanyApprovalRequestStatus }> {
    if (!isFunctionsReady) {
      const index = mockCompanyApprovalRequests.findIndex((row) => row.id === input.requestId);
      if (index < 0) {
        throw new Error("NOT_FOUND");
      }

      const currentStatus = mockCompanyApprovalRequests[index].status;
      if (input.status === "pending" || !canReviewCompanyApprovalRequestTransition(currentStatus, input.status)) {
        throw new Error("INVALID_ARGUMENT");
      }

      mockCompanyApprovalRequests[index] = {
        ...mockCompanyApprovalRequests[index],
        status: input.status,
        reviewedBy: "u_super_1",
        reviewedAt: nowIso(),
        updatedAt: nowIso(),
      };

      return { requestId: input.requestId, status: input.status };
    }

    return postFunctionJson<
      { requestId: string; action: "approve" | "reject"; rejectReason?: string },
      { requestId: string; status: CompanyApprovalRequestStatus }
    >("reviewCompanyAdminConversionRequest", {
      requestId: input.requestId,
      action: input.status === "approved" ? "approve" : "reject",
      ...(input.status === "rejected" && input.rejectReason?.trim()
        ? { rejectReason: input.rejectReason.trim() }
        : {}),
    });
  },

  async upsertMembership(input: UpsertMembershipInput): Promise<{ membershipId: string }> {
    if (!isFunctionsReady) {
      if (input.role === "super_admin") {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      const membershipId =
        input.membershipId ?? buildMembershipId(input.uid, input.companyId, input.projectId);
      const timestamp = nowIso();
      const index = mockMemberships.findIndex((row) => row.id === membershipId);

      if (index >= 0) {
        if (mockMemberships[index].role === "super_admin") {
          throw new Error("PROTECTED_ROLE_TARGET");
        }

        mockMemberships[index] = {
          ...mockMemberships[index],
          uid: input.uid,
          companyId: input.companyId,
          projectId: input.projectId ?? null,
          role: input.role,
          status: input.status ?? mockMemberships[index].status,
          updatedAt: timestamp,
        };
      } else {
        mockMemberships = [
          {
            id: membershipId,
            uid: input.uid,
            companyId: input.companyId,
            projectId: input.projectId ?? null,
            role: input.role,
            status: input.status ?? "active",
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...mockMemberships,
        ];
      }

      return { membershipId };
    }

    return callCallable<UpsertMembershipInput, { membershipId: string }>("adminUpsertMembership", input);
  },

  async deleteMembership(input: DeleteMembershipInput): Promise<{ membershipId: string; deleted: true }> {
    if (!isFunctionsReady) {
      const target = mockMemberships.find((row) => row.id === input.membershipId);
      if (!target) {
        throw new Error("NOT_FOUND");
      }

      if (target.role === "super_admin") {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      mockMemberships = mockMemberships.filter((row) => row.id !== input.membershipId);
      return { membershipId: input.membershipId, deleted: true };
    }

    return callCallable<DeleteMembershipInput, { membershipId: string; deleted: true }>(
      "adminDeleteMembership",
      input
    );
  },

  async listUsers(query: UsersQuery = {}): Promise<UserDoc[]> {
    if (!isFunctionsReady) {
      let rows = [...mockUsers];
      if (query.role) rows = rows.filter((row) => row.role === query.role);
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      return applyLimit(rows, query.limit);
    }

    const response = await callCallable<UsersQuery, ListResponse<UnknownRecord>>("adminListUsers", query);
    return response.items.map(toUserDoc);
  },

  async listCompanies(query: CompaniesQuery = {}): Promise<CompanyDoc[]> {
    if (!isFunctionsReady) {
      let rows = [...mockCompanies];
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      return applyLimit(rows, query.limit);
    }

    const response = await callCallable<CompaniesQuery, ListResponse<UnknownRecord>>("adminListCompanies", query);
    return response.items.map(toCompanyDoc);
  },

  async listCompanyApprovalRequests(query: CompanyApprovalRequestsQuery = {}): Promise<CompanyApprovalRequestDoc[]> {
    if (!isFunctionsReady) {
      let rows = [...mockCompanyApprovalRequests];
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      rows.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
      return applyLimit(rows, query.limit);
    }

    const response = await postFunctionJson<CompanyApprovalRequestsQuery, ListResponse<UnknownRecord>>(
      "listCompanyAdminConversionRequestsInbox",
      query
    );
    return response.items.map(toCompanyApprovalRequestDoc);
  },

  async listProjects(query: ProjectsQuery = {}): Promise<ProjectDoc[]> {
    if (!isFunctionsReady) {
      let rows = [...mockProjects];
      if (query.companyId) rows = rows.filter((row) => row.companyId === query.companyId);
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      return applyLimit(rows, query.limit);
    }

    const response = await callCallable<ProjectsQuery, ListResponse<UnknownRecord>>("adminListProjects", query);
    return response.items.map(toProjectDoc);
  },

  async listDeletionRequests(query: DeletionRequestsQuery = {}): Promise<DeletionRequestDoc[]> {
    if (!isFunctionsReady) {
      let rows = [...mockDeletionRequests];
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      return applyLimit(rows, query.limit);
    }

    const response = await callCallable<DeletionRequestsQuery, ListResponse<UnknownRecord>>(
      "adminListDeletionRequests",
      query
    );
    return response.items.map(toDeletionRequestDoc);
  },

  async listMemberships(query: MembershipsQuery = {}): Promise<MembershipDoc[]> {
    if (!isFunctionsReady) {
      let rows = [...mockMemberships];
      if (query.uid) rows = rows.filter((row) => row.uid === query.uid);
      if (query.companyId) rows = rows.filter((row) => row.companyId === query.companyId);
      if (query.projectId) rows = rows.filter((row) => row.projectId === query.projectId);
      if (query.role) rows = rows.filter((row) => row.role === query.role);
      if (query.status) rows = rows.filter((row) => row.status === query.status);
      return applyLimit(rows, query.limit);
    }

    const response = await callCallable<MembershipsQuery, ListResponse<UnknownRecord>>(
      "adminListMemberships",
      query
    );
    return response.items.map(toMembershipDoc);
  },

  async listAuditLogs(query: AuditLogsQuery = {}): Promise<AuditLogDoc[]> {
    if (!isFunctionsReady) {
      throw new Error("FUNCTIONS_NOT_CONFIGURED");
    }

    const response = await callCallable<AuditLogsQuery, ListResponse<UnknownRecord>>("adminListAuditLogs", query);
    return response.items.map(toAuditLogDoc);
  },

  async listSystemConfigs(query: SystemConfigsQuery = {}): Promise<SystemConfigDoc[]> {
    if (!isFunctionsReady) {
      throw new Error("FUNCTIONS_NOT_CONFIGURED");
    }

    const response = await callCallable<SystemConfigsQuery, ListResponse<UnknownRecord>>(
      "adminListSystemConfigs",
      query
    );
    return response.items.map(toSystemConfigDoc);
  },

  async upsertSystemConfig(input: UpsertSystemConfigInput): Promise<{ configKey: string; updated: boolean }> {
    if (!isFunctionsReady) {
      throw new Error("FUNCTIONS_NOT_CONFIGURED");
    }
    return callCallable<UpsertSystemConfigInput, { configKey: string; updated: boolean }>(
      "adminUpsertSystemConfig",
      input
    );
  },

  async updateSystemConfig(input: UpdateSystemConfigInput): Promise<{ configKey: string; updated: true }> {
    if (!isFunctionsReady) {
      throw new Error("FUNCTIONS_NOT_CONFIGURED");
    }
    return callCallable<UpdateSystemConfigInput, { configKey: string; updated: true }>(
      "adminUpdateSystemConfig",
      input
    );
  },
};
