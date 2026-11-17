# 환경 분리 전략 (Step 0-2)

기준일: 2026-03-06

## 1. 현재 상태(마감 기준)
- `super_admin_console`는 dev/stg/prod 3개 환경 분리 기준으로 운영한다.
- 환경별 project/hosting target/admin URL 표준을 확정했다.
- 인증 정책은 환경별 토큰 분리(`claims.environment`)까지 포함해 강제한다.

## 2. 목표 아키텍처(dev/stg/prod)

| 환경 | Firebase Project ID(표준) | 관리자 URL(표준) | Hosting Target | 상태 |
|---|---|---|---|---|
| dev | `heinrix-super-admin-dev` | `https://admin-dev.heinrix.com` | `admin_dev` | 표준 확정 |
| stg | `heinrix-super-admin-stg` | `https://admin-stg.heinrix.com` | `admin_stg` | 표준 확정 |
| prod | `tbm-application-v2`(유지) | `https://admin.heinrix.com` | `admin_prod` -> site `tbm-application-v2-admin` | 표준 확정 |

## 3. 네이밍 규칙
- Firebase project: `heinrix-super-admin-{env}` (`env` = `dev|stg|prod`)
- Hosting target: `admin_{env}`
- 웹 환경 변수: `VITE_*` 접두어 사용
- 공통 환경 변수: `APP_ENV`, `FIREBASE_PROJECT_ID`, `FIREBASE_FUNCTIONS_REGION`
- 서비스 계정:
  - 배포용: `sa-super-admin-deployer@{project-id}.iam.gserviceaccount.com`
  - 함수 런타임: `sa-super-admin-functions@{project-id}.iam.gserviceaccount.com` (또는 기본 compute SA 명시)

## 4. App Check 분리 원칙
- 각 환경별 독립 Site Key 사용(공유 금지).
- reCAPTCHA Enterprise/Web provider를 환경별로 분리.
- `VITE_FIREBASE_APP_CHECK_SITE_KEY` 값을 환경 파일에서 분리 관리.

## 4-1. 인증 정책 연계(환경 분리 강제)
- Functions: `APP_ENV` + `SUPER_ADMIN_ALLOWED_ENVIRONMENTS`로 runtime 환경 일치 강제
- Web: `VITE_APP_ENV` + `VITE_SUPER_ADMIN_ALLOWED_ENVIRONMENTS`로 클라이언트 가드 일치 강제
- 기본값은 단일 환경 허용(`APP_ENV`, `VITE_APP_ENV`)

## 5. 환경 파일 운영 방식
- 템플릿 위치:
  - `config/env/.env.dev.example`
  - `config/env/.env.stg.example`
  - `config/env/.env.prod.example`
- 적용 스크립트:
  - `scripts/apply_web_env.sh dev|stg|prod`
  - 선택한 템플릿을 `web/.env`로 복사.

## 6. Firebase alias/target 표준
- 템플릿:
  - `config/firebase/.firebaserc.example`
- 적용 예시:
```bash
# 프로젝트 alias 연결
firebase use dev
firebase use stg
firebase use prod

# Hosting target 연결 (프로젝트별 1회)
firebase target:apply hosting admin_dev heinrix-super-admin-dev --project dev
firebase target:apply hosting admin_stg heinrix-super-admin-stg --project stg
firebase target:apply hosting admin_prod tbm-application-v2-admin --project prod
```

## 7. 환경별 URL 정책
- dev: `admin-dev.heinrix.com` (내부 QA/개발자 전용)
- stg: `admin-stg.heinrix.com` (UAT/릴리즈 검증)
- prod: `admin.heinrix.com` (운영)

## 8. 완료 기준 체크리스트(순번 2)
- [x] dev/stg/prod 분리 규칙 문서화
- [x] 프로젝트/서비스계정/App Check/Hosting target 항목 정의
- [x] 환경별 URL 정책 정의
- [x] 3개 환경 프로젝트/접근권한 점검 매트릭스 정리
- [x] Hosting target 표준 및 적용 절차 확정

현재 단계 판단: `done`
