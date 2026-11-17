import { useEffect, useState } from "react";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { DashboardKpi, DashboardOverview, DashboardWarningLevel } from "../../../lib/api/admin-api";
import type { AuditLogDoc, CompanyApprovalRequestDoc, DeletionRequestDoc } from "../../../lib/types/firestore";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

const companyApprovalRequestColumns: DataColumn<CompanyApprovalRequestDoc>[] = [
  {
    key: "id",
    header: "요청 ID",
    render: (row) => <span className="mono-text">{row.id}</span>,
  },
  {
    key: "companyName",
    header: "회사",
    render: (row) => row.companyName ?? row.companyId,
  },
  {
    key: "requesterUid",
    header: "요청자",
    render: (row) => row.requesterUid,
  },
  {
    key: "status",
    header: "상태",
    render: (row) => (
      <StatusBadge
        label={row.status}
        tone={row.status === "pending" ? "warning" : row.status === "approved" ? "success" : row.status === "rejected" ? "danger" : "neutral"}
      />
    ),
  },
  {
    key: "createdAt",
    header: "요청 시각",
    render: (row) => formatDateTime(row.submittedAt ?? row.createdAt),
  },
];

const deletionRequestColumns: DataColumn<DeletionRequestDoc>[] = [
  {
    key: "id",
    header: "요청 ID",
    render: (row) => <span className="mono-text">{row.id}</span>,
  },
  {
    key: "requester",
    header: "요청자",
    render: (row) => row.requesterUid,
  },
  {
    key: "target",
    header: "대상 사용자",
    render: (row) => row.targetUid,
  },
  {
    key: "status",
    header: "상태",
    render: (row) => (
      <StatusBadge
        label={row.status}
        tone={row.status === "requested" ? "warning" : row.status === "approved" ? "success" : "neutral"}
      />
    ),
  },
  {
    key: "createdAt",
    header: "요청 시각",
    render: (row) => formatDateTime(row.createdAt),
  },
];

const auditLogColumns: DataColumn<AuditLogDoc>[] = [
  {
    key: "action",
    header: "이벤트",
    render: (row) => (
      <StatusBadge label={row.action} tone={auditActionTone(row.action)} />
    ),
  },
  {
    key: "resource",
    header: "리소스",
    render: (row) => (
      <span className="mono-text">
        {row.resourceType}/{row.resourceId}
      </span>
    ),
  },
  {
    key: "actor",
    header: "수행자",
    render: (row) => row.actorUid,
  },
  {
    key: "createdAt",
    header: "시각",
    render: (row) => formatDateTime(row.createdAt),
  },
];

const EMPTY_KPI: DashboardKpi = {
  totalUsers: 0,
  activeUsers: 0,
  disabledUsers: 0,
  activeProjects: 0,
  pendingDeletionRequests: 0,
  inReviewDeletionRequests: 0,
};

function auditActionTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  const lowered = action.toLowerCase();
  if (lowered.includes("delete") || lowered.includes("anonymize")) {
    return "danger";
  }
  if (lowered.includes("review") || lowered.includes("status")) {
    return "warning";
  }
  if (lowered.includes("upsert") || lowered.includes("create") || lowered.includes("set")) {
    return "info";
  }
  return "neutral";
}

