# Callable Spec

기준일: 2026-03-06

## 공통 정책
- 인증 필요 callable: `withAuthenticatedCallable`
- super admin 전용 callable: `withSuperAdminCallable`
- super admin 검증 항목:
  - `role = super_admin`
  - `mfaVerified = true` 또는 second factor sign-in
  - 허용 이메일 도메인 일치
  - 허용 환경(claim.environment) 일치
- 공통 에러 매핑:
  - `INVALID_ARGUMENT` -> `invalid-argument`
  - `PERMISSION_DENIED`, `SUPER_ADMIN_*` -> `permission-denied`
  - `PROTECTED_ROLE_TARGET` -> `failed-precondition`
  - `NOT_FOUND` -> `not-found`

## Users
- `adminListUsers` (super_admin)
  - request: `{ limit?, role?, status? }`
  - response: `{ items: User[] }`
- `adminGetUser` (super_admin)
  - request: `{ uid }`
  - response: `{ user }`
- `adminSetUserRole` (super_admin)
  - request: `{ uid, role }`
  - response: `{ uid, role, membershipsSynced }`
- `adminSetUserStatus` (super_admin)
  - request: `{ uid, status }`
  - response: `{ uid, status }`
- `adminDeleteOrAnonymizeUser` (super_admin)
  - request: `{ uid, mode?, deleteAuth?, reason? }`
  - response: `{ uid, mode, userDeleted, authDeleted, membershipsAffected, deletionRequestsUpdated }`

## Companies / Projects
- `adminListCompanies` (super_admin)
  - request: `{ limit?, status? }`
  - response: `{ items: Company[] }`
- `adminUpsertCompany` (super_admin)
  - request: `{ companyId?, name, code, status? }`
  - response: `{ companyId }`
- `adminSetCompanyStatus` (super_admin)
  - request: `{ companyId, status }`
  - response: `{ companyId, status }`
- `adminListProjects` (super_admin)
  - request: `{ limit?, companyId?, status? }`
  - response: `{ items: Project[] }`
- `adminUpsertProject` (super_admin)
  - request: `{ projectId?, companyId, name, status?, startDate?, endDate? }`
  - response: `{ projectId }`
- `adminArchiveProject` (super_admin)
  - request: `{ projectId }`
  - response: `{ projectId, status: "archived" }`

## Company Approval Requests
- `createCompanyApprovalRequest` (authenticated)
  - request: `{ companyId, requesterUid, reason? }`
  - response: `{ requestId, status: "requested" }`
  - constraints:
    - `requesterUid` must equal authenticated uid
    - `super_admin` cannot create
    - target company must exist and `ownerUid` must equal authenticated uid
    - duplicate `requested` request for the same company is blocked
- `adminListCompanyApprovalRequests` (super_admin)
  - request: `{ limit?, status? }`
  - response: `{ items: CompanyApprovalRequest[] }`
- `adminReviewCompanyApprovalRequest` (super_admin)
  - request: `{ requestId, status }`
  - response: `{ requestId, status }`
  - constraints:
    - allowed transitions: `requested -> approved | rejected | cancelled`
    - `status = requested` is not allowed in review action

## Notifications
- `registerWebPushToken` (authenticated)
  - request: `{ token, permission? }`
  - response: `{ updated: true, tokensCount }`
- `unregisterWebPushToken` (authenticated)
  - request: `{ token, permission? }`
  - response: `{ updated: true, tokensCount }`

## Memberships
- `adminListMemberships` (super_admin)
  - request: `{ limit?, uid?, companyId?, projectId?, role?, status? }`
  - response: `{ items: Membership[] }`
- `adminUpsertMembership` (super_admin)
  - request: `{ membershipId?, uid, companyId, projectId?, role, status? }`
  - response: `{ membershipId }`
- `adminDeleteMembership` (super_admin)
  - request: `{ membershipId }`
  - response: `{ membershipId, deleted: true }`

## Deletion Requests
- `createDeletionRequest` (authenticated)
  - request: `{ targetUid, targetRole, reason? }`
  - response: `{ requestId, status: "requested" }`
- `adminListDeletionRequests` (super_admin)
  - request: `{ limit?, status? }`
  - response: `{ items: DeletionRequest[] }`
- `adminReviewDeletionRequest` (super_admin)
  - request: `{ requestId, status, reviewComment? }`
  - response: `{ requestId, status }`
- `cancelDeletionRequest` (authenticated requester only)
  - request: `{ requestId }`
  - response: `{ requestId, status: "cancelled" }`

## Audit Logs / System Configs
- `adminListAuditLogs` (super_admin)
  - request: `{ limit?, actorUid?, actorRole?, action?, resourceType?, resourceId?, keyword?, dateFrom?, dateTo? }`
  - response: `{ items: AuditLog[] }`
- `adminListSystemConfigs` (super_admin)
  - request: `{ limit?, category?, keyword? }`
  - response: `{ items: SystemConfig[] }`
- `adminUpsertSystemConfig` (super_admin)
  - request: `{ configKey, category, value, description? }`
  - response: `{ configKey, updated }`
- `adminUpdateSystemConfig` (super_admin)
  - request: `{ configKey, category?, value?, description? }`
  - response: `{ configKey, updated: true }`

## Dashboard
- `adminGetDashboardOverview` (super_admin)
  - request: `{ recentLimit? }`
  - response: `{ kpi, warnings, recentDeletionRequests, recentAuditLogs, generatedAt }`
