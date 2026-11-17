import { useEffect, useRef, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { CompanyCoinGrantSection } from "./CompanyCoinGrantSection";
import { BENEFIT_STATUS_LABELS, getCompanyBenefits, saveCompanyBenefit, type BenefitView } from "../../../lib/api/company-benefits-api";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { benefitEndLabel, benefitStatusAt } from "../../../lib/utils/company-benefits";

export type BenefitSection = "benefit" | "revoke" | "coins" | "history";

function koreanDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function endDate(iso: string | null): string {
  return iso ? koreanDate(new Date(new Date(iso).getTime() - 1).toISOString()) : "";
}
const actionNames: Record<string, string> = { grant: "혜택 설정", update: "기간 변경", revoke: "즉시 종료" };

export function CompanyBenefitsModal({ companyId, approvalRequestId, companyName, onClose, initialSection = "benefit", onChanged }: {
  companyId: string; approvalRequestId: string; companyName: string; onClose: () => void;
  initialSection?: BenefitSection; onChanged?: () => void;
}) {
  const [view, setView] = useState<BenefitView | null>(null);
  const [purpose, setPurpose] = useState<"sales_support" | "internal_test">("sales_support");
  const [start, setStart] = useState(koreanDate(new Date().toISOString()));
  const [end, setEnd] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [coinBusy, setCoinBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [confirmEnd, setConfirmEnd] = useState(initialSection === "revoke");
  const [section, setSection] = useState<BenefitSection>(initialSection === "revoke" ? "benefit" : initialSection);
  const [serverNow, setServerNow] = useState(Number.NaN);
  const pending = useRef<{ signature: string; requestId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    getCompanyBenefits(companyId, approvalRequestId).then(data => {
      if (cancelled) return;
      setView(data);
      setPurpose(data.benefit?.purpose ?? "sales_support");
      setStart(data.benefit ? koreanDate(data.benefit.startsAt) : koreanDate(new Date().toISOString()));
      setEnd(endDate(data.benefit?.endsAtExclusive ?? null));
      setNoExpiry(data.benefit?.noExpiry === true && data.isInternalTestCompany);
    }).catch(e => { if (!cancelled) setError(toActionErrorMessage(e, "혜택 조회에 실패했습니다.")); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [companyId, approvalRequestId, reload]);

  useEffect(() => {
    if (!view) return;
    const server = Date.parse(view.serverTime);
    const local = performance.now();
    setServerNow(server);
    const timer = window.setInterval(() => setServerNow(server + performance.now() - local), 1000);
    return () => window.clearInterval(timer);
  }, [view]);

  const displayStatus = view ? benefitStatusAt(view, serverNow) : null;
  const editable = displayStatus === "active" || displayStatus === "scheduled";
  const canNoExpiry = view?.isInternalTestCompany && purpose === "internal_test";

  async function submit(action: "grant" | "update" | "revoke") {
    if (!view || busy || coinBusy) return;
    if (!reason.trim()) { setError("처리 사유를 입력해 주세요."); return; }
    const input = {
      companyId, approvalRequestId, expectedRevision: view.benefit?.revision ?? 0,
      reason: reason.trim(), ...(action === "revoke" ? {} : {
        purpose, startDate: start, endDate: noExpiry ? null : end, noExpiry,
      }),
    };
    const signature = JSON.stringify({ action, input });
    if (pending.current?.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() };
    setBusy(true); setError(null); setMessage("");
    try {
      await saveCompanyBenefit(action, { ...input, requestId: pending.current.requestId });
      // Preserve the request ID until success, including ambiguous network failures.
      pending.current = null;
      onChanged?.();
      setMessage(`${actionNames[action]}을 저장했습니다.`);
      setReason(""); setConfirmEnd(false);
      const latest = await getCompanyBenefits(companyId, approvalRequestId);
      setView(latest);
    } catch (e) {
      setError(toActionErrorMessage(e, "저장에 실패했습니다. 같은 입력으로 재시도할 수 있습니다."));
    } finally { setBusy(false); }
  }

  return <ActionModal open className="benefits-modal" title={`${companyName} 무료 이용 혜택`} cancelLabel="닫기" onClose={onClose}
    submitting={busy || coinBusy} disableSubmit={!view || busy || coinBusy || confirmEnd}
    submitLabel={editable ? "기간 변경 저장" : "무료 이용 설정 저장"}
    onSubmit={section === "benefit" ? event => { event.preventDefault(); void submit(editable ? "update" : "grant"); } : undefined}>
    <p>회사 ID: {companyId}</p>
    <p>현재 상태: {displayStatus ? BENEFIT_STATUS_LABELS[displayStatus] : "불러오는 중"}</p>
    {view && <p>현재 종료일: {benefitEndLabel(view.benefit)}</p>}
    <p>모든 유료 기능 제공 · 코인 차감 없음 · 종료일은 한국 시간 해당 날짜 끝까지</p>
    <p className="info-inline">무료 이용 기간에는 기존 코인 잔액을 보존하며, 종료 후에는 기존 구독·코인 이용 규칙이 적용됩니다.</p>
    {error && <p role="alert" className="error-inline">{error}</p>}
    {message && <p role="status" className="success-inline">{message}</p>}
    <button type="button" className="action-btn subtle" disabled={busy || coinBusy} onClick={() => { setError(null); setView(null); setReload(n => n + 1); }}>최신 상태 다시 불러오기</button>
    <div className="table-actions" role="tablist" aria-label="회사 혜택 관리">
      {([["benefit", "혜택 설정·기간 변경"], ["coins", "코인 지급"], ["history", "이력"]] as const).map(([key, label]) =>
        <button key={key} type="button" role="tab" aria-selected={section === key}
          className={`action-btn ${section === key ? "primary" : "subtle"}`} disabled={busy || coinBusy}
          onClick={() => { setSection(key); setConfirmEnd(false); }}>{label}</button>)}
    </div>
    {section === "benefit" && <fieldset disabled={busy || coinBusy || !view}>
      <label>제공 목적<select value={purpose} onChange={e => {
        setPurpose(e.target.value as typeof purpose); setNoExpiry(false);
      }}><option value="sales_support">영업 지원</option><option value="internal_test">내부 테스트</option></select></label>
      <label>시작일 (한국 시간)<input type="date" required value={start} onChange={e => setStart(e.target.value)} /></label>
      <label>종료일 (한국 시간)<input type="date" required={!noExpiry} disabled={noExpiry} min={start} value={end} onChange={e => setEnd(e.target.value)} /></label>
      {canNoExpiry && <label><input type="checkbox" checked={noExpiry} onChange={e => setNoExpiry(e.target.checked)} />기간 제한 없음</label>}
      <label>처리 사유<textarea required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
      {editable && <>
        <button type="button" className="action-btn danger" onClick={() => setConfirmEnd(true)}>즉시 종료</button>
        {confirmEnd && <div><p>이 회사의 무료 이용 혜택을 즉시 종료하시겠습니까?</p>
          <button type="button" className="action-btn danger" onClick={() => void submit("revoke")}>종료 확정</button>
          <button type="button" className="action-btn subtle" onClick={() => setConfirmEnd(false)}>취소</button></div>}
      </>}
    </fieldset>}
    {view && section === "coins" && <CompanyCoinGrantSection companyId={companyId} approvalRequestId={approvalRequestId}
      view={view} disabled={busy} onBusy={setCoinBusy}
      onRefresh={async () => { onChanged?.(); setView(await getCompanyBenefits(companyId, approvalRequestId)); }} />}
    {section === "history" && <>
    <h4>최근 혜택 변경 이력 (최대 30건)</h4>
    {view?.history.length === 0 && <p>변경 이력이 없습니다.</p>}
    {view?.history.map(event => <div key={event.id}>
      <strong>{actionNames[event.action] ?? event.action}</strong>
      <p>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간) · {event.actorUid}</p>
      <p>{event.reason}</p>
      <p>{koreanDate(event.after.startsAt)} ~ {event.after.noExpiry ? "기간 제한 없음" : endDate(event.after.endsAtExclusive)}</p>
    </div>)}
    <h4>최근 코인 지급 이력 (최대 30건)</h4>
    {view?.coinHistory?.length === 0 && <p>지급 이력이 없습니다.</p>}
    {view?.coinHistory?.map(event => <div key={event.id}>
      <strong>{event.amount}코인 지급 · {event.beforeFreeCoins} → {event.afterFreeCoins}</strong>
      <p>{event.reason} · {event.actorUid}</p>
      <p>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)</p>
    </div>)}
    </>}
  </ActionModal>;
}
