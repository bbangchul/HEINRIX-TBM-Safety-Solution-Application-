# RBAC / Auth Policy

## 문서 구성
- `role-model.md`: 역할 모델 + 보호 정책 + 인증 정책 정의
- `rbac-matrix.csv`: 도메인별 액션 허용/거부 매트릭스

## Step 5 마감 범위 (인증 정책)
- 서버(Callable): `super_admin` + MFA + 허용 도메인 + 허용 환경(claim.environment) 강제
- 웹(Auth Guard): `super_admin` + MFA + 허용 도메인 + 허용 환경 검증 후 라우팅 허용
- 기본 허용 도메인: `heinrix.com`
- 기본 허용 환경: `VITE_APP_ENV` / `APP_ENV` 단일 환경
