import type { AppRole, UserStatus } from "./roles";

export type TimestampLike = unknown;

export interface AuditMeta {
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  createdBy: string;
  updatedBy: string;
}

export interface UserDocument extends AuditMeta {
  role: AppRole;
  status: UserStatus;
  email: string;
  displayName: string;
  phoneNumber?: string;
  photoUrl?: string;
  companyIds: string[];
  projectIds: string[];
  superAdminProtected: boolean;
  notificationSettings?: Record<string, unknown>;
  fcmTokens?: string[];
}

export interface CompanyDocument extends AuditMeta {
  name: string;
  code: string;
  status: "active" | "inactive";
  ownerUid: string;
}

export const COMPANY_APPROVAL_REQUEST_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type CompanyApprovalRequestStatus = (typeof COMPANY_APPROVAL_REQUEST_STATUSES)[number];

export interface CompanyApprovalRequestDocument extends AuditMeta {
  companyId: string;
  requesterUid: string;
  status: CompanyApprovalRequestStatus;
  reason?: string;
  reviewedBy?: string;
  reviewedAt?: TimestampLike;
}

export interface ProjectDocument extends AuditMeta {
  companyId: string;
  name: string;
  status: "active" | "archived";
  startDate?: string;
  endDate?: string;
}

export interface MembershipDocument extends AuditMeta {
  uid: string;
  companyId: string;
  projectId?: string;
  role: AppRole;
  status: "active" | "inactive";
}

export const DELETION_REQUEST_STATUSES = [
  "requested",
  "in_review",
  "approved",
  "rejected",
  "completed",
  "cancelled",
] as const;

export type DeletionRequestStatus = (typeof DELETION_REQUEST_STATUSES)[number];

export interface DeletionRequestDocument extends AuditMeta {
  requesterUid: string;
  targetUid: string;
  targetRole: AppRole;
  status: DeletionRequestStatus;
  reason?: string;
  reviewComment?: string;
  reviewedBy?: string;
  reviewedAt?: TimestampLike;
}

export interface AuditLogDocument {
  actorUid: string;
  actorRole: AppRole;
  action: string;
  resourceType: string;
  resourceId: string;
  companyId?: string;
  projectId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: TimestampLike;
}

export interface SystemConfigDocument {
  category: string;
  value: unknown;
  description?: string;
  updatedAt: TimestampLike;
  updatedBy: string;
}

export interface CollectionSchemaMap {
  users: UserDocument;
  companies: CompanyDocument;
  companyApprovalRequests: CompanyApprovalRequestDocument;
  projects: ProjectDocument;
  memberships: MembershipDocument;
  deletionRequests: DeletionRequestDocument;
  auditLogs: AuditLogDocument;
  systemConfigs: SystemConfigDocument;
}
