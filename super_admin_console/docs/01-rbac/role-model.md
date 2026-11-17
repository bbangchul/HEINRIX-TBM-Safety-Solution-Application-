# HEINRIX Super Admin RBAC Model (Step 1)

## 1) 역할 정의
- `super_admin`: 전체 시스템 관리, 정책/권한/삭제요청 최종 처리
- `company_admin`: 특정 회사 범위 운영 관리
- `project_admin`: 특정 프로젝트 범위 운영 관리
- `worker`: 일반 사용자

## 2) 핵심 정책
- `super_admin` 계정은 삭제 및 강등 금지
- 관리자 페이지(`super_admin_console/web`)는 `super_admin`만 진입 허용
- 민감 데이터 변경은 Cloud Functions를 통해서만 수행(클라이언트 직접 쓰기 제한)

## 3) Firebase Auth Custom Claims 초안
```json
{
  "role": "super_admin",
  "companyIds": ["company_a"],
  "projectIds": ["project_x"],
  "mfaVerified": true,
  "environment": "prod"
}
```

## 4) 권한 기본 원칙
- 읽기 권한은 최소 범위 허용
- 쓰기 권한은 더 좁게 제한
- `users`, `memberships`, `deletionRequests`는 별도 보호 규칙 적용

## 5) 인증 정책 (순번 5)
- `super_admin` 접근 전 아래 4가지 모두 강제:
  - role = `super_admin`
  - MFA 확인(`mfaVerified` 커스텀 클레임 또는 Firebase second factor sign-in)
  - 허용 이메일 도메인 일치
  - 토큰 환경(`claims.environment`)과 런타임 환경 일치
- Functions 정책 환경변수:
  - `SUPER_ADMIN_ALLOWED_EMAILS` (선택, 설정 시 정확한 이메일 allowlist 우선 적용)
  - `SUPER_ADMIN_ALLOWED_EMAIL_DOMAINS` (기본값: `heinrix.com`)
  - `APP_ENV` (기본값: `dev`)
  - `SUPER_ADMIN_ALLOWED_ENVIRONMENTS` (미설정 시 `APP_ENV` 단일값 사용)
- Web 정책 환경변수:
  - `VITE_SUPER_ADMIN_ALLOWED_EMAILS` (선택, 설정 시 정확한 이메일 allowlist 우선 적용)
  - `VITE_SUPER_ADMIN_ALLOWED_DOMAINS` (기본값: `heinrix.com`)
  - `VITE_APP_ENV` (기본값: `dev`)
  - `VITE_SUPER_ADMIN_ALLOWED_ENVIRONMENTS` (미설정 시 `VITE_APP_ENV` 단일값 사용)

## 6) Step 5 검증 기준
- 서버: `withSuperAdminCallable` 진입 시 role/MFA/domain/environment 불일치 각각 `permission-denied` 반환
- 웹: `RequireSuperAdmin`에서 role/domain/environment 불일치시 `/auth/forbidden`, MFA 미충족시 `/auth/mfa-required`
- 상태: `done` (기준일 2026-03-06)
