# Roadmap

CSV 기반 실행 계획: `/super_admin_firebase_admin_plan.csv`

## 환경 분리 산출물 (순번 2)
- `environment-separation-strategy.md`: dev/stg/prod 분리 전략 본문
- `environment-matrix.csv`: 프로젝트/권한/호스팅/App Check 점검 매트릭스

## 삭제요청 워크플로우 산출물 (순번 9)
- `deletion-request-workflow.md`: 상태 전이/권한/차단 규칙

## 회사 승인 요청 워크플로우 산출물
- `company-approval-request-workflow.md`: 생성 이벤트/상태 전이/권한 기준

## 인증 정책 산출물 (순번 5)
- `../01-rbac/role-model.md`: MFA/도메인/환경 일치 강제 정책

## Admin API 산출물 (순번 10)
- `../03-admin-api/callable-spec.md`: callable 계약 스펙

## 대시보드 산출물 (순번 16)
- `../03-admin-api/callable-spec.md#dashboard`: 대시보드 집계 callable 계약

## 보안 테스트 산출물 (순번 21)
- `../05-quality/security-test-report.md`: 권한 우회/직접 API 호출/규칙 우회 보안 테스트 리포트

## 회귀/E2E 테스트 산출물 (순번 22)
- `../05-quality/regression-e2e-report.md`: 로그인/권한변경/삭제요청 처리 회귀 E2E 리포트

## 모니터링/알람 산출물 (순번 23)
- `../06-ops/monitoring-alert-runbook.md`: 로그 기반 모니터링/알람 런북 및 CI 스모크 점검 기준

## 백업/복구 산출물 (순번 24)
- `../06-ops/firestore-backup-restore-runbook.md`: Firestore export/import 운영 런북
- `../06-ops/firestore-restore-rehearsal-report-2026-03-07.md`: 복구 리허설 실행 증적
