# Cloud Functions Workspace

구현 예정:
- auth claims 검증
- super_admin guard
- users/companies/projects/deletionRequests/auditLogs 모듈

## Step 2 Skeleton (Generated)
- `src/modules/users/callables.ts`
- `src/modules/companies/callables.ts`
- `src/modules/projects/callables.ts`
- `src/modules/deletionRequests/callables.ts`
- `src/modules/memberships/callables.ts`
- `src/modules/dashboard/callables.ts`

## Added in This Step
- `src/modules/auditLogs/callables.ts`
  - `adminListAuditLogs`
- `src/modules/systemConfigs/callables.ts`
  - `adminListSystemConfigs`
  - `adminUpsertSystemConfig`
  - `adminUpdateSystemConfig`
- `src/modules/users/callables.ts`
  - `adminDeleteOrAnonymizeUser` (mode: `anonymize` | `hard_delete`)

공통 유틸:
- `src/shared/callable.ts` (authenticated/super_admin callable wrapper)
- `src/shared/firebase-admin.ts` (admin app bootstrap)
- `src/shared/input.ts` (payload parsing helper)
- `src/shared/audit-logs.ts` (audit log write helper)

감사로그 적용:
- 회사/프로젝트/사용자/멤버십/삭제요청/운영설정 mutation은 `auditLogs` 기록
- `adminSetUserRole`는 사용자 role 변경 시 `memberships.role` 동기화 수행

Entry:
- `src/index.ts` exports all callable functions.

검증:
- `npm run verify:admin-api-layer`
- `npm run verify:security-controls`
- `FIREBASE_API_KEY=... npm run test:security:e2e`
- `FIREBASE_API_KEY=... npm run test:regression:e2e`

## Auth Policy (Step 5)
- `withSuperAdminCallable`는 서버에서 아래를 모두 강제:
  - super_admin role
  - MFA verified claim/second factor sign-in
  - allowed email domain
  - token environment(claim.environment) match
- 환경변수:
  - `SUPER_ADMIN_ALLOWED_EMAIL_DOMAINS` (comma-separated, default: `heinrix.com`)
  - `APP_ENV` (default: `dev`)
  - `SUPER_ADMIN_ALLOWED_ENVIRONMENTS` (optional, comma-separated; fallback: `APP_ENV`)
