import { type FormEvent, useEffect, useState } from "react";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { AuditLogDoc } from "../../../lib/types/firestore";
import { APP_ROLES, type AppRole } from "../../../lib/types/rbac";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

interface AuditLogFilters {
  dateFrom: string;
  dateTo: string;
  actorUid: string;
  actorRole: AppRole | "";
  action: string;
  resourceType: string;
  resourceId: string;
  keyword: string;
  limit: 50 | 100 | 200;
}

const KNOWN_RESOURCE_TYPES = [
  "users",
  "companies",
  "projects",
  "memberships",
  "deletionRequests",
  "auditLogs",
  "systemConfigs",
] as const;

function actionTone(action: string): "neutral" | "success" | "warning" | "danger" | "info" {
  const lowered = action.toLowerCase();
  if (lowered.includes("delete") || lowered.includes("anonymize") || lowered.includes("archive")) {
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

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDefaultFilters(): AuditLogFilters {
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  return {
    dateFrom: toDateInputValue(sevenDaysAgo),
    dateTo: toDateInputValue(today),
    actorUid: "",
    actorRole: "",
    action: "",
    resourceType: "",
    resourceId: "",
    keyword: "",
    limit: 100,
  };
}

function summarizeChange(row: AuditLogDoc): string {
  const before = row.before ? Object.keys(row.before).length : 0;
  const after = row.after ? Object.keys(row.after).length : 0;

  if (before > 0 && after > 0) return `변경(before:${before}, after:${after})`;
  if (before === 0 && after > 0) return `생성(after:${after})`;
  if (before > 0 && after === 0) return `삭제(before:${before})`;
  return "-";
}

const columns: DataColumn<AuditLogDoc>[] = [
  {
    key: "createdAt",
    header: "기록 시각",
    render: (row) => formatDateTime(row.createdAt),
  },
  {
    key: "actorUid",
    header: "행위자 UID",
    render: (row) => <span className="mono-text">{row.actorUid}</span>,
  },
  {
    key: "actorRole",
    header: "행위자 역할",
    render: (row) => <StatusBadge label={row.actorRole} tone={row.actorRole === "super_admin" ? "danger" : "info"} />,
  },
  {
    key: "action",
    header: "액션",
    render: (row) => <StatusBadge label={row.action} tone={actionTone(row.action)} />,
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
    key: "changeSummary",
    header: "변경 요약",
    render: (row) => summarizeChange(row),
  },
];

export function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>(buildDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState<AuditLogFilters>(buildDefaultFilters);
  const [rows, setRows] = useState<AuditLogDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const logs = await adminApi.listAuditLogs({
          limit: appliedFilters.limit,
          actorUid: appliedFilters.actorUid.trim() || undefined,
          actorRole: appliedFilters.actorRole || undefined,
          action: appliedFilters.action.trim() || undefined,
          resourceType: appliedFilters.resourceType.trim() || undefined,
          resourceId: appliedFilters.resourceId.trim() || undefined,
          keyword: appliedFilters.keyword.trim() || undefined,
          dateFrom: appliedFilters.dateFrom || undefined,
          dateTo: appliedFilters.dateTo || undefined,
        });
        setRows(logs);
      } catch (e) {
        setError(toActionErrorMessage(e, "감사로그 조회 중 오류가 발생했습니다."));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [appliedFilters]);

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setError("기간 필터가 올바르지 않습니다. 시작일은 종료일보다 이전이어야 합니다.");
      return;
    }

    setAppliedFilters({ ...filters });
  };

  const handleResetFilters = () => {
    const defaults = buildDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setError(null);
  };

  return (
    <PageScaffold
      title="감사 로그"
      description="기간/행위자/리소스 기준으로 관리자 액션 로그를 조회합니다."
    >
      {adminApi.usingMockData && (
        <p className="info-inline">
          감사로그 화면은 실데이터 전용입니다. Firebase Functions 연결 후 조회해 주세요.
        </p>
      )}

      <form onSubmit={handleApplyFilters}>
        <div className="toolbar toolbar-grid-5">
          <label>
            시작일
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))}
            />
          </label>
          <label>
            종료일
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value }))}
            />
          </label>
          <label>
            행위자 UID
            <input
              value={filters.actorUid}
              onChange={(event) => setFilters((prev) => ({ ...prev, actorUid: event.target.value }))}
              placeholder="u_super_1"
            />
          </label>
          <label>
            행위자 역할
            <select
              value={filters.actorRole}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, actorRole: event.target.value as AppRole | "" }))
              }
            >
              <option value="">전체</option>
              {APP_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>
          <label>
            액션
            <input
              value={filters.action}
              onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="membership.upsert"
            />
          </label>
        </div>

        <div className="toolbar toolbar-grid-4">
          <label>
            리소스 타입
            <input
              list="audit-resource-type-options"
              value={filters.resourceType}
              onChange={(event) => setFilters((prev) => ({ ...prev, resourceType: event.target.value }))}
              placeholder="users"
            />
            <datalist id="audit-resource-type-options">
              {KNOWN_RESOURCE_TYPES.map((resourceType) => (
                <option key={resourceType} value={resourceType} />
              ))}
            </datalist>
          </label>
          <label>
            리소스 ID
            <input
              value={filters.resourceId}
              onChange={(event) => setFilters((prev) => ({ ...prev, resourceId: event.target.value }))}
              placeholder="u_worker_1"
            />
          </label>
          <label>
            키워드
            <input
              value={filters.keyword}
              onChange={(event) => setFilters((prev) => ({ ...prev, keyword: event.target.value }))}
              placeholder="actorUid/action/resource"
            />
          </label>
          <label>
            조회 건수
            <select
              value={filters.limit}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, limit: Number(event.target.value) as 50 | 100 | 200 }))
              }
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </label>
        </div>

        <div className="toolbar-actions">
          <button type="submit" className="action-btn primary" disabled={loading}>
            조회
          </button>
          <button type="button" className="action-btn subtle" onClick={handleResetFilters} disabled={loading}>
            초기화
          </button>
        </div>
      </form>

      {error && <p className="error-inline">{error}</p>}
      {!error && !loading && <p className="info-inline">조회 결과: {rows.length}건</p>}

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        loading={loading}
        emptyText="감사로그 데이터가 없습니다."
      />
    </PageScaffold>
  );
}
