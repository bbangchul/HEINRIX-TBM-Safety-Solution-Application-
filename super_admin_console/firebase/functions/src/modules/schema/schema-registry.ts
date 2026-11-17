import { COLLECTIONS, type CollectionName } from "../../shared/collections";

export type FieldType =
  | "string"
  | "boolean"
  | "number"
  | "timestamp"
  | "array"
  | "object"
  | "any";

export interface FieldRule {
  type: FieldType;
  required: boolean;
  enum?: readonly string[];
  description?: string;
}

export interface CollectionSchemaDefinition {
  collection: CollectionName;
  protectedFromClientDelete?: boolean;
  fields: Record<string, FieldRule>;
}

export const COLLECTION_SCHEMA_REGISTRY: Record<CollectionName, CollectionSchemaDefinition> = {
  [COLLECTIONS.users]: {
    collection: COLLECTIONS.users,
    protectedFromClientDelete: true,
    fields: {
      role: { type: "string", required: true, enum: ["super_admin", "company_admin", "project_admin", "worker"] },
      status: { type: "string", required: true, enum: ["active", "disabled", "pending"] },
      email: { type: "string", required: true },
      displayName: { type: "string", required: true },
      companyIds: { type: "array", required: true },
      projectIds: { type: "array", required: true },
      superAdminProtected: { type: "boolean", required: true },
      notificationSettings: { type: "object", required: false },
      fcmTokens: { type: "array", required: false },
      createdAt: { type: "timestamp", required: true },
      updatedAt: { type: "timestamp", required: true },
      createdBy: { type: "string", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
  [COLLECTIONS.companies]: {
    collection: COLLECTIONS.companies,
    fields: {
      name: { type: "string", required: true },
      code: { type: "string", required: true },
      status: { type: "string", required: true, enum: ["active", "inactive"] },
      ownerUid: { type: "string", required: true },
      createdAt: { type: "timestamp", required: true },
      updatedAt: { type: "timestamp", required: true },
      createdBy: { type: "string", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
  [COLLECTIONS.companyApprovalRequests]: {
    collection: COLLECTIONS.companyApprovalRequests,
    protectedFromClientDelete: true,
    fields: {
      companyId: { type: "string", required: true },
      requesterUid: { type: "string", required: true },
      status: {
        type: "string",
        required: true,
        enum: ["requested", "approved", "rejected", "cancelled"],
      },
      reason: { type: "string", required: false },
      reviewedBy: { type: "string", required: false },
      reviewedAt: { type: "timestamp", required: false },
      createdAt: { type: "timestamp", required: true },
      updatedAt: { type: "timestamp", required: true },
      createdBy: { type: "string", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
  [COLLECTIONS.projects]: {
    collection: COLLECTIONS.projects,
    fields: {
      companyId: { type: "string", required: true },
      name: { type: "string", required: true },
      status: { type: "string", required: true, enum: ["active", "archived"] },
      createdAt: { type: "timestamp", required: true },
      updatedAt: { type: "timestamp", required: true },
      createdBy: { type: "string", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
  [COLLECTIONS.memberships]: {
    collection: COLLECTIONS.memberships,
    fields: {
      uid: { type: "string", required: true },
      companyId: { type: "string", required: true },
      projectId: { type: "string", required: false },
      role: { type: "string", required: true, enum: ["super_admin", "company_admin", "project_admin", "worker"] },
      status: { type: "string", required: true, enum: ["active", "inactive"] },
      createdAt: { type: "timestamp", required: true },
      updatedAt: { type: "timestamp", required: true },
      createdBy: { type: "string", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
  [COLLECTIONS.deletionRequests]: {
    collection: COLLECTIONS.deletionRequests,
    protectedFromClientDelete: true,
    fields: {
      requesterUid: { type: "string", required: true },
      targetUid: { type: "string", required: true },
      targetRole: { type: "string", required: true, enum: ["super_admin", "company_admin", "project_admin", "worker"] },
      status: {
        type: "string",
        required: true,
        enum: ["requested", "in_review", "approved", "rejected", "completed", "cancelled"],
      },
      reason: { type: "string", required: false },
      reviewComment: { type: "string", required: false },
      reviewedBy: { type: "string", required: false },
      reviewedAt: { type: "timestamp", required: false },
      createdAt: { type: "timestamp", required: true },
      updatedAt: { type: "timestamp", required: true },
      createdBy: { type: "string", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
  [COLLECTIONS.auditLogs]: {
    collection: COLLECTIONS.auditLogs,
    fields: {
      actorUid: { type: "string", required: true },
      actorRole: { type: "string", required: true, enum: ["super_admin", "company_admin", "project_admin", "worker"] },
      action: { type: "string", required: true },
      resourceType: { type: "string", required: true },
      resourceId: { type: "string", required: true },
      createdAt: { type: "timestamp", required: true },
      metadata: { type: "object", required: false },
    },
  },
  [COLLECTIONS.systemConfigs]: {
    collection: COLLECTIONS.systemConfigs,
    fields: {
      category: { type: "string", required: true },
      value: { type: "any", required: true },
      description: { type: "string", required: false },
      updatedAt: { type: "timestamp", required: true },
      updatedBy: { type: "string", required: true },
    },
  },
};
