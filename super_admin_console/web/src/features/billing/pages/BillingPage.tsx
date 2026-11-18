import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import { adminApi } from "../../../lib/api/admin-api";
import { BENEFIT_STATUS_LABELS, type BenefitView } from "../../../lib/api/company-benefits-api";
import type { CompanyApprovalRequestDoc } from "../../../lib/types/firestore";
import { benefitEndLabel, benefitStatusAt } from "../../../lib/utils/company-benefits";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { CompanyBenefitsModal, type BenefitSection } from "./CompanyBenefitsModal";
import { useCompanyBenefitSummaries } from "./useCompanyBenefitSummaries";

export function BillingPage() {
  const [rows, setRows] = useState<CompanyApprovalRequestDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<BenefitView["status"] | "">("");
  const [target, setTarget] = useState<CompanyApprovalRequestDoc | null>(null);
  const [section, setSection] = useState<BenefitSection>("benefit");
  const [refresh, setRefresh] = useState(0);
  const benefits = useCompanyBenefitSummaries(rows, refresh);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const requests = await adminApi.listCompanyApprovalRequests({ status: "approved", limit: 100 });
      // The inbox is newest-first. One company may have multiple approved requests.
      const companies = new Map<string, CompanyApprovalRequestDoc>();
      for (const row of requests) {
        if (row.status === "approved" && row.approvedCompanyId && !companies.has(row.approvedCompanyId)) {
          companies.set(row.approvedCompanyId, row);
        }
      }
      setRows([...companies.values()]);
    } catch (e) { setError(toActionErrorMessage(e, "결제 관리 회사 목록을 불러오지 못했습니다.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = (row: CompanyApprovalRequestDoc, next: BenefitSection) => { setTarget(row); setSection(next); };
  const stateOf = (row: CompanyApprovalRequestDoc) => {
    const summary = benefits.summaries[row.approvedCompanyId!];
    return summary ? benefitStatusAt(summary, benefits.serverNow) : null;
  };
  const columns: DataColumn<CompanyApprovalRequestDoc>[] = [
    { key: "company", header: "회사", render: row => <div><strong>{row.companyName ?? row.approvedCompanyId}</strong>
      {row.businessRegNoMasked && <p>{row.businessRegNoMasked}</p>}</div> },
    { key: "companyId", header: "회사 ID", render: row => <span className="mono-text">{row.approvedCompanyId}</span> },
    { key: "benefit", header: "무료 이용 상태·종료일", render: row => {
      if (benefits.error) return <button className="action-btn subtle" onClick={() => setRefresh(n => n + 1)}>혜택 조회 재시도</button>;
      const summary = benefits.summaries[row.approvedCompanyId!];
      const state = stateOf(row);
      if (!summary || !state) return "혜택 조회 중...";
      return <div>
        <StatusBadge label={BENEFIT_STATUS_LABELS[state]} tone={state === "active" ? "success" : state === "scheduled" ? "info" : "neutral"} />
        <p>{benefitEndLabel(summary.benefit)}</p>
        {state === "active" && <small>전체 유료 기능 · 코인 차감 없음</small>}
      </div>;
    } },
    { key: "actions", header: "결제 관리", sticky: "right", render: row => {
      const state = stateOf(row);
      const editable = state === "active" || state === "scheduled";
      const unavailable = !state || benefits.error;
      return <div className="table-actions billing-actions">
        <button className="action-btn primary" disabled={unavailable || editable} onClick={() => open(row, "benefit")}>혜택 설정</button>
        <button className="action-btn subtle" disabled={unavailable || !editable} onClick={() => open(row, "benefit")}>기간 변경</button>
        <button className="action-btn danger" disabled={unavailable || !editable} onClick={() => open(row, "revoke")}>즉시 종료</button>
        <button className="action-btn subtle" onClick={() => open(row, "coins")}>코인 지급</button>
        <button className="action-btn subtle" onClick={() => open(row, "history")}>이력</button>
      </div>;
    } },
  ];
  const filtered = useMemo(() => rows.filter(row => {
    const matchesText = `${row.companyName ?? ""} ${row.approvedCompanyId} ${row.businessRegNoMasked ?? ""}`.toLowerCase().includes(keyword.trim().toLowerCase());
    const summary = benefits.summaries[row.approvedCompanyId!];
    return matchesText && (!status || (summary && benefitStatusAt(summary, benefits.serverNow) === status));
  }), [rows, keyword, status, benefits.summaries, benefits.serverNow]);

  return <>
    <PageScaffold title="결제 관리" description="승인된 회사의 무료 이용 기간, 코인 지급과 이력을 관리합니다.">
      <p className="info-inline">회사별로 한 번만 표시됩니다. 이용 기간은 한국 시간 기준이며 상태는 자동 갱신됩니다.</p>
      <div className="toolbar toolbar-grid">
        <label>회사 검색<input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="회사명 / 회사 ID / 사업자번호" /></label>
        <label>무료 이용 상태<select value={status} onChange={e => setStatus(e.target.value as typeof status)}>
          <option value="">전체</option>
          {Object.entries(BENEFIT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
      <div className="toolbar-actions"><button className="action-btn subtle" disabled={loading} onClick={() => { void load(); setRefresh(n => n + 1); }}>목록 새로고침</button></div>
      {error && <p className="error-inline" role="alert">{error}</p>}
      {benefits.error && <p className="error-inline" role="alert">혜택 상태 조회에 실패했습니다. 목록을 새로고침해 주세요.</p>}
      <DataTable columns={columns} rows={filtered} rowKey={row => row.approvedCompanyId!} loading={loading}
        emptyText={rows.length ? "검색 조건에 맞는 회사가 없습니다." : "승인된 회사가 없습니다."} />
    </PageScaffold>
    {target?.approvedCompanyId && <CompanyBenefitsModal key={`${target.id}-${section}`}
      companyId={target.approvedCompanyId} approvalRequestId={target.id} companyName={target.companyName ?? target.approvedCompanyId}
      initialSection={section} onChanged={() => setRefresh(n => n + 1)} onClose={() => setTarget(null)} />}
  </>;
}
