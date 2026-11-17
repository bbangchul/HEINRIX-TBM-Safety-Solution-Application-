import type { AppRole } from "./rbac";

export type UserStatus = "active" | "disabled" | "pending";
export type CompanyStatus = "active" | "inactive";
export type CompanyApprovalRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type ProjectStatus = "active" | "archived";
export type MembershipStatus = "active" | "inactive";
export type DeletionRequestStatus =
  | "requested"
  | "in_review"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled";

export type TimestampLike = unknown;

export interface BaseDoc {
  id: string;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
  createdBy?: string;
  updatedBy?: string;
}

export interface UserDoc extends BaseDoc {
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

export interface CompanyDoc extends BaseDoc {
  name: string;
  code: string;
  status: CompanyStatus;
  ownerUid: string;
}

export interface CompanyApprovalRequestDoc extends BaseDoc {
  companyId: string;
  requesterUid: string;
  requesterEmail?: string | null;
  requesterName?: string | null;
  companyName?: string | null;
  businessRegNoMasked?: string | null;
  bizAddress?: string | null;
  existingCompanyId?: string | null;
  approvedCompanyId?: string | null;
  status: CompanyApprovalRequestStatus;
  reason?: string | null;
  rejectReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: TimestampLike;
  businessLicenseFileName?: string | null;
  businessLicenseDownloadUrl?: string | null;
  submittedAt?: TimestampLike;
}

export interface ProjectDoc extends BaseDoc {
  companyId: string;
  name: string;
  status: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
}

export interface MembershipDoc extends BaseDoc {
  uid: string;
  companyId: string;
  projectId?: string | null;
  role: AppRole;
  status: MembershipStatus;
}

export interface DeletionRequestDoc extends BaseDoc {
  requesterUid: string;
  targetUid: string;
  targetRole: AppRole;
  status: DeletionRequestStatus;
  reason?: string | null;
  reviewComment?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: TimestampLike;
}

export interface AuditLogDoc extends BaseDoc {
  actorUid: string;
  actorRole: AppRole;
  action: string;
  resourceType: string;
  resourceId: string;
  companyId?: string | null;
  projectId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface SystemConfigDoc extends BaseDoc {
  category: string;
  value: unknown;
  description?: string;
}
