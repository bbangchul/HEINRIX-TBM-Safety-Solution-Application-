# Super Admin Web

HEINRIX Firebase 기반 슈퍼관리자 콘솔 프론트엔드 워크스페이스입니다.

## Step 3 Scaffolding (Generated)
- React + Vite + TypeScript 기본 구조
- `react-router-dom` 기반 `/admin/*` 라우팅
- 인증 상태 컨텍스트(`AuthProvider`)
- `super_admin` + `mfaVerified` + 허용 도메인 + 허용 환경 가드(`RequireSuperAdmin`)
- 로그인/권한없음/MFA필요/404 페이지
- 관리자 레이아웃(사이드바 + 상단 사용자정보/로그아웃)
- Functions callable API 클라이언트 레이어(`src/lib/api`)
- 페이지별 필터 + 목록/테이블 컴포넌트 스캐폴딩
- `auditLogs`, `systemConfigs`는 callable 실데이터 전용 (mock fallback 없음)

## Step 4 Actions (Current)
- 대시보드: 요약 집계 + 최근 이벤트/삭제요청 → `adminGetDashboardOverview`
- 회사: 생성/수정/비활성(삭제 대체) 버튼 → `adminUpsertCompany`, `adminSetCompanyStatus`
- 프로젝트: 생성/수정/삭제(archived) 버튼 → `adminUpsertProject`, `adminArchiveProject`
- 사용자: 역할변경/상태변경/비활성(삭제 대체) 버튼 → `adminSetUserRole`, `adminSetUserStatus`
- 멤버십: 생성/수정/삭제 버튼 → `adminUpsertMembership`, `adminDeleteMembership`
- 삭제요청: 승인/반려/처리완료 버튼 → `adminReviewDeletionRequest`
- `super_admin` 보호 규칙은 서버 callable에서 강제되며, 클라이언트에서도 주요 액션을 선차단

## 주요 경로
- `/auth/login`
- `/auth/forbidden`
- `/auth/mfa-required`
- `/admin`
- `/admin/companies`
- `/admin/projects`
- `/admin/memberships`
- `/admin/users`
- `/admin/deletion-requests`
- `/admin/audit-logs`
- `/admin/system-configs`

## 실행 방법
1. 상위 폴더에서 환경 선택:
   - `./scripts/apply_web_env.sh dev`
   - `./scripts/apply_web_env.sh stg`
   - `./scripts/apply_web_env.sh prod`
2. 생성된 `web/.env`에 실제 Firebase 값(API Key/App ID 등) 입력
   - `VITE_SUPER_ADMIN_ALLOWED_DOMAINS` 설정(기본: `heinrix.com`)
   - `VITE_APP_ENV` 설정(`dev|stg|prod`)
   - (선택) `VITE_SUPER_ADMIN_ALLOWED_ENVIRONMENTS` 설정(미설정 시 `VITE_APP_ENV` 단일값)
   - 웹 백그라운드 푸시용 `VITE_FIREBASE_VAPID_KEY` 설정
3. `npm install`
4. `npm run dev`
5. 정책 검증(선택): `npm run verify:callable-only`
6. UI 스모크(Step 22): `npm run test:smoke:ui`

## 참고
- Firebase 환경변수가 비어 있으면 로그인 버튼이 비활성화됩니다.
- Functions 미연결 시 대부분의 페이지는 `mock` 데이터를 사용하며, `auditLogs`/`systemConfigs`는 에러를 표시합니다.
- 실시간 알림/백그라운드 푸시는 Firestore read 구독 + FCM을 함께 사용합니다.
- Step 4 기준 주요 액션(Create/Update/Delete)은 callable과 연결되어 있으며, 고급 폼/상세 모달 UX는 다음 단계에서 확장 가능합니다.
- UI 스모크는 `VITE_E2E_BYPASS_AUTH=true`로 인증 가드를 테스트 전용으로 우회하여 핵심 `/admin/*` 화면 렌더링을 검증합니다.
