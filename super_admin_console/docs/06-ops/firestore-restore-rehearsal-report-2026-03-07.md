# Firestore Restore Rehearsal Report (2026-03-07)

## Summary
- Result: `SUCCESS`
- Project: `tbm-application-v2`
- Collection: `dr_restore_rehearsal`
- Date (UTC): `2026-03-07`

## Rehearsal Metadata
- Marker: `rehearsal-20260307T085141Z`
- Export output URI:
  - `gs://heinrix-sa24-backup-458920639110-20260307/super_admin_backups/firestore-rehearsal/20260307T085141Z`
- Export operation:
  - `projects/tbm-application-v2/databases/(default)/operations/ASA3NTQzYjlkZjAxNDUtZTE0YS1kYTQ0LWU4YWYtNGE2ZjZmMTAkGnNlbmlsZXBpcAkKMxI`
- Import operation:
  - `projects/tbm-application-v2/databases/(default)/operations/AiAwMjY5ZDk1NzBiYzAtOGVmOS0yM2I0LTI5YTgtYjNlYTNlODkkGnNlbmlsZXBpcAkKMxI`

## Verification Steps
1. Probe doc 생성 및 marker 저장
2. `dr_restore_rehearsal` 컬렉션 export
3. Probe doc 삭제 후 미존재 확인
4. export 산출물 import
5. Probe doc 복구 및 marker 일치 확인
6. Probe doc cleanup

## Issue and Fix During Setup
- Initial attempt failed:
  - `INVALID_ARGUMENT`: bucket location `us-central1` (기존 `tbm-application-v2.firebasestorage.app`)은 Firestore DB 위치와 불일치
- Mitigation:
  - regional backup bucket 생성: `heinrix-sa24-backup-458920639110-20260307` (`ASIA-NORTHEAST3`)
  - Firestore service agent bucket 권한 부여 후 재실행

## Exit Criteria Check (Step 24)
- 복구 리허설 1회 성공: `PASS`
- 백업/복구 런북 작성: `PASS`
- 운영 적용 가능한 스크립트/워크플로우 준비: `PASS`

## Additional Smoke Check
- Date (UTC): `2026-03-07`
- Script: `super_admin_console/scripts/ops/firestore_backup_export.sh`
- Collection scope: `dr_restore_rehearsal`
- Operation:
  - `projects/tbm-application-v2/databases/(default)/operations/ASAzODFjMGRmYjg4OGItYjk4Yi0wNTQ0LTRkMDUtMGE4ZjIxMzUkGnNlbmlsZXBpcAkKMxI`
- Output URI:
  - `gs://heinrix-sa24-backup-458920639110-20260307/super_admin_backups/firestore/20260307T085426Z`
- Result: `SUCCESS`
