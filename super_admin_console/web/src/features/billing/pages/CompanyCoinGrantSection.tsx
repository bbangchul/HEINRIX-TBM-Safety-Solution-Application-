import { useRef, useState } from "react";
import { grantCompanyCoins, type BenefitView } from "../../../lib/api/company-benefits-api";
import { toActionErrorMessage } from "../../../lib/utils/errors";

export function CompanyCoinGrantSection({ companyId, approvalRequestId, view, disabled, onBusy, onRefresh }: {
  companyId: string; approvalRequestId: string; view: BenefitView;
  disabled: boolean; onBusy: (busy: boolean) => void; onRefresh: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  const count = Number(amount);
  const valid = Number.isSafeInteger(count) && count > 0 && reason.trim().length > 0;

  async function submit() {
    if (!valid || disabled || inFlight.current) return;
    inFlight.current = true;
    setBusy(true); onBusy(true); setError(""); setMessage("");
    const input = { companyId, approvalRequestId, amount: count, reason: reason.trim() };
    const signature = JSON.stringify(input);
    if (pending.current?.signature !== signature) pending.current = { signature, requestId: crypto.randomUUID() };
    try {
      const result = await grantCompanyCoins({ ...input, requestId: pending.current.requestId });
      pending.current = null;
      setMessage(`${result.amount}코인 지급 완료 · 무료 코인 ${result.beforeFreeCoins} → ${result.afterFreeCoins}${result.initialFreeCoinsSeeded ? ` (기본 무료 ${result.initialFreeCoinsSeeded}코인 별도 초기화)` : ""}`);
      setAmount(""); setReason(""); setConfirmed(false);
      try { await onRefresh(); } catch {
        setError("지급은 완료됐지만 잔액 조회에 실패했습니다. 최신 상태를 다시 불러와 주세요.");
      }
    } catch (e) {
      setError(toActionErrorMessage(e, "지급에 실패했습니다. 같은 입력으로 재시도할 수 있습니다."));
    } finally { inFlight.current = false; setBusy(false); onBusy(false); }
  }

  return <section aria-label="코인 지급">
    <h4>무료 코인 지급 (만료일 없음)</h4>
    <p>{view.billing ? `무료 ${view.billing.freeCoinsRemaining} · 유료 ${view.billing.paidCoinsRemaining} · 예약 ${view.billing.reservedCoins}` : "과금 정보 미생성: 최초 지급 시 기본 무료 코인도 별도 초기화됩니다."}</p>
    {message && <p role="status" className="success-inline">{message}</p>}
    {error && <p role="alert" className="error-inline">{error}</p>}
    <fieldset disabled={busy || disabled}>
      <label>지급 코인 수량<input type="number" min="1" step="1" value={amount} onChange={e => { setAmount(e.target.value); setConfirmed(false); }} /></label>
      <label>코인 지급 사유<textarea maxLength={500} value={reason} onChange={e => { setReason(e.target.value); setConfirmed(false); }} /></label>
      {valid && view.billing && <p>지급 후 예상 무료 잔액: {view.billing.freeCoinsRemaining + count}코인</p>}
      <button type="button" className="action-btn primary" disabled={!valid} onClick={() => setConfirmed(true)}>코인 지급</button>
      {confirmed && <div>
        <p>이 회사에 만료일 없는 무료 코인 {count}개를 지급하시겠습니까?</p>
        <button type="button" className="action-btn primary" onClick={() => void submit()}>지급 확정</button>
        <button type="button" className="action-btn subtle" onClick={() => setConfirmed(false)}>지급 취소</button>
      </div>}
    </fieldset>
    <h4>최근 코인 지급 이력 (최대 30건)</h4>
    {view.coinHistory?.length === 0 && <p>지급 이력이 없습니다.</p>}
    {view.coinHistory?.map(event => <div key={event.id}>
      <strong>무료 {event.amount}코인 지급 · {event.beforeFreeCoins} → {event.afterFreeCoins}</strong>
      <p>{event.reason} · {event.actorUid}</p>
      <p>{new Date(event.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} (한국 시간)</p>
    </div>)}
  </section>;
}
