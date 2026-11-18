import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { MembershipDoc, MembershipStatus } from "../../../lib/types/firestore";
import { APP_ROLES, type AppRole } from "../../../lib/types/rbac";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

export function MembershipsPage() {
  const [companyId, setCompanyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [role, setRole] = useState<AppRole | "">("");
  const [status, setStatus] = useState<MembershipStatus | "">("");
  const [rows, setRows] = useState<MembershipDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [newUid, setNewUid] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("worker");
  const [newStatus, setNewStatus] = useState<MembershipStatus>("active");

  const [editTarget, setEditTarget] = useState<MembershipDoc | null>(null);
  const [editRole, setEditRole] = useState<AppRole>("worker");
  const [editStatus, setEditStatus] = useState<MembershipStatus>("active");
  const [editProjectId, setEditProjectId] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<MembershipDoc | null>(null);

  const loadMemberships = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const memberships = await adminApi.listMemberships({
        limit: 100,
        companyId: companyId || undefined,
        projectId: projectId || undefined,
        role: role || undefined,
        status: status || undefined,
      });
      setRows(memberships);
    } catch (e) {
      setError(toActionErrorMessage(e, "멤버십 목록 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [companyId, projectId, role, status]);

  useEffect(() => {
    void loadMemberships();
  }, [loadMemberships]);

  const handleCreate = async () => {
    const uid = newUid.trim();
    const company = newCompanyId.trim();
    if (!uid || !company) {
      setError("사용자 UID와 회사 ID를 입력해 주세요.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("create-membership");
      await adminApi.upsertMembership({
        uid,
        companyId: company,
        projectId: newProjectId.trim() || null,
        role: newRole,
        status: newStatus,
      });
      setNewUid("");
      setNewCompanyId("");
      setNewProjectId("");
      setNewRole("worker");
      setNewStatus("active");
      setSuccess("멤버십을 생성했습니다.");
      await loadMemberships();
    } catch (e) {
      setError(toActionErrorMessage(e, "멤버십 생성 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openEditModal = (row: MembershipDoc) => {
    setError(null);
    setEditTarget(row);
    setEditRole(row.role);
    setEditStatus(row.status);
    setEditProjectId(row.projectId ?? "");
  };

  const submitEditModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("update-membership");
      await adminApi.upsertMembership({
        membershipId: editTarget.id,
        uid: editTarget.uid,
        companyId: editTarget.companyId,
        projectId: editProjectId.trim() || null,
        role: editRole,
        status: editStatus,
      });
      setSuccess(`멤버십(${editTarget.id})을 수정했습니다.`);
      setEditTarget(null);
      await loadMemberships();
    } catch (e) {
      setError(toActionErrorMessage(e, "멤버십 수정 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const submitDeleteModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deleteTarget) return;

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("delete-membership");
      await adminApi.deleteMembership({ membershipId: deleteTarget.id });
      setSuccess(`멤버십(${deleteTarget.id})을 삭제했습니다.`);
      setDeleteTarget(null);
      await loadMemberships();
    } catch (e) {
      setError(toActionErrorMessage(e, "멤버십 삭제 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<MembershipDoc>[] = [
    {
      key: "uid",
      header: "사용자 UID",
      render: (row) => <span className="mono-text">{row.uid}</span>,
    },
    {
      key: "companyId",
      header: "회사",
      render: (row) => <span className="mono-text">{row.companyId}</span>,
    },
    {
      key: "projectId",
      header: "프로젝트",
      render: (row) => <span className="mono-text">{row.projectId ?? "-"}</span>,
    },
    {
      key: "role",
      header: "역할",
      render: (row) => <StatusBadge label={row.role} tone={row.role === "super_admin" ? "danger" : "info"} />,
    },
    {
      key: "status",
      header: "상태",
      render: (row) => <StatusBadge label={row.status} tone={row.status === "active" ? "success" : "neutral"} />,
    },
    {
      key: "updatedAt",
      header: "수정 시각",
      render: (row) => formatDateTime(row.updatedAt),
    },
    {
      key: "actions",
      header: "액션",
      width: "210px",
      render: (row) => (
        <div className="table-actions">
          <button
            type="button"
            className="action-btn subtle"
            onClick={() => openEditModal(row)}
            disabled={Boolean(mutatingKey)}
          >
            수정
          </button>
          <button
            type="button"
            className="action-btn danger"
            onClick={() => setDeleteTarget(row)}
            disabled={Boolean(mutatingKey)}
          >
            삭제
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageScaffold title="멤버십 관리" description="사용자의 회사·현장 소속과 역할을 관리합니다.">
        <div className="toolbar toolbar-grid-4">
          <label>
            목록 회사 ID
            <input value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="company_alpha" />
          </label>
          <label>
            목록 프로젝트 ID
            <input value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="project_a" />
          </label>
          <label>
            목록 역할
            <select value={role} onChange={(event) => setRole(event.target.value as AppRole | "")}>
              <option value="">전체</option>
              <option value="super_admin">super_admin</option>
              <option value="company_admin">company_admin</option>
              <option value="project_admin">project_admin</option>
              <option value="worker">worker</option>
            </select>
          </label>
          <label>
            목록 상태
            <select value={status} onChange={(event) => setStatus(event.target.value as MembershipStatus | "")}>
              <option value="">전체</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <div className="toolbar toolbar-grid-5">
          <label>
            신규 UID
            <input value={newUid} onChange={(event) => setNewUid(event.target.value)} placeholder="u_worker_3" />
          </label>
          <label>
            신규 회사 ID
            <input
              value={newCompanyId}
              onChange={(event) => setNewCompanyId(event.target.value)}
              placeholder="company_alpha"
            />
          </label>
          <label>
            신규 프로젝트 ID
            <input
              value={newProjectId}
              onChange={(event) => setNewProjectId(event.target.value)}
              placeholder="project_a (optional)"
            />
          </label>
          <label>
            신규 역할
            <select value={newRole} onChange={(event) => setNewRole(event.target.value as AppRole)}>
              <option value="worker">worker</option>
              <option value="project_admin">project_admin</option>
              <option value="company_admin">company_admin</option>
            </select>
          </label>
          <label>
            신규 상태
            <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as MembershipStatus)}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="action-btn primary"
            onClick={() => void handleCreate()}
            disabled={Boolean(mutatingKey)}
          >
            멤버십 생성
          </button>
        </div>

        {adminApi.usingMockData && <p className="info-inline">mock 데이터 모드</p>}
        {success && <p className="success-inline">{success}</p>}
        {error && <p className="error-inline">{error}</p>}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText="멤버십 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(editTarget)}
        title="멤버십 수정"
        submitLabel="저장"
        submitTone="primary"
        submitting={mutatingKey === "update-membership"}
        onClose={() => setEditTarget(null)}
        onSubmit={(event) => void submitEditModal(event)}
      >
        <label>
          역할
          <select value={editRole} onChange={(event) => setEditRole(event.target.value as AppRole)}>
            <option value="super_admin">super_admin</option>
            <option value="company_admin">company_admin</option>
            <option value="project_admin">project_admin</option>
            <option value="worker">worker</option>
          </select>
        </label>
        <label>
          상태
          <select value={editStatus} onChange={(event) => setEditStatus(event.target.value as MembershipStatus)}>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </label>
        <label>
          프로젝트 ID (선택)
          <input value={editProjectId} onChange={(event) => setEditProjectId(event.target.value)} />
        </label>
      </ActionModal>

      <ActionModal
        open={Boolean(deleteTarget)}
        title="멤버십 삭제"
        description={deleteTarget ? `멤버십(${deleteTarget.id})을 삭제하시겠습니까?` : undefined}
        submitLabel="삭제"
        submitTone="danger"
        submitting={mutatingKey === "delete-membership"}
        onClose={() => setDeleteTarget(null)}
        onSubmit={(event) => void submitDeleteModal(event)}
      />
    </>
  );
}
