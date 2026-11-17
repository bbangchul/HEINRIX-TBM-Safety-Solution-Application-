# HEINRIX Super Admin Console Workspace

이 폴더는 `HEINRIX` 전용 Firebase 연동 슈퍼관리자 페이지 구축을 위한 독립 워크스페이스입니다.

## 목적
- 기존 공개 사이트(`index.html` 기반)와 관리자 개발 영역을 분리
- 권한/보안 규칙/함수/관리자 UI를 단계적으로 구축
- dev/stg/prod 환경 분리를 전제로 설계

## 상위 구조
- `docs/`: 단계별 설계 문서
- `firebase/`: Firestore Rules/Indexes, Cloud Functions
- `web/`: 슈퍼관리자 웹 앱 소스
- `scripts/`: 운영/배포 보조 스크립트
- `config/`: 환경 설정 템플릿

## 환경 분리(순번 2) 관련 경로
- 전략 문서: `docs/00-roadmap/environment-separation-strategy.md`
- 환경 매트릭스: `docs/00-roadmap/environment-matrix.csv`
- env 템플릿: `config/env/.env.dev.example`, `config/env/.env.stg.example`, `config/env/.env.prod.example`
- Firebase alias/hosting 템플릿: `config/firebase/.firebaserc.example`, `config/firebase/firebase.admin.hosting.example.json`
- 적용 스크립트:
  - `scripts/apply_web_env.sh <dev|stg|prod>`
  - `scripts/setup_hosting_target.sh <dev|stg|prod> <hosting-site-id>`

## 인증 정책(순번 5) 관련 경로
- 정책 문서: `docs/01-rbac/role-model.md`
- 서버 가드: `firebase/functions/src/guards/require-role.ts`
- 웹 가드: `web/src/features/auth/RequireSuperAdmin.tsx`

## Admin API(순번 10) 관련 경로
- callable 스펙: `docs/03-admin-api/callable-spec.md`
- 서버 callable 구현: `firebase/functions/src/modules/*/callables.ts`
- 웹 API 진입점: `web/src/lib/api/admin-api.ts`

## 배포(순번 25) 관련 경로
- Firebase config: `firebase.json`
- Firebase alias/targets: `.firebaserc`
- 함수 환경 파일: `firebase/functions/.env.dev`, `.env.stg`, `.env.prod`
- 배포 스크립트: `scripts/deploy_admin.sh <dev|stg|prod>`
- 스테이징 UAT 체크리스트: `docs/07-release/staging-uat-checklist.md`
