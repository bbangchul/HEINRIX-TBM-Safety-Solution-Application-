import { Link } from "react-router-dom";
import {
  getAllowedSuperAdminIdentityLabel,
  getAllowedSuperAdminEnvironmentsLabel,
} from "../../../lib/utils/auth-policy";

export function ForbiddenPage() {
  const allowedIdentities = getAllowedSuperAdminIdentityLabel();
  const allowedEnvironments = getAllowedSuperAdminEnvironmentsLabel();

  return (
    <div className="center-screen">
      <div className="status-card">
        <h2>접근 권한이 없습니다</h2>
        <p>이 콘솔은 `super_admin` 권한, MFA 검증, 허용 도메인, 허용 환경을 모두 충족해야 접근할 수 있습니다.</p>
        <p>허용 계정/도메인: {allowedIdentities}</p>
        <p>허용 인증 환경: {allowedEnvironments}</p>
        <Link to="/auth/login" className="text-link">
          로그인 페이지로 이동
        </Link>
      </div>
    </div>
  );
}
