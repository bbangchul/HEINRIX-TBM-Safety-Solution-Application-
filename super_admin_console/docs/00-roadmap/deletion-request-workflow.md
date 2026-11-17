# 삭제요청 워크플로우 (순번 9)

기준일: 2026-03-06

## 상태 정의
- `requested`: 요청 생성 직후
- `in_review`: 관리자 검토 중
- `approved`: 처리 승인
- `rejected`: 반려
- `completed`: 실제 처리 완료
- `cancelled`: 요청 취소

## 상태 전이 규칙(서버 강제)
| from | allowed to |
|---|---|
| requested | in_review, approved, rejected, cancelled |
| in_review | approved, rejected, cancelled |
| approved | completed, cancelled |
| rejected | (없음, 종료) |
| completed | (없음, 종료) |
| cancelled | (없음, 종료) |

## 권한 규칙
- 생성(`createDeletionRequest`): 인증 사용자
  - `targetUid` 실사용자 문서 존재 필수
  - 요청 payload의 `targetRole`은 대상 사용자 실제 role과 일치 필수
  - `super_admin` 및 `superAdminProtected=true` 대상은 생성 차단
- 검토(`adminReviewDeletionRequest`): `super_admin`만 가능
  - 상태 전이 규칙 위반 시 차단
  - 보호대상(`super_admin`, `superAdminProtected`)은 차단
- 취소(`cancelDeletionRequest`): 요청자 본인만 가능
  - 현재 상태가 `requested`일 때만 `cancelled` 전이 허용

## 구현 반영 위치
- Functions:
  - `firebase/functions/src/modules/deletionRequests/callables.ts`
  - `firebase/firestore/firestore.rules`
- Web:
  - `web/src/features/deletion-requests/pages/DeletionRequestsPage.tsx`
  - `web/src/lib/api/admin-api.ts` (mock 전이 검증 동기화)
