# Regression E2E Report (Step 22)

- 기준일: 2026-03-07
- 대상 프로젝트: `tbm-application-v2`
- 테스트 스위트: `e2e_regression_core_flows.cjs`

## 1) 자동화 범위

- 로그인/세션: super_admin + worker 토큰 발급 및 callable 접근 확인
- 권한변경: `adminSetUserRole` 호출 후 `users/memberships` 동기화 확인
- 삭제요청 처리: `createDeletionRequest` 생성 -> `adminReviewDeletionRequest(approved)` -> 목록 반영 확인

## 2) 실행 커맨드

```bash
FIREBASE_API_KEY=<project-browser-key> npm --prefix super_admin_console/firebase/functions run test:regression:e2e
```

## 3) 결과 요약

- 상태: `done`
- 핵심 플로우 자동화(로그인/권한변경/삭제요청): `pass`
- CI 파이프라인 연결: `done`
- 웹 핵심 화면 스모크(UI): `pass` (8/8)
- 회귀 차단 이슈: `0건`

실행 결과:
- 로그인/세션: super_admin + worker 토큰 발급 성공, super_admin callable 접근 성공
- 권한변경: `adminSetUserRole` 이후 `users.role`, `memberships.role` 동기화 확인 (`membershipsSynced: 1`)
- 삭제요청 처리: `requested -> approved` 전이 및 목록 반영 확인

웹 스모크 자동화:
- 테스트 파일: `web/tests/admin-smoke.spec.ts`
- 실행 커맨드: `npm --prefix super_admin_console/web run test:smoke:ui`
- 검증 범위: `/admin` 및 하위 7개 핵심 운영 화면 라우팅/헤더 렌더링
- 로컬 실행 결과: `8 passed (chromium)`

CI 편입:
- 워크플로우: `.github/workflows/super_admin_step22_regression.yml`
- static-guards 단계에 `install-playwright-chromium` + `smoke-ui-web` 추가
