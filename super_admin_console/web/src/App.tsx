import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/layout/AdminLayout";
import { AuthProvider } from "./features/auth/auth-context";
import { RequireSuperAdmin } from "./features/auth/RequireSuperAdmin";
import { AuditLogsPage } from "./features/audit-logs/pages/AuditLogsPage";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { ForbiddenPage } from "./features/auth/pages/ForbiddenPage";
import { MfaRequiredPage } from "./features/auth/pages/MfaRequiredPage";
import { NotFoundPage } from "./features/auth/pages/NotFoundPage";
import { CompaniesPage } from "./features/companies/pages/CompaniesPage";
import { CompanyApprovalRequestsPage } from "./features/company-approval-requests/pages/CompanyApprovalRequestsPage";
import { BillingPage } from "./features/billing/pages/BillingPage";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { DeletionRequestsPage } from "./features/deletion-requests/pages/DeletionRequestsPage";
import { MembershipsPage } from "./features/memberships/pages/MembershipsPage";
import { ProjectsPage } from "./features/projects/pages/ProjectsPage";
import { SystemConfigsPage } from "./features/system-configs/pages/SystemConfigsPage";
import { UsersPage } from "./features/users/pages/UsersPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/forbidden" element={<ForbiddenPage />} />
        <Route path="/auth/mfa-required" element={<MfaRequiredPage />} />

        <Route element={<RequireSuperAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="company-approval-requests" element={<CompanyApprovalRequestsPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="memberships" element={<MembershipsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="deletion-requests" element={<DeletionRequestsPage />} />
            <Route path="audit-logs" element={<AuditLogsPage />} />
            <Route path="system-configs" element={<SystemConfigsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
