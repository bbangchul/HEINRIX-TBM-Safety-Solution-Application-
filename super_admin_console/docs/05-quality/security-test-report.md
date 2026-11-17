# Security Test Report (Step 21)

- 기준일: 2026-03-07
- 대상 프로젝트: `tbm-application-v2`
- 대상 영역: Super Admin Console (`functions`, `firestore.rules`, `web auth guard`)

## 1) 테스트 범위

- 권한 우회: `worker`/비인증 토큰으로 super admin callable 접근 시도
- 인증 정책 우회: MFA 미검증/도메인 불일치/환경 불일치 super_admin 토큰으로 callable 접근 시도
- 보호계정 삭제 차단: `adminDeleteOrAnonymizeUser`로 보호된 super_admin 계정 삭제 시도
- 규칙 우회: `worker` 토큰으로 Firestore REST 직접 쓰기(`systemConfigs`) 시도
- 정적 정책 점검: Firestore Rules + 함수/웹 가드 필수 조건 누락 여부

## 2) 실행 커맨드

```bash
npm --prefix super_admin_console/firebase/functions run verify:security-controls
FIREBASE_API_KEY=<project-browser-key> npm --prefix super_admin_console/firebase/functions run test:security:e2e
```

## 3) 결과 요약

- 정적 보안 점검: `pass`
- 실환경 보안 E2E: `pass`
- 고위험 취약점: `0건`

실행 메모:
- 초기 실행에서 `adminDeleteOrAnonymizeUser` 배포본이 최신 가드를 반영하지 않아 재배포 진행
- 재배포: `functions[adminDeleteOrAnonymizeUser(asia-northeast3)]` 성공 업데이트 (`admindeleteoranonymizeuser-00002-dim`)
- 최종 E2E 실행 ID: `1772811180713_24594`

## 4) 시나리오별 결과

| 시나리오 | 기대 결과 | 실제 결과 | 판정 |
|---|---|---|---|
| 비인증 callable 접근 | `UNAUTHENTICATED` | `401 UNAUTHENTICATED` | pass |
| worker callable 접근 | `PERMISSION_DENIED` | `403 PERMISSION_DENIED` | pass |
| super_admin(MFA 없음) | `PERMISSION_DENIED` | `403 PERMISSION_DENIED` (`Super admin MFA required.`) | pass |
| super_admin(도메인 불일치) | `PERMISSION_DENIED` | `403 PERMISSION_DENIED` (`Super admin email domain not allowed.`) | pass |
| super_admin(환경 불일치) | `PERMISSION_DENIED` | `403 PERMISSION_DENIED` (`Super admin token environment does not match runtime environment.`) | pass |
| 보호 super_admin 삭제 시도 | `FAILED_PRECONDITION` | `400 FAILED_PRECONDITION` (`Protected role target.`) | pass |
| worker Firestore 직접 쓰기 | `PERMISSION_DENIED` | `403 PERMISSION_DENIED` (`Missing or insufficient permissions.`) | pass |

## 5) 판단

- 현재 단계 판단: `done`
- 후속 조치: Step 22 회귀/E2E 테스트에서 본 보안 시나리오를 CI 잡으로 편입
