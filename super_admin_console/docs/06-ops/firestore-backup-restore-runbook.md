# Firestore Backup/Restore Runbook

## Scope
- Target project: `tbm-application-v2`
- Backup bucket: `gs://heinrix-sa24-backup-458920639110-20260307`
- Backup prefix: `super_admin_backups/firestore`
- Rehearsal collection: `dr_restore_rehearsal`

## Pre-check
1. `gcloud auth list` 에서 운영용 서비스 계정/사용자 인증 상태 확인
2. Firestore 서비스 에이전트 IAM 확인
3. 버킷 리전이 Firestore DB 리전(`asia-northeast3`/`asia`)과 호환되는지 확인

## Daily Backup (Automated)
- Workflow: `.github/workflows/super_admin_firestore_backup_daily.yml`
- Schedule: `0 18 * * *` (UTC, KST 03:00)
- Required secret: `SUPER_ADMIN_GCP_SA_KEY_JSON`
- Optional vars:
  - `SUPER_ADMIN_PROJECT_ID`
  - `SUPER_ADMIN_BACKUP_BUCKET`
  - `SUPER_ADMIN_BACKUP_PREFIX`

## Manual Backup
```bash
bash super_admin_console/scripts/ops/firestore_backup_export.sh \
  tbm-application-v2 \
  heinrix-sa24-backup-458920639110-20260307
```

Collection scoped export:
```bash
BACKUP_COLLECTION_IDS=dr_restore_rehearsal \
bash super_admin_console/scripts/ops/firestore_backup_export.sh \
  tbm-application-v2 \
  heinrix-sa24-backup-458920639110-20260307
```

## Restore Rehearsal
```bash
bash super_admin_console/scripts/ops/firestore_restore_rehearsal.sh \
  tbm-application-v2 \
  heinrix-sa24-backup-458920639110-20260307
```

Script behavior:
1. Probe 문서 생성
2. 컬렉션 단위 export
3. Probe 문서 삭제
4. export 산출물 import
5. marker 일치 검증
6. Probe 문서 정리

## Real Incident Restore (Operator Procedure)
1. 장애 범위 확정(전체/컬렉션/문서 범위)
2. 복구 기준 시점 백업 선택(`output_uri`)
3. 변경 동결 공지 및 관리자 작업 일시 중단
4. Firestore import 실행
5. 데이터 정합성 쿼리 검증
6. 관리자 콘솔 기능 스모크 테스트
7. 운영 재개 및 사후 리포트 작성

## Verification Checklist
- Export/Import operation `done=true`
- `error.message` 비어 있음
- 리허설 marker 검증 성공
- 감사로그/운영설정/삭제요청 핵심 조회 정상

## Failure Guide
- `INVALID_ARGUMENT` + bucket location mismatch:
  - Firestore 리전 호환 버킷으로 변경 후 재시도
- `PERMISSION_DENIED`:
  - Firestore 서비스 에이전트에 버킷 권한(`roles/storage.admin` 또는 최소 권한 조합) 재부여
- Timeout:
  - `BACKUP_TIMEOUT_SECONDS` 증가 후 재시도, Cloud Logging에서 operation 지연 원인 확인
