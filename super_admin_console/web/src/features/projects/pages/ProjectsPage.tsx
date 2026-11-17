import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { ProjectDoc, ProjectStatus } from "../../../lib/types/firestore";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

export function ProjectsPage() {
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const [companyId, setCompanyId] = useState("");
  const [rows, setRows] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [newCompanyId, setNewCompanyId] = useState("");
  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<ProjectStatus>("active");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const [editTarget, setEditTarget] = useState<ProjectDoc | null>(null);
  const [editName, setEditName] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const [archiveTarget, setArchiveTarget] = useState<ProjectDoc | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projects = await adminApi.listProjects({
        limit: 100,
        companyId: companyId.trim() || undefined,
        status: status || undefined,
      });
      setRows(projects);
    } catch (e) {
      setError(toActionErrorMessage(e, "프로젝트 목록 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [status, companyId]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleCreate = async () => {
    const createCompanyId = newCompanyId.trim();
    const createName = newName.trim();
    if (!createCompanyId || !createName) {
      setError("회사 ID와 프로젝트명을 입력해 주세요.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("create-project");
      await adminApi.upsertProject({
        companyId: createCompanyId,
        name: createName,
        status: newStatus,
        startDate: newStartDate.trim() || null,
        endDate: newEndDate.trim() || null,
      });
      setNewCompanyId("");
      setNewName("");
      setNewStatus("active");
      setNewStartDate("");
      setNewEndDate("");
      setSuccess("프로젝트를 생성했습니다.");
      await loadProjects();
    } catch (e) {
      setError(toActionErrorMessage(e, "프로젝트 생성 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openEditModal = (row: ProjectDoc) => {
    setError(null);
    setEditTarget(row);
    setEditName(row.name);
    setEditStartDate(row.startDate ?? "");
    setEditEndDate(row.endDate ?? "");
  };

  const submitEditModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;

    const name = editName.trim();
    if (!name) {
      setError("프로젝트명은 비워둘 수 없습니다.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("update-project");
      await adminApi.upsertProject({
        projectId: editTarget.id,
        companyId: editTarget.companyId,
        name,
        status: editTarget.status,
        startDate: editStartDate.trim() || null,
        endDate: editEndDate.trim() || null,
      });
      setSuccess(`프로젝트(${editTarget.id}) 정보를 수정했습니다.`);
      setEditTarget(null);
      await loadProjects();
    } catch (e) {
      setError(toActionErrorMessage(e, "프로젝트 수정 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openArchiveModal = (row: ProjectDoc) => {
    setError(null);
    setArchiveTarget(row);
  };

  const submitArchiveModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!archiveTarget) return;

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("archive-project");

      if (archiveTarget.status === "active") {
        await adminApi.archiveProject({ projectId: archiveTarget.id });
        setSuccess(`프로젝트(${archiveTarget.id})를 archived 상태로 변경했습니다.`);
      } else {
        await adminApi.upsertProject({
          projectId: archiveTarget.id,
          companyId: archiveTarget.companyId,
          name: archiveTarget.name,
          status: "active",
          startDate: archiveTarget.startDate ?? null,
          endDate: archiveTarget.endDate ?? null,
        });
        setSuccess(`프로젝트(${archiveTarget.id})를 active 상태로 복구했습니다.`);
      }

      setArchiveTarget(null);
      await loadProjects();
    } catch (e) {
      setError(toActionErrorMessage(e, "프로젝트 상태 변경 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<ProjectDoc>[] = [
    {
      key: "name",
      header: "프로젝트명",
      render: (row) => row.name,
    },
    {
      key: "companyId",
      header: "회사 ID",
      render: (row) => <span className="mono-text">{row.companyId}</span>,
    },
    {
      key: "status",
      header: "상태",
      render: (row) => (
        <StatusBadge label={row.status} tone={row.status === "active" ? "success" : "neutral"} />
      ),
    },
    {
      key: "period",
      header: "기간",
      render: (row) => `${row.startDate ?? "-"} ~ ${row.endDate ?? "-"}`,
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
            onClick={() => openArchiveModal(row)}
            disabled={Boolean(mutatingKey)}
          >
            {row.status === "active" ? "삭제(archived)" : "복구(active)"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageScaffold title="프로젝트 관리" description="프로젝트 생성/수정/삭제(archived) 액션을 실행합니다.">
        <div className="toolbar toolbar-grid-5">
          <label>
            목록 회사 ID 필터
            <input
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
              placeholder="company_alpha"
            />
          </label>
          <label>
            목록 상태 필터
            <select value={status} onChange={(event) => setStatus(event.target.value as ProjectStatus | "")}>
              <option value="">전체</option>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
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
            신규 프로젝트명
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="A Tower" />
          </label>
          <label>
            신규 상태
            <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as ProjectStatus)}>
              <option value="active">active</option>
              <option value="archived">archived</option>
            </select>
          </label>
        </div>

        <div className="toolbar toolbar-grid">
          <label>
            신규 시작일
            <input value={newStartDate} onChange={(event) => setNewStartDate(event.target.value)} placeholder="2026-03-01" />
          </label>
          <label>
            신규 종료일
            <input value={newEndDate} onChange={(event) => setNewEndDate(event.target.value)} placeholder="2026-12-31" />
          </label>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="action-btn primary"
            onClick={() => void handleCreate()}
            disabled={Boolean(mutatingKey)}
          >
            프로젝트 생성
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
          emptyText="프로젝트 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(editTarget)}
        title="프로젝트 수정"
        submitLabel="저장"
        submitTone="primary"
        submitting={mutatingKey === "update-project"}
        onClose={() => setEditTarget(null)}
        onSubmit={(event) => void submitEditModal(event)}
      >
        <label>
          프로젝트명
          <input value={editName} onChange={(event) => setEditName(event.target.value)} />
        </label>
        <label>
          시작일(YYYY-MM-DD)
          <input value={editStartDate} onChange={(event) => setEditStartDate(event.target.value)} />
        </label>
        <label>
          종료일(YYYY-MM-DD)
          <input value={editEndDate} onChange={(event) => setEditEndDate(event.target.value)} />
        </label>
      </ActionModal>

      <ActionModal
        open={Boolean(archiveTarget)}
        title={archiveTarget?.status === "active" ? "프로젝트 삭제 처리" : "프로젝트 복구"}
        description={
          archiveTarget
            ? archiveTarget.status === "active"
              ? `프로젝트(${archiveTarget.name})를 archived 상태로 변경하시겠습니까?`
              : `프로젝트(${archiveTarget.name})를 active 상태로 복구하시겠습니까?`
            : undefined
        }
        submitLabel={archiveTarget?.status === "active" ? "삭제(archived)" : "복구(active)"}
        submitTone={archiveTarget?.status === "active" ? "danger" : "primary"}
        submitting={mutatingKey === "archive-project"}
        onClose={() => setArchiveTarget(null)}
        onSubmit={(event) => void submitArchiveModal(event)}
      />
    </>
  );
}
