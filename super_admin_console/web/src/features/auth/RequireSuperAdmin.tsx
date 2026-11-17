import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth-context";
import { hasRequiredRole } from "../../lib/guards/has-required-role";
import { ADMIN_CONSOLE_ALLOWED_ROLES } from "../../lib/types/rbac";
import { isAllowedSuperAdminEmail, isAllowedSuperAdminEnvironment } from "../../lib/utils/auth-policy";

export function RequireSuperAdmin() {
  const { status, session } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="center-screen">
        <div className="status-card">
          <h2>인증 상태 확인 중</h2>
          <p>잠시만 기다려 주세요.</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated" || !session) {
    return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  }

  const role = session.claims.role ?? null;
  const mfaVerified = Boolean(session.claims.mfaVerified);
  const emailAllowed = isAllowedSuperAdminEmail(session.email);
  const environmentAllowed = isAllowedSuperAdminEnvironment(session.claims.environment);

  if (!hasRequiredRole(role, ADMIN_CONSOLE_ALLOWED_ROLES)) {
    return <Navigate to="/auth/forbidden" replace />;
  }

  if (!emailAllowed) {
    return <Navigate to="/auth/forbidden" replace />;
  }

  if (!environmentAllowed) {
    return <Navigate to="/auth/forbidden" replace />;
  }

  if (!mfaVerified) {
    return <Navigate to="/auth/mfa-required" replace />;
  }

  return <Outlet />;
}