function warningTone(level: DashboardWarningLevel): "neutral" | "success" | "warning" | "danger" | "info" {
  if (level === "danger") return "danger";
  if (level === "warning") return "warning";
  return "info";
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [recentCompanyApprovalRequests, setRecentCompanyApprovalRequests] = useState<CompanyApprovalRequestDoc[]>([]);
  const [pendingCompanyApprovalCount, setPendingCompanyApprovalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMs, setLoadingMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const startedAt = performance.now();
        setLoading(true);
        setError(null);
        const [data, companyApprovalRequests, pendingCompanyApprovalRequests] = await Promise.all([
          adminApi.getDashboardOverview({ recentLimit: 6 }),
          adminApi.listCompanyApprovalRequests({ limit: 6 }),
          adminApi.listCompanyApprovalRequests({ limit: 100, status: "pending" }),
        ]);
        setOverview(data);
        setRecentCompanyApprovalRequests(companyApprovalRequests);
        setPendingCompanyApprovalCount(pendingCompanyApprovalRequests.length);
        setLoadingMs(Math.round(performance.now() - startedAt));
      } catch (e) {
        setError(toActionErrorMessage(e, "대시보드 로딩 중 오류가 발생했습니다."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const kpi = overview?.kpi ?? EMPTY_KPI;
  const recentDeletionRequests = overview?.recentDeletionRequests ?? [];
  const recentAuditLogs = overview?.recentAuditLogs ?? [];
  const warnings = overview?.warnings ?? [];
  const withinPerformanceTarget = loadingMs != null && loadingMs <= 3000;

  return (
    <PageScaffold
      title="대시보드"
      description="핵심 KPI, 최근 이벤트, 운영 경고를 한 화면에서 확인합니다."
    >
      {adminApi.usingMockData && (
        <p className="info-inline">현재 Firebase Functions 미연결 상태라 샘플(mock) 데이터로 표시 중입니다.</p>
      )}
      {error && <p className="error-inline">{error}</p>}
      {loadingMs != null && (
        <p className={withinPerformanceTarget ? "success-inline" : "info-inline"}>
          초기 로딩 시간: {loadingMs}ms {withinPerformanceTarget ? "(목표 3초 이내 충족)" : "(목표 3초 이내 미충족)"}
        </p>
      )}

      <div className="card-grid dashboard-card-grid">
        <article className="metric-card">
          <h3>전체 사용자</h3>
          <strong>{loading ? "..." : kpi.totalUsers}</strong>
          <p>users (all)</p>
        </article>
        <article className="metric-card">
          <h3>활성 사용자</h3>
          <strong>{loading ? "..." : kpi.activeUsers}</strong>
          <p>users.status = active</p>
        </article>
        <article className="metric-card">
          <h3>비활성 사용자</h3>
          <strong>{loading ? "..." : kpi.disabledUsers}</strong>
          <p>users.status = disabled</p>
        </article>
        <article className="metric-card">
          <h3>활성 프로젝트</h3>
          <strong>{loading ? "..." : kpi.activeProjects}</strong>
          <p>projects.status = active</p>
        </article>
        <article className="metric-card">
          <h3>회사 승인 처리필요</h3>
          <strong>{loading ? "..." : pendingCompanyApprovalCount}</strong>
          <p>company_admin_conversion_requests.status = pending</p>
        </article>
        <article className="metric-card">
          <h3>삭제 요청 처리필요</h3>
          <strong>{loading ? "..." : kpi.pendingDeletionRequests + kpi.inReviewDeletionRequests}</strong>
          <p>requested + in_review</p>
        </article>
      </div>

      <div className="section-block">
        <h3>운영 경고</h3>
        <div className="dashboard-warning-list">
          {warnings.map((warning) => (
            <article className="dashboard-warning-item" key={warning.code}>
              <div className="dashboard-warning-head">
                <StatusBadge label={warning.level.toUpperCase()} tone={warningTone(warning.level)} />
                <strong>{warning.title}</strong>
              </div>
              <p>{warning.description}</p>
              {warning.count != null && <small>대상 건수: {warning.count}</small>}
            </article>
          ))}
        </div>
      </div>

      <div className="section-block">
        <h3>최근 이벤트</h3>
        <DataTable
          columns={auditLogColumns}
          rows={recentAuditLogs}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText="최근 이벤트 데이터가 없습니다."
        />
      </div>

      <div className="section-block">
        <h3>최근 회사 승인 요청</h3>
        <DataTable
          columns={companyApprovalRequestColumns}
          rows={recentCompanyApprovalRequests}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText="회사 승인 요청 데이터가 없습니다."
        />
      </div>

      <div className="section-block">
        <h3>최근 삭제 요청</h3>
        <DataTable
          columns={deletionRequestColumns}
          rows={recentDeletionRequests}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText="삭제 요청 데이터가 없습니다."
        />
      </div>
    </PageScaffold>
  );
}
