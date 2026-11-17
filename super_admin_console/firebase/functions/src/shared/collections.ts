export const COLLECTIONS = {
  users: "users",
  companies: "companies",
  companyApprovalRequests: "companyApprovalRequests",
  projects: "projects",
  memberships: "memberships",
  deletionRequests: "deletionRequests",
  auditLogs: "auditLogs",
  systemConfigs: "systemConfigs",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];
