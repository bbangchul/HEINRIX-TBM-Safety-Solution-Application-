# 회사 승인 요청 워크플로우

기준일: 2026-03-24

## 생성 이벤트 정의
- 회사 가입 신청 완료 시점에 `companyApprovalRequests/{requestId}` 문서를 생성한다.
- 요청 생성은 회사 단위로 처리한다.
- 최초 생성 상태는 항상 `requested`다.

## 상태 정의
- `requested`: 회사 승인 요청 생성 직후
- `approved`: 슈퍼 관리자 승인 완료
- `rejected`: 슈퍼 관리자 반려
- `cancelled`: 요청자 또는 시스템에 의해 취소

## 상태 전이 규칙
| from | allowed to |
|---|---|
| requested | approved, rejected, cancelled |
| approved | (없음, 종료) |
| rejected | (없음, 종료) |
| cancelled | (없음, 종료) |

## 최소 문서 필드
- `companyId`
- `requesterUid`
- `status`
- `reason`
- `reviewedBy`
- `reviewedAt`
- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`

## 다음 구현 단계
- Functions: `createCompanyApprovalRequest`, `adminListCompanyApprovalRequests`, `adminReviewCompanyApprovalRequest`
- Firestore Rules: 요청자 생성 허용, `super_admin` 검토/조회 허용
- Web/App: 로그인 중 `requested` 실시간 감지 후 토스트 또는 배지 노출
