import { useEffect, useMemo, useState } from "react";
import { getCompanyBenefitSummaries, type BenefitSummary } from "../../../lib/api/company-benefits-api";
import type { CompanyApprovalRequestDoc } from "../../../lib/types/firestore";

export function useCompanyBenefitSummaries(rows: CompanyApprovalRequestDoc[], refresh: number) {
  const companies = useMemo(() => [...new Map(rows
    .filter(row => row.status === "approved" && row.approvedCompanyId)
    .map(row => [row.approvedCompanyId!, { companyId: row.approvedCompanyId!, approvalRequestId: row.id }])).values()], [rows]);
  const [summaries, setSummaries] = useState<Record<string, BenefitSummary>>({});
  const [error, setError] = useState(false);
  const [serverNow, setServerNow] = useState(Number.NaN);

  useEffect(() => {
    let cancelled = false;
    let sequence = 0;
    let clock: { server: number; local: number } | null = null;
    setSummaries({}); setError(false);
    if (!companies.length) return;
    async function load() {
      const current = ++sequence;
      try {
        const result = await getCompanyBenefitSummaries(companies);
        if (cancelled || current !== sequence) return;
        clock = { server: Date.parse(result.serverTime), local: performance.now() };
        setServerNow(clock.server);
        setSummaries(Object.fromEntries(result.items.map(item => [item.companyId, item])));
        setError(false);
      } catch { if (!cancelled && current === sequence) setError(true); }
    }
    void load();
    const poll = window.setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    const tick = window.setInterval(() => { if (clock) setServerNow(clock.server + performance.now() - clock.local); }, 1000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      cancelled = true; window.clearInterval(poll); window.clearInterval(tick);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [companies, refresh]);
  return { summaries, error, serverNow };
}
