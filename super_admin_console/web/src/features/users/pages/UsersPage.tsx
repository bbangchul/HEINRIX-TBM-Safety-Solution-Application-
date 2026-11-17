import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { DeleteUserMode } from "../../../lib/api/admin-api";
import type { UserDoc, UserStatus } from "../../../lib/types/firestore";
import { APP_ROLES, type AppRole } from "../../../lib/types/rbac";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

const USER_STATUSES: UserStatus[] = ["active", "disabled", "pending"];

export function UsersPage() {
  const [role, setRole] = useState<AppRole | "">("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [roleTarget, setRoleTarget] = useState<UserDoc | null>(null);
  const [roleValue, setRoleValue] = useState<AppRole>("worker");

  const [statusTarget, setStatusTarget] = useState<UserDoc | null>(null);
  const [statusValue, setStatusValue] = useState<UserStatus>("active");

  const [disableTarget, setDisableTarget] = useState<UserDoc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserDoc | null>(null);
  const [deleteMode, setDeleteMode] = useState<DeleteUserMode>("anonymize");
  const [deleteAuth, setDeleteAuth] = useState<"yes" | "no">("no");
  const [deleteReason, setDeleteReason] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const users = await adminApi.listUsers({
        limit: 100,
        role: role || undefined,
        status: status || undefined,
      });
      setRows(users);
    } catch (e) {
      setError(toActionErrorMessage(e, "사용자 목록 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [role, status]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const openRoleModal = (row: UserDoc) => {
    if (row.role === "super_admin") {
      setError("super_admin 계정의 역할은 변경할 수 없습니다.");
      return;
    }
    setError(null);
    setRoleTarget(row);
    setRoleValue(row.role);
  };

  const submitRoleModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roleTarget || roleValue === roleTarget.role) {
      setRoleTarget(null);
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("set-user-role");
      const result = await adminApi.setUserRole({ uid: roleTarget.id, role: roleValue });
      setSuccess(
        `사용자(${result.uid}) 역할을 ${result.role}로 변경했습니다. memberships 동기화 ${result.membershipsSynced}건`
      );
      setRoleTarget(null);
      await loadUsers();
    } catch (e) {
      setError(toActionErrorMessage(e, "사용자 역할 변경 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openStatusModal = (row: UserDoc) => {
    setError(null);
    setStatusTarget(row);
    setStatusValue(row.status);
  };

  const submitStatusModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!statusTarget || statusValue === statusTarget.status) {
      setStatusTarget(null);
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("set-user-status");
      await adminApi.setUserStatus({ uid: statusTarget.id, status: statusValue });
      setSuccess(`사용자(${statusTarget.id}) 상태를 ${statusValue}로 변경했습니다.`);
      setStatusTarget(null);
      await loadUsers();
    } catch (e) {
      setError(toActionErrorMessage(e, "사용자 상태 변경 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openDisableModal = (row: UserDoc) => {
    if (row.role === "super_admin") {
      setError("super_admin 계정은 비활성화할 수 없습니다.");
      return;
    }

    if (row.status === "disabled") {
      return;
    }

    setError(null);
    setDisableTarget(row);
  };

  const submitDisableModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!disableTarget) return;

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("disable-user");
      await adminApi.setUserStatus({ uid: disableTarget.id, status: "disabled" });
      setSuccess(`사용자(${disableTarget.id})를 비활성화했습니다.`);
      setDisableTarget(null);
      await loadUsers();
    } catch (e) {
      setError(toActionErrorMessage(e, "사용자 비활성화 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openDeleteModal = (row: UserDoc) => {
    if (row.role === "super_admin") {
      setError("super_admin 계정은 삭제 또는 비식별화할 수 없습니다.");
      return;
    }

    setError(null);
    setDeleteTarget(row);
    setDeleteMode("anonymize");
    setDeleteAuth("no");
    setDeleteReason("");
  };

  const submitDeleteModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!deleteTarget) return;

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("delete-or-anonymize-user");
      const result = await adminApi.deleteOrAnonymizeUser({
        uid: deleteTarget.id,
        mode: deleteMode,
        deleteAuth: deleteAuth === "yes",
        reason: deleteReason.trim() || undefined,
      });
      setSuccess(
        `사용자(${result.uid}) ${result.mode === "hard_delete" ? "삭제" : "비식별화"} 완료 · memberships=${result.membershipsAffected}, authDeleted=${result.authDeleted ? "yes" : "no"}`
      );
      setDeleteTarget(null);
      await loadUsers();
    } catch (e) {
      setError(toActionErrorMessage(e, "사용자 삭제/비식별화 처리 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<UserDoc>[] = [
    {
      key: "displayName",
      header: "이름",
      render: (row) => row.displayName || "-",
    },
    {
      key: "email",
      header: "이메일",
      render: (row) => row.email,
    },
    {
      key: "role",
      header: "역할",
      render: (row) => <StatusBadge label={row.role} tone={row.role === "super_admin" ? "danger" : "info"} />,
    },
    {
      key: "status",
      header: "상태",
      render: (row) => (
        <StatusBadge
          label={row.status}
          tone={row.status === "active" ? "success" : row.status === "disabled" ? "danger" : "warning"}
        />
      ),
    },
    {
      key: "scope",
      header: "소속 범위",
      render: (row) => `회사 ${row.companyIds.length} / 프로젝트 ${row.projectIds.length}`,
    },
    {
      key: "updatedAt",
      header: "수정 시각",
      render: (row) => formatDateTime(row.updatedAt),
    },
    {
      key: "actions",
      header: "액션",
      width: "360px",
      render: (row) => (
        <div className="table-actions">
          <button
            type="button"
            className="action-btn subtle"
            onClick={() => openRoleModal(row)}
            disabled={Boolean(mutatingKey) || row.role === "super_admin"}
          >
            역할 변경
          </button>
          <button
            type="button"
            className="action-btn subtle"
            onClick={() => openStatusModal(row)}
            disabled={Boolean(mutatingKey)}
          >
            상태 변경
          </button>
          <button
            type="button"
            className="action-btn danger"
            onClick={() => openDisableModal(row)}
            disabled={Boolean(mutatingKey) || row.status === "disabled"}
          >
            삭제(비활성)
          </button>
          <button
            type="button"
            className="action-btn danger"
            onClick={() => openDeleteModal(row)}
            disabled={Boolean(mutatingKey) || row.role === "super_admin"}
          >
            삭제/비식별
          </button>
        </div>
      ),
    },
  ];

  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter(
      (row) =>
        row.email.toLowerCase().includes(query) ||
        row.displayName.toLowerCase().includes(query) ||
        row.id.toLowerCase().includes(query)
    );
  }, [rows, keyword]);

  return (
    <>
      <PageScaffold title="사용자/권한" description="사용자 역할/상태 변경 및 비활성화 액션을 실행합니다.">
        <div className="toolbar toolbar-grid-3">
          <label>
            역할
            <select value={role} onChange={(event) => setRole(event.target.value as AppRole | "")}>
              <option value="">전체</option>
              <option value="super_admin">super_admin</option>
              <option value="company_admin">company_admin</option>
              <option value="project_admin">project_admin</option>
              <option value="worker">worker</option>
            </select>
          </label>

          <label>
            상태
            <select value={status} onChange={(event) => setStatus(event.target.value as UserStatus | "")}>
              <option value="">전체</option>
              <option value="active">active</option>
              <option value="disabled">disabled</option>
              <option value="pending">pending</option>
            </select>
          </label>

          <label>
            검색
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="이메일, 이름, UID" />
          </label>
        </div>

        {adminApi.usingMockData && <p className="info-inline">mock 데이터 모드</p>}
        {success && <p className="success-inline">{success}</p>}
        {error && <p className="error-inline">{error}</p>}

        <DataTable
          columns={columns}
          rows={filteredRows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText="사용자 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(roleTarget)}
        title="사용자 역할 변경"
        submitLabel="변경"
        submitTone="primary"
        submitting={mutatingKey === "set-user-role"}
        onClose={() => setRoleTarget(null)}
        onSubmit={(event) => void submitRoleModal(event)}
      >
        <label>
          역할
          <select value={roleValue} onChange={(event) => setRoleValue(event.target.value as AppRole)}>
            <option value="super_admin">super_admin</option>
            <option value="company_admin">company_admin</option>
            <option value="project_admin">project_admin</option>
            <option value="worker">worker</option>
          </select>
        </label>
      </ActionModal>

      <ActionModal
        open={Boolean(statusTarget)}
        title="사용자 상태 변경"
        submitLabel="변경"
        submitTone={statusValue === "disabled" ? "danger" : "primary"}
        submitting={mutatingKey === "set-user-status"}
        onClose={() => setStatusTarget(null)}
        onSubmit={(event) => void submitStatusModal(event)}
      >
        <label>
          상태
          <select value={statusValue} onChange={(event) => setStatusValue(event.target.value as UserStatus)}>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
            <option value="pending">pending</option>
          </select>
        </label>
      </ActionModal>

      <ActionModal
        open={Boolean(disableTarget)}
        title="사용자 비활성화"
        description={disableTarget ? `사용자(${disableTarget.displayName || disableTarget.id})를 비활성화하시겠습니까?` : undefined}
        submitLabel="비활성화"
        submitTone="danger"
        submitting={mutatingKey === "disable-user"}
        onClose={() => setDisableTarget(null)}
        onSubmit={(event) => void submitDisableModal(event)}
      />

      <ActionModal
        open={Boolean(deleteTarget)}
        title="사용자 삭제/비식별화"
        description={
          deleteTarget
            ? `사용자(${deleteTarget.displayName || deleteTarget.id})의 계정을 비식별화하거나 영구 삭제합니다.`
            : undefined
        }
        submitLabel={deleteMode === "hard_delete" ? "영구 삭제 실행" : "비식별화 실행"}
        submitTone="danger"
        submitting={mutatingKey === "delete-or-anonymize-user"}
        onClose={() => setDeleteTarget(null)}
        onSubmit={(event) => void submitDeleteModal(event)}
      >
        <label>
          처리 모드
          <select
            value={deleteMode}
            onChange={(event) => {
              const mode = event.target.value as DeleteUserMode;
              setDeleteMode(mode);
              if (mode === "hard_delete") {
                setDeleteAuth("yes");
              }
            }}
          >
            <option value="anonymize">anonymize (비식별화)</option>
            <option value="hard_delete">hard_delete (영구 삭제)</option>
          </select>
        </label>

        <label>
          Auth 계정 삭제
          <select value={deleteAuth} onChange={(event) => setDeleteAuth(event.target.value as "yes" | "no")}>
            <option value="yes">yes</option>
            <option value="no">no</option>
          </select>
        </label>

        <label>
          사유 (선택)
          <textarea
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            placeholder="퇴사/정책 위반/중복 계정 등"
          />
        </label>
      </ActionModal>
    </>
  );
}
