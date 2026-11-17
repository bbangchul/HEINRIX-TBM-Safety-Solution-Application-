# Firestore Collection Schema (Step 1)

## 공통 메타 필드
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `createdBy` (uid)
- `updatedBy` (uid)

## users/{uid}
- `role`: super_admin | company_admin | project_admin | worker
- `status`: active | disabled | pending
- `email`, `displayName`, `phoneNumber`, `photoUrl`
- `companyIds`: string[]
- `projectIds`: string[]
- `superAdminProtected`: boolean
- `notificationSettings`: 알림 권한/채널 설정
- `fcmTokens`: 웹/앱 푸시 토큰 목록(최대 10)
- 공통 메타 필드

## companies/{companyId}
- `name`, `code`, `status`
- `ownerUid`
- 공통 메타 필드

## companyApprovalRequests/{requestId}
- 생성 이벤트: 회사 가입 신청 완료 직후 생성
- `companyId`, `requesterUid`
- `status`: requested | approved | rejected | cancelled
- `reason`, `reviewedBy`, `reviewedAt`
- 공통 메타 필드

상태 전이 규칙:
- requested -> approved | rejected | cancelled
- approved/rejected/cancelled -> 종료(추가 전이 불가)

## projects/{projectId}
- `companyId`, `name`, `status`
- `startDate`, `endDate`
- 공통 메타 필드

## memberships/{membershipId}
- `uid`, `companyId`, `projectId`
- `role`, `status`
- 공통 메타 필드

## deletionRequests/{requestId}
- `requesterUid`, `targetUid`, `targetRole`
- `status`: requested | in_review | approved | rejected | completed | cancelled
- `reason`, `reviewComment`, `reviewedBy`, `reviewedAt`
- 공통 메타 필드

상태 전이 규칙:
- requested -> in_review | approved | rejected | cancelled
- in_review -> approved | rejected | cancelled
- approved -> completed | cancelled
- rejected/completed/cancelled -> 종료(추가 전이 불가)

## auditLogs/{logId}
- `actorUid`, `actorRole`, `action`
- `resourceType`, `resourceId`
- `companyId`, `projectId`
- `before`, `after`, `metadata`
- `createdAt`

## systemConfigs/{configKey}
- `category`, `value`, `description`
- `updatedAt`, `updatedBy`
