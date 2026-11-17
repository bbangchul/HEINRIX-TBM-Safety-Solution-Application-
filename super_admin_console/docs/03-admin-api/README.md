# Admin API (Step 10)

## 범위
- Admin 웹은 Firestore 직접 쓰기를 사용하지 않고 Callable Functions만 호출한다.
- 모든 민감 mutation은 서버에서 `withSuperAdminCallable`로 claim을 재검증한다.
- 입력 파라미터는 각 callable 내부에서 `readInputObject`/`readString`/`readNumber`로 검증한다.

## 산출물
- `callable-spec.md`: callable 이름, 권한, 요청/응답 스펙, 주요 에러 코드

## 검증 포인트
- 프론트: `web/src/lib/api/admin-api.ts`가 단일 API 진입점 역할
- 백엔드: `firebase/functions/src/modules/**/callables.ts`의 callable만 외부 노출

## 자동 검증 커맨드
- `npm --prefix firebase/functions run verify:admin-api-layer`
- `npm --prefix web run verify:callable-only`
