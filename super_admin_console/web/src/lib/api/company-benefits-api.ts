import { callCallable, isFunctionsReady, postFunctionJson } from "./functions-client";

export interface CompanyBenefit {
  purpose: "sales_support" | "internal_test";
  startsAt: string;
  endsAtExclusive: string | null;
  noExpiry: boolean;
  revision: number;
  reason: string;
}
export interface BenefitView {
  serverTime: string;
  benefit: CompanyBenefit | null;
  status: "not_configured" | "scheduled" | "active" | "expired" | "revoked";
  isInternalTestCompany: boolean;
  history: { id: string; action: string; reason: string; actorUid: string; createdAt: string; after: CompanyBenefit }[];
  billing: { freeCoinsRemaining: number; paidCoinsRemaining: number; reservedCoins: number } | null;
  coinHistory: { id: string; amount: number; reason: string; actorUid: string; createdAt: string; beforeFreeCoins: number; afterFreeCoins: number; transactionId: string }[];
}
export interface BenefitSummary {
  companyId: string;
  benefit: Omit<CompanyBenefit, "reason"> | null;
  status: BenefitView["status"];
}
export async function getCompanyBenefitSummaries(companies: { companyId: string; approvalRequestId: string }[]): Promise<{
  serverTime: string; items: BenefitSummary[];
}> {
  if (!isFunctionsReady) throw new Error("혜택 관리는 서버 연결이 필요합니다.");
  return callCallable("adminGetCompanyBenefitSummaries", { companies });
}
export const BENEFIT_STATUS_LABELS: Record<BenefitView["status"], string> = {
  not_configured: "미설정", scheduled: "시작 예정", active: "이용 중", expired: "만료", revoked: "종료됨",
};
export async function getCompanyBenefits(companyId: string, approvalRequestId: string): Promise<BenefitView> {
  if (!isFunctionsReady) throw new Error("혜택 관리는 서버 연결이 필요합니다.");
  return callCallable("adminGetCompanyBenefits", { companyId, approvalRequestId });
}
export async function saveCompanyBenefit(action: "grant" | "update" | "revoke", input: Record<string, unknown>) {
  if (!isFunctionsReady) throw new Error("혜택 관리는 서버 연결이 필요합니다.");
  const names = { grant: "adminGrantCompanyBenefit", update: "adminUpdateCompanyBenefit", revoke: "adminRevokeCompanyBenefit" };
  return callCallable(names[action], input);
}

export interface CoinGrantResult {
  companyId: string;
  amount: number;
  beforeFreeCoins: number;
  afterFreeCoins: number;
  initialFreeCoinsSeeded: number;
  transactionId: string;
  replayed: boolean;
}

export async function grantCompanyCoins(input: {
  companyId: string; approvalRequestId: string; requestId: string; amount: number; reason: string;
}): Promise<CoinGrantResult> {
  if (!isFunctionsReady) throw new Error("코인 지급은 서버 연결이 필요합니다.");
  return postFunctionJson("adminGrantCompanyCoins", input);
}
