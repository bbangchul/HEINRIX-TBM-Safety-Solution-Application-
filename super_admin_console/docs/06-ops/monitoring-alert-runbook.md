# Monitoring & Alert Runbook (Step 23)

- 기준일: 2026-03-07
- 상태: `done`
- 대상 프로젝트(기본): `tbm-application-v2`

## 1) 목표

- Super Admin callable 함수의 오류율/실패 급증을 조기 탐지한다.
- 권한 우회 시도(unauthenticated/permission-denied) 이상 징후를 감지한다.
- 치명 액션(`adminDeleteOrAnonymizeUser`) 실패를 즉시 감지한다.

## 2) 운영 신호(1차)

- `admin.*` 함수 로그 중 `severity>=ERROR` 건수
- `permission-denied` 패턴 로그 건수
- `unauthenticated` 패턴 로그 건수
- `adminDeleteOrAnonymizeUser` 오류 로그 건수

참고:
- Functions v2 리소스: `cloud_run_revision`
- Functions v1 호환 리소스: `cloud_function`

## 3) 자동 점검 스크립트

파일: `super_admin_console/scripts/ops/monitoring_smoke_check.sh`

실행 예시:

```bash
bash super_admin_console/scripts/ops/monitoring_smoke_check.sh tbm-application-v2
```

임계치(보정 완료, 환경변수로 조정):

- `ERROR_MAX=3`
- `PERMISSION_DENIED_MAX=12`
- `UNAUTH_MAX=8`
- `DELETE_ERROR_MAX=0`

## 4) CI 스케줄 실행

워크플로우: `.github/workflows/super_admin_monitoring_smoke.yml`

- 주기: 30분(`*/30 * * * *`)
- 수동 실행: `workflow_dispatch`
- 필수 시크릿: `SUPER_ADMIN_GCP_SA_KEY_JSON`
- 권장 vars:
  - `SUPER_ADMIN_PROJECT_ID`
  - `SUPER_ADMIN_ALERT_ERROR_MAX`
  - `SUPER_ADMIN_ALERT_PERMISSION_DENIED_MAX`
  - `SUPER_ADMIN_ALERT_UNAUTH_MAX`
  - `SUPER_ADMIN_ALERT_DELETE_ERROR_MAX`

## 5) 알람 정책 적용 결과

적용 스크립트:
- `super_admin_console/scripts/ops/apply_monitoring_alerts.sh`

생성/갱신된 로그 기반 메트릭:
- `sa_admin_errors_total`
- `sa_admin_permission_denied_total`
- `sa_admin_unauth_total`
- `sa_admin_delete_user_error_total`

연결된 알림 채널:
- `projects/tbm-application-v2/notificationChannels/16663181790295399252`
- 타입: `email`
- 수신 주소: `bangsc02@gmail.com`
- 표시명: `SA023 Super Admin Oncall Email`

생성된 Alert Policy:
- `SA023 super_admin_error_spike`
- `SA023 super_admin_permission_denied_spike`
- `SA023 super_admin_unauthenticated_spike`
- `SA023 super_admin_delete_user_error_any`

운영 검증:
- 수동 모니터링 스모크 실행: `super-admin-monitoring-smoke`
- 최근 성공 실행 ID: `22795467616`
- 최근 30분 기준 카운트: error=0, permission_denied=0, unauth=0, delete_user_error=0

## 6) 장애 대응 기본 절차

1. 알람 수신 후 최근 30분 로그 확인
2. 영향 함수/엔드포인트 식별
3. 직전 배포(Functions/Hosting) 변경점 대조
4. 임시 완화(기능 플래그/권한 제한) 적용
5. 사후 원인 분석 및 재발 방지 액션 등록
