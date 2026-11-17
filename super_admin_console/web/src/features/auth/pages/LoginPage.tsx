import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth-context";
import {
  getAllowedSuperAdminIdentityLabel,
  getAllowedSuperAdminEnvironmentsLabel,
} from "../../../lib/utils/auth-policy";

interface LocationState {
  from?: string;
}

export function LoginPage() {
  const { loginWithGoogle, error, isFirebaseReady, status, session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const allowedIdentities = getAllowedSuperAdminIdentityLabel();
  const allowedEnvironments = getAllowedSuperAdminEnvironmentsLabel();

  const from = ((location.state as LocationState | null)?.from ?? "/admin") as string;

  useEffect(() => {
    if (status === "authenticated" && session) {
      navigate(from, { replace: true });
    }
  }, [status, session, navigate, from]);

  const handleLogin = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="center-screen">
      <div className="auth-card">
        <div className="brand-box">
          <img className="brand-app-icon" src="/assets/icon.png" alt="" />
          <img className="brand-wordmark" src="/assets/anha-jeonhanharu-logo.png" alt="안전한하루" />
        </div>
        <h1>안전한하루 관리자 로그인</h1>
        <p>슈퍼 관리자 계정으로 로그인해야 관리자 콘솔에 접근할 수 있습니다.</p>
        <p>허용 계정/도메인: {allowedIdentities}</p>
        <p>허용 인증 환경: {allowedEnvironments}</p>

        <button
          type="button"
          className="primary-btn"
          onClick={() => void handleLogin()}
          disabled={!isFirebaseReady || submitting}
        >
          {submitting ? "로그인 처리 중..." : "Google 계정으로 로그인"}
        </button>

        {!isFirebaseReady && <p className="warn-text">Firebase 설정이 없어 로그인할 수 없습니다.</p>}
        {error && <p className="warn-text">{error}</p>}
        {submitError && <p className="warn-text">{submitError}</p>}
      </div>
    </div>
  );
}
