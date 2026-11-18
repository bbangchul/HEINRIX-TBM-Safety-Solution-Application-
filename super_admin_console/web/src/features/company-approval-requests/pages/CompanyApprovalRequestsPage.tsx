import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  adminApi,
  type ReviewCompanyApprovalRequestInput,
} from "../../../lib/api/admin-api";
import type {
  CompanyApprovalRequestDoc,
  CompanyApprovalRequestStatus,
} from "../../../lib/types/firestore";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime } from "../../../lib/utils/formatters";

const COMPANY_APPROVAL_STATUSES: CompanyApprovalRequestStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
];

const ACTION_LABELS: Record<CompanyApprovalRequestStatus, string> = {
  pending: "승인대기",
  approved: "승인",
  rejected: "반려",
  cancelled: "취소",
};

const ACTION_TONES: Record<CompanyApprovalRequestStatus, "primary" | "danger" | "subtle"> = {
  pending: "subtle",
  approved: "primary",
  rejected: "danger",
  cancelled: "subtle",
};

const ALLOWED_TRANSITIONS: Record<CompanyApprovalRequestStatus, CompanyApprovalRequestStatus[]> = {
  pending: ["approved", "rejected"],
  approved: [],
  rejected: [],
  cancelled: [],
};

function canTransition(from: CompanyApprovalRequestStatus, to: CompanyApprovalRequestStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

function statusToneOf(
  status: CompanyApprovalRequestStatus
): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    case "rejected":
      return "danger";
    case "cancelled":
      return "neutral";
    default:
      return "neutral";
  }
}

