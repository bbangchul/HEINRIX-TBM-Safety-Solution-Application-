import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { CompanyDoc, CompanyStatus } from "../../../lib/types/firestore";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

export function CompaniesPage() {
  const [status, setStatus] = useState<CompanyStatus | "">("");
  const [rows, setRows] = useState<CompanyDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newStatus, setNewStatus] = useState<CompanyStatus>("active");

  const [editTarget, setEditTarget] = useState<CompanyDoc | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const [statusTarget, setStatusTarget] = useState<CompanyDoc | null>(null);
  const [statusNext, setStatusNext] = useState<CompanyStatus>("inactive");

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const companies = await adminApi.listCompanies({
        limit: 100,
        status: status || undefined,
      });
      setRows(companies);
    } catch (e) {
      setError(toActionErrorMessage(e, "회사 목록 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  const handleCreate = async () => {
    const name = newName.trim();
    const code = newCode.trim();
    if (!name || !code) {
      setError("회사명과 코드를 입력해 주세요.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("create-company");
      await adminApi.upsertCompany({
        name,
        code,
        status: newStatus,
      });
      setNewName("");
      setNewCode("");
      setNewStatus("active");
      setSuccess("회사를 생성했습니다.");
      await loadCompanies();
    } catch (e) {
      setError(toActionErrorMessage(e, "회사 생성 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openEditModal = (row: CompanyDoc) => {
    setError(null);
    setEditTarget(row);
    setEditName(row.name);
    setEditCode(row.code);
  };

  const submitEditModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;

    const name = editName.trim();
    const code = editCode.trim();
    if (!name || !code) {
      setError("회사명과 코드는 비워둘 수 없습니다.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("update-company");
      await adminApi.upsertCompany({
        companyId: editTarget.id,
        name,
        code,
        status: editTarget.status,
      });
      setSuccess(`회사(${editTarget.id}) 정보를 수정했습니다.`);
      setEditTarget(null);
      await loadCompanies();
    } catch (e) {
      setError(toActionErrorMessage(e, "회사 수정 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openStatusModal = (row: CompanyDoc) => {
    const nextStatus: CompanyStatus = row.status === "active" ? "inactive" : "active";
    setError(null);
    setStatusTarget(row);
    setStatusNext(nextStatus);
  };

  const submitStatusModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!statusTarget) return;

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("set-company-status");
      await adminApi.setCompanyStatus({ companyId: statusTarget.id, status: statusNext });
      setSuccess(
        statusNext === "inactive"
          ? `회사(${statusTarget.id})를 비활성화했습니다.`
          : `회사(${statusTarget.id})를 활성화했습니다.`
      );
      setStatusTarget(null);
      await loadCompanies();
    } catch (e) {
      setError(toActionErrorMessage(e, "회사 상태 변경 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<CompanyDoc>[] = [
    {
      key: "name",
      header: "회사명",
      render: (row) => row.name,
    },
    {
      key: "code",
      header: "코드",
      render: (row) => <span className="mono-text">{row.code}</span>,
    },
    {
      key: "status",
      header: "상태",
      render: (row) => (
        <StatusBadge label={row.status} tone={row.status === "active" ? "success" : "neutral"} />
      ),
    },
    {
      key: "ownerUid",
      header: "소유자 UID",
      render: (row) => <span className="mono-text">{row.ownerUid}</span>,
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
            className={row.status === "active" ? "action-btn danger" : "action-btn"}
            onClick={() => openStatusModal(row)}
            disabled={Boolean(mutatingKey)}
          >
            {row.status === "active" ? "삭제(비활성)" : "복구(활성)"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageScaffold title="회사 관리" description="회사 생성/수정/비활성화 액션을 실행합니다.">
        <div className="toolbar toolbar-grid-4">
          <label>
            목록 상태 필터
            <select value={status} onChange={(event) => setStatus(event.target.value as CompanyStatus | "")}>
              <option value="">전체</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label>
            신규 회사명
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="안전한하루 서울" />
          </label>
          <label>
            신규 코드
            <input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder="HX-SEOUL" />
          </label>
          <label>
            신규 상태
            <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as CompanyStatus)}>
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
            회사 생성
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
          emptyText="회사 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(editTarget)}
        title="회사 정보 수정"
        submitLabel="저장"
        submitTone="primary"
        submitting={mutatingKey === "update-company"}
        onClose={() => setEditTarget(null)}
        onSubmit={(event) => void submitEditModal(event)}
      >
        <label>
          회사명
          <input value={editName} onChange={(event) => setEditName(event.target.value)} />
        </label>
        <label>
          회사 코드
          <input value={editCode} onChange={(event) => setEditCode(event.target.value)} />
        </label>
      </ActionModal>

      <ActionModal
        open={Boolean(statusTarget)}
        title={statusNext === "inactive" ? "회사 비활성화" : "회사 활성화"}
        description={
          statusTarget
            ? statusNext === "inactive"
              ? `회사(${statusTarget.name})를 비활성화하시겠습니까?`
              : `회사(${statusTarget.name})를 다시 활성화하시겠습니까?`
            : undefined
        }
        submitLabel={statusNext === "inactive" ? "비활성화" : "활성화"}
        submitTone={statusNext === "inactive" ? "danger" : "primary"}
        submitting={mutatingKey === "set-company-status"}
        onClose={() => setStatusTarget(null)}
        onSubmit={(event) => void submitStatusModal(event)}
      />
    </>
  );
}
