import { Link } from "react-router-dom";

export function MfaRequiredPage() {
  return (
    <div className="center-screen">
      <div className="status-card">
        <h2>MFA 확인 필요</h2>
        <p>보안 정책에 따라 슈퍼 관리자 계정은 다중 인증(MFA) 확인이 필요합니다.</p>
        <Link to="/auth/login" className="text-link">
          다시 로그인
        </Link>
      </div>
    </div>
  );
}