export function CompanyApprovalRequestsPage() {
  const [status, setStatus] = useState<CompanyApprovalRequestStatus | "">("");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<CompanyApprovalRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<CompanyApprovalRequestDoc | null>(null);
  const [reviewTarget, setReviewTarget] = useState<CompanyApprovalRequestDoc | null>(null);
  const [nextStatus, setNextStatus] = useState<CompanyApprovalRequestStatus>("approved");
  const [rejectReason, setRejectReason] = useState("");

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const requests = await adminApi.listCompanyApprovalRequests({
        limit: 100,
        status: status || undefined,
      });
      setRows(requests);
    } catch (e) {
      setError(toActionErrorMessage(e, "회사 승인 요청 목록 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const openReviewModal = (row: CompanyApprovalRequestDoc, targetStatus: CompanyApprovalRequestStatus) => {
    if (!canTransition(row.status, targetStatus)) {
      setError("현재 상태에서는 해당 액션을 실행할 수 없습니다.");
      return;
    }

    setError(null);
    setReviewTarget(row);
    setNextStatus(targetStatus);
    setRejectReason("");
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    if (!canTransition(reviewTarget.status, nextStatus)) {
      setError("현재 상태에서는 해당 액션을 실행할 수 없습니다.");
      return;
    }
    if (nextStatus === "rejected" && rejectReason.trim().length === 0) {
      setError("반려 사유를 입력해 주세요.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey(`review-${reviewTarget.id}`);
      const payload: ReviewCompanyApprovalRequestInput = {
        requestId: reviewTarget.id,
        status: nextStatus,
        rejectReason: nextStatus === "rejected" ? rejectReason.trim() : undefined,
      };
      await adminApi.reviewCompanyApprovalRequest(payload);
      setSuccess(`회사 승인 요청(${reviewTarget.id})을 ${ACTION_LABELS[nextStatus]} 처리했습니다.`);
      setReviewTarget(null);
      await loadRequests();
    } catch (e) {
      setError(toActionErrorMessage(e, "회사 승인 요청 처리 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<CompanyApprovalRequestDoc>[] = [
    {
      key: "id",
      header: "요청 ID",
      render: (row) => <span className="mono-text">{row.id}</span>,
    },
    {
      key: "companyName",
      header: "회사",
      render: (row) => (
        <div>
          <strong>{row.companyName ?? row.companyId ?? "-"}</strong>
          {row.businessRegNoMasked && <div className="mono-text">{row.businessRegNoMasked}</div>}
        </div>
      ),
    },
    {
      key: "requester",
      header: "요청자",
      render: (row) => (
        <div>
          <strong>{row.requesterName ?? row.requesterUid}</strong>
          {row.requesterEmail && <div className="mono-text">{row.requesterEmail}</div>}
        </div>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (row) => <StatusBadge label={row.status} tone={statusToneOf(row.status)} />,
    },
    {
      key: "companyLink",
      header: "기존 회사 연결",
      render: (row) => <span className="mono-text">{row.existingCompanyId ?? row.approvedCompanyId ?? "-"}</span>,
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
      render: (row) => formatDateTime(row.submittedAt ?? row.createdAt),
    },
    {
      key: "actions",
      header: "액션",
      width: "180px",
      render: (row) => (
        <div className="table-actions">
          <button type="button" className="action-btn subtle" onClick={() => setDetailTarget(row)}>
            상세
          </button>
          {ALLOWED_TRANSITIONS[row.status].length === 0 ? (
            <span className="mono-text">{row.status === "approved" ? "승인 완료" : "종료 상태"}</span>
          ) : (
            ALLOWED_TRANSITIONS[row.status].map((transition) => (
              <button
                key={transition}
                type="button"
                className={`action-btn ${ACTION_TONES[transition]}`}
                onClick={() => openReviewModal(row, transition)}
                disabled={Boolean(mutatingKey)}
              >
                {ACTION_LABELS[transition]}
              </button>
            ))
          )}
        </div>
      ),
    },
  ];

  const filteredRows = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    if (!query) {
      return rows;
    }

    return rows.filter((row) =>
      `${row.id} ${row.companyName ?? ""} ${row.companyId} ${row.requesterUid} ${row.requesterName ?? ""} ${row.requesterEmail ?? ""} ${row.businessRegNoMasked ?? ""} ${row.rejectReason ?? ""}`
        .toLowerCase()
        .includes(query)
    );
  }, [rows, keyword]);

  return (
    <>
      <PageScaffold title="회사 승인 요청" description="회사 가입 승인 요청을 조회하고 승인 또는 반려합니다.">
        <p className="info-inline">승인된 회사의 무료 이용 혜택과 코인은 <Link className="text-link" to="/admin/billing">결제 관리</Link>에서 관리할 수 있습니다.</p>
        <div className="toolbar toolbar-grid">
          <label>
            목록 상태 필터
            <select value={status} onChange={(event) => setStatus(event.target.value as CompanyApprovalRequestStatus | "")}>
              <option value="">전체</option>
              {COMPANY_APPROVAL_STATUSES.map((item) => (
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
              placeholder="요청ID / 회사명 / 요청자 / 사업자번호"
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
          emptyText="회사 승인 요청 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(detailTarget)}
        title="회사 승인 요청 상세"
        description={detailTarget ? `요청(${detailTarget.id}) 상세 정보입니다.` : undefined}
        cancelLabel="닫기"
        onClose={() => setDetailTarget(null)}
      >
        <p className="modal-inline-text">
          회사 ID: <span className="mono-text">{detailTarget?.companyId ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          회사명: <span className="mono-text">{detailTarget?.companyName ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          요청자: <span className="mono-text">{detailTarget?.requesterName ?? detailTarget?.requesterUid ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          요청자 이메일: <span className="mono-text">{detailTarget?.requesterEmail ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          상태: <span className="mono-text">{detailTarget?.status ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          요청 시각: <span className="mono-text">{formatDateTime(detailTarget?.submittedAt ?? detailTarget?.createdAt)}</span>
        </p>
        <p className="modal-inline-text">
          검토자 UID: <span className="mono-text">{detailTarget?.reviewedBy ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          검토 시각: <span className="mono-text">{formatDateTime(detailTarget?.reviewedAt)}</span>
        </p>
        <p className="modal-inline-text">
          기존 회사 ID: <span className="mono-text">{detailTarget?.existingCompanyId ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          승인 회사 ID: <span className="mono-text">{detailTarget?.approvedCompanyId ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          사업자번호: <span className="mono-text">{detailTarget?.businessRegNoMasked ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          사업장 주소: <span className="mono-text">{detailTarget?.bizAddress ?? "-"}</span>
        </p>
        <label>
          반려 사유
          <textarea value={detailTarget?.rejectReason ?? ""} readOnly />
        </label>
      </ActionModal>

      <ActionModal
        open={Boolean(reviewTarget)}
        title="회사 승인 요청 처리"
        description={
          reviewTarget
            ? `요청(${reviewTarget.id})을 ${ACTION_LABELS[nextStatus]} 처리합니다.`
            : undefined
        }
        submitLabel={ACTION_LABELS[nextStatus]}
        submitTone={ACTION_TONES[nextStatus]}
        submitting={mutatingKey === `review-${reviewTarget?.id ?? ""}`}
        onClose={() => setReviewTarget(null)}
        onSubmit={(event) => {
          event.preventDefault();
          void submitReview();
        }}
      >
        <p className="modal-inline-text">
          회사명: <span className="mono-text">{reviewTarget?.companyName ?? reviewTarget?.companyId ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          요청자 UID: <span className="mono-text">{reviewTarget?.requesterUid ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          사업자번호: <span className="mono-text">{reviewTarget?.businessRegNoMasked ?? "-"}</span>
        </p>
        <p className="modal-inline-text">
          사업장 주소: <span className="mono-text">{reviewTarget?.bizAddress ?? "-"}</span>
        </p>
        {nextStatus === "rejected" && (
          <label>
            반려 사유
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="반려 사유를 입력해 주세요."
            />
          </label>
        )}
      </ActionModal>
    </>
  );
}
