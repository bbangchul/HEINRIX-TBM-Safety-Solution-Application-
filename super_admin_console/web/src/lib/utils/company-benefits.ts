import type { BenefitSummary } from "../api/company-benefits-api";

export function koreanBenefitDate(iso: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function benefitEndLabel(benefit: BenefitSummary["benefit"]): string {
  if (!benefit) return "미설정";
  if (benefit.noExpiry) return "기간 제한 없음";
  return benefit.endsAtExclusive
    ? `${koreanBenefitDate(new Date(Date.parse(benefit.endsAtExclusive) - 1).toISOString())}까지 (한국 시간)`
    : "종료일 확인 필요";
}

/** Advance server-derived status between refreshes, using a monotonic browser clock. */
export function benefitStatusAt(summary: Pick<BenefitSummary, "benefit" | "status">, serverNowMs: number): BenefitSummary["status"] {
  if (!summary.benefit || summary.status === "revoked" || !Number.isFinite(serverNowMs)) return summary.status;
  if (serverNowMs < Date.parse(summary.benefit.startsAt)) return "scheduled";
  if (!summary.benefit.noExpiry && summary.benefit.endsAtExclusive
    && serverNowMs >= Date.parse(summary.benefit.endsAtExclusive)) return "expired";
  return "active";
}
