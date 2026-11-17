import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import type { DeletionRequestDoc, DeletionRequestStatus } from "../../../lib/types/firestore";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

const DELETION_STATUSES: DeletionRequestStatus[] = [
  "requested",
  "in_review",
  "approved",
  "rejected",
  "completed",
  "cancelled",
];

const ACTION_LABELS: Record<DeletionRequestStatus, string> = {
  requested: "요청됨",
  in_review: "검토중",
  approved: "승인",
  rejected: "반려",
  completed: "처리완료",
  cancelled: "취소",
};

const ACTION_TONES: Record<DeletionRequestStatus, "primary" | "danger" | "subtle"> = {
  requested: "subtle",
  in_review: "subtle",
  approved: "primary",
  rejected: "danger",
  completed: "primary",
  cancelled: "subtle",
};

const ALLOWED_TRANSITIONS: Record<DeletionRequestStatus, DeletionRequestStatus[]> = {
  requested: ["in_review", "approved", "rejected", "cancelled"],
  in_review: ["approved", "rejected", "cancelled"],
  approved: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
};

function canTransition(from: DeletionRequestStatus, to: DeletionRequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function statusToneOf(
  status: DeletionRequestStatus
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "requested":
      return "warning";
    case "in_review":
      return "info";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "completed":
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

export function DeletionRequestsPage() {
  const [status, setStatus] = useState<DeletionRequestStatus | "">("");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<DeletionRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [reviewTarget, setReviewTarget] = useState<DeletionRequestDoc | null>(null);
  const [nextStatus, setNextStatus] = useState<DeletionRequestStatus>("approved");
  const [reviewComment, setReviewComment] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const requests = await adminApi.listDeletionRequests({
        limit: 100,
        status: status || undefined,
      });
      setRows(requests);
    } catch (e) {
      setError(toActionErrorMessage(e, "삭제 요청 목록 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const openReviewModal = (row: DeletionRequestDoc, targetStatus: DeletionRequestStatus) => {
    if (row.targetRole === "super_admin") {
      setError("super_admin 계정 삭제 요청은 처리할 수 없습니다.");
      return;
    }
    if (!canTransition(row.status, targetStatus)) {
      setError("현재 상태에서는 해당 액션을 실행할 수 없습니다.");
      return;
    }

    setError(null);
    setReviewTarget(row);
    setNextStatus(targetStatus);
    setReviewComment("");
  };

  const submitReviewModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reviewTarget) return;
    if (!canTransition(reviewTarget.status, nextStatus)) {
      setError("현재 상태에서는 해당 액션을 실행할 수 없습니다.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("review-deletion-request");
      await adminApi.reviewDeletionRequest({
        requestId: reviewTarget.id,
        status: nextStatus,
        reviewComment: reviewComment.trim() || undefined,
      });
      setSuccess(`삭제요청(${reviewTarget.id}) 상태를 ${ACTION_LABELS[nextStatus]}으로 변경했습니다.`);
      setReviewTarget(null);
      await loadRequests();
    } catch (e) {
      setError(toActionErrorMessage(e, "삭제 요청 처리 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<DeletionRequestDoc>[] = [
    {
      key: "id",
      header: "요청 ID",
      render: (row) => <span className="mono-text">{row.id}</span>,
    },
    {
      key: "requesterUid",
      header: "요청자 UID",
      render: (row) => <span className="mono-text">{row.requesterUid}</span>,
    },
    {
      key: "targetUid",
      header: "대상 UID",
      render: (row) => <span className="mono-text">{row.targetUid}</span>,
    },
    {
      key: "targetRole",
      header: "대상 역할",
      render: (row) => (
        <StatusBadge label={row.targetRole} tone={row.targetRole === "super_admin" ? "danger" : "info"} />
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (row) => <StatusBadge label={row.status} tone={statusToneOf(row.status)} />,
    },
    {
      key: "reason",
      header: "요청 사유",
      render: (row) => row.reason ?? "-",
    },
    {
      key: "reviewed",
      header: "검토 정보",
      render: (row) =>
        row.reviewedBy ? (
          <span className="mono-text">
            {row.reviewedBy}
            <br />
            {formatDateTime(row.reviewedAt)}
          </span>
        ) : (
          "-"
        ),
    },
    {
      key: "createdAt",
      header: "요청 시각",
      render: (row) => formatDateTime(row.createdAt),
    },
    {
      key: "actions",
      header: "액션",
      width: "320px",
      render: (row) => {
        if (row.targetRole === "super_admin") {
          return <span className="mono-text">보호 대상</span>;
        }

        const transitions = ALLOWED_TRANSITIONS[row.status];
        if (transitions.length === 0) {
          return <span className="mono-text">종료 상태</span>;
        }

        return (
          <div className="table-actions">
            {transitions.map((transition) => (
              <button
                key={transition}
                type="button"
                className={`action-btn ${ACTION_TONES[transition]}`}
                onClick={() => openReviewModal(row, transition)}
                disabled={Boolean(mutatingKey)}
              >
                {ACTION_LABELS[transition]}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      `${row.id} ${row.requesterUid} ${row.targetUid} ${row.reason ?? ""} ${row.reviewComment ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [rows, keyword]);

  return (
    <>
      <PageScaffold title="삭제 요청" description="계정 삭제 요청을 검토하고 상태를 전이합니다.">
        <div className="toolbar toolbar-grid">
          <label>
            목록 상태 필터
            <select value={status} onChange={(event) => setStatus(event.target.value as DeletionRequestStatus | "")}>
              <option value="">전체</option>
              {DELETION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            검색
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="요청ID / requester / target / 사유"
            />
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
          emptyText="삭제 요청 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(reviewTarget)}
        title="삭제 요청 상태 변경"
        description={
          reviewTarget
            ? `요청(${reviewTarget.id}) 상태를 ${ACTION_LABELS[nextStatus]}으로 변경합니다.`
            : undefined
        }
        submitLabel={ACTION_LABELS[nextStatus]}
        submitTone={ACTION_TONES[nextStatus]}
        submitting={mutatingKey === "review-deletion-request"}
        onClose={() => setReviewTarget(null)}
        onSubmit={(event) => void submitReviewModal(event)}
      >
        <p className="modal-inline-text">
          대상 UID: <span className="mono-text">{reviewTarget?.targetUid ?? "-"}</span>
        </p>
        <label>
          검토 코멘트 (선택)
          <textarea
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder="처리 사유 또는 메모를 입력해 주세요."
          />
        </label>
      </ActionModal>
    </>
  );
}
