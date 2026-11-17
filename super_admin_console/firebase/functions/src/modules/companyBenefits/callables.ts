import { createHash } from "node:crypto";
import { Timestamp, type Firestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { withSuperAdminCallable } from "../../shared/callable";
import { getDb } from "../../shared/firebase-admin";
import { serializeForCallable } from "../../shared/serialize";
import { readInputObject } from "../../shared/input";
import {
  createCompanyUsageBenefit, resolveCompanyUsageBenefitStatus,
  InvalidCompanyUsageBenefitError, type CompanyUsageBenefit,
  type CompanyUsageBenefitInput,
} from "./model";

type Action = "grant" | "update" | "revoke";
type Input = Record<string, unknown>;

function text(value: unknown, name: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpsError("invalid-argument", `${name}을 확인해 주세요.`);
  }
  return value.trim();
}

function id(value: unknown, name: string): string {
  const result = text(value, name, 128);
  if (result.includes("/") || result === "." || result === "..") {
    throw new HttpsError("invalid-argument", `${name}이 올바르지 않습니다.`);
  }
  return result;
}

async function approvedCompany(db: Firestore, input: Input, tx: FirebaseFirestore.Transaction) {
  const companyId = id(input.companyId, "회사 ID");
  const approvalRequestId = id(input.approvalRequestId, "승인 요청 ID");
  const [company, approval] = await Promise.all([
    tx.get(db.collection("companies").doc(companyId)),
    tx.get(db.collection("company_admin_conversion_requests").doc(approvalRequestId)),
  ]);
  if (!company.exists) throw new HttpsError("not-found", "회사를 찾을 수 없습니다.");
  if (!approval.exists || approval.get("status") !== "approved" || approval.get("approvedCompanyId") !== companyId) {
    throw new HttpsError("failed-precondition", "승인 완료된 회사만 설정할 수 있습니다.");
  }
  return { companyId, internal: company.get("isInternalTestCompany") === true };
}

export async function getCompanyBenefitsCore(db: Firestore, input: Input, clock: () => Timestamp = () => Timestamp.now()) {
  return db.runTransaction(async tx => {
    const { companyId, internal } = await approvedCompany(db, input, tx);
    const company = db.collection("companies").doc(companyId);
    const [current, history, billing, coinHistory] = await Promise.all([
      tx.get(company.collection("usage_benefits").doc("current")),
      tx.get(company.collection("usage_benefit_history").orderBy("createdAt", "desc").limit(30)),
      tx.get(company.collection("billing_profile").doc("billing_profile")),
      tx.get(company.collection("coin_grant_history").orderBy("createdAt", "desc").limit(30)),
    ]);
    const benefit = current.exists ? current.data() as CompanyUsageBenefit : null;
    const now = clock();
    return serializeForCallable({
      benefit, status: resolveCompanyUsageBenefitStatus(benefit, now), isInternalTestCompany: internal,
      serverTime: now,
      history: history.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      billing: billing.exists ? {
        freeCoinsRemaining: billing.get("freeCoinsRemaining"),
        paidCoinsRemaining: billing.get("paidCoinsRemaining"),
        reservedCoins: billing.get("reservedCoins"),
      } : null,
      coinHistory: coinHistory.docs.map(doc => ({
        id: doc.id, amount: doc.get("amount"), reason: doc.get("reason"),
        actorUid: doc.get("actorUid"), createdAt: doc.get("createdAt"),
        beforeFreeCoins: doc.get("beforeFreeCoins"), afterFreeCoins: doc.get("afterFreeCoins"),
        transactionId: doc.get("transactionId"),
      })),
    });
  });
}

export async function getCompanyBenefitSummariesCore(db: Firestore, input: Input) {
  if (!Array.isArray(input.companies) || input.companies.length > 100) {
    throw new HttpsError("invalid-argument", "회사 목록은 최대 100개까지 조회할 수 있습니다.");
  }
  const companies = input.companies.map(value => readInputObject(value));
  return db.runTransaction(async tx => {
    const items = await Promise.all(companies.map(async entry => {
      const { companyId } = await approvedCompany(db, entry, tx);
      const snapshot = await tx.get(db.collection("companies").doc(companyId).collection("usage_benefits").doc("current"));
      const benefit = snapshot.exists ? snapshot.data() as CompanyUsageBenefit : null;
      return { companyId, benefit };
    }));
    const now = Timestamp.now();
    return serializeForCallable({ serverTime: now, items: items.map(item => ({
      companyId: item.companyId,
      benefit: item.benefit ? {
        purpose: item.benefit.purpose, startsAt: item.benefit.startsAt,
        endsAtExclusive: item.benefit.endsAtExclusive, noExpiry: item.benefit.noExpiry,
        revision: item.benefit.revision,
      } : null,
      status: resolveCompanyUsageBenefitStatus(item.benefit, now),
    })) });
  });
}

export async function mutateCompanyBenefitCore(
  db: Firestore, action: Action, input: Input, actorUid: string,
  clock: () => Timestamp = () => Timestamp.now()
) {
  const requestId = id(input.requestId, "요청 ID");
  const reason = text(input.reason, "사유");
  const revision = input.expectedRevision;
  if (!Number.isSafeInteger(revision) || (revision as number) < 0) {
    throw new HttpsError("invalid-argument", "현재 변경 버전이 필요합니다.");
  }
  const payload = {
    action, companyId: id(input.companyId, "회사 ID"),
    approvalRequestId: id(input.approvalRequestId, "승인 요청 ID"),
    reason, revision, actorUid,
    ...(action === "revoke" ? {} : {
      purpose: input.purpose ?? null, startDate: input.startDate ?? null,
      endDate: input.endDate ?? null, noExpiry: input.noExpiry ?? null,
    }),
  };
  const fingerprint = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const eventId = createHash("sha256").update(requestId).digest("hex");
  return db.runTransaction(async tx => {
    const { companyId, internal } = await approvedCompany(db, input, tx);
    const company = db.collection("companies").doc(companyId);
    const currentRef = company.collection("usage_benefits").doc("current");
    const eventRef = company.collection("usage_benefit_history").doc(eventId);
    const [current, event] = await Promise.all([tx.get(currentRef), tx.get(eventRef)]);
    if (event.exists) {
      if (event.get("fingerprint") !== fingerprint) {
        throw new HttpsError("already-exists", "같은 요청 ID의 입력이 다릅니다.");
      }
      return serializeForCallable({ ...event.get("result"), replayed: true });
    }
    const before = current.exists ? current.data() as CompanyUsageBenefit : null;
    if ((before?.revision ?? 0) !== revision) {
      throw new HttpsError("aborted", "다른 관리자가 변경했습니다. 최신 상태를 다시 불러와 주세요.");
    }
    const now = clock();
    const status = resolveCompanyUsageBenefitStatus(before, now);
    if (action === "grant" && (status === "active" || status === "scheduled")) {
      throw new HttpsError("failed-precondition", "이미 혜택이 있습니다. 기간 변경을 사용해 주세요.");
    }
    if (action !== "grant" && status !== "active" && status !== "scheduled") {
      throw new HttpsError("failed-precondition", "시작 예정 또는 이용 중인 혜택만 변경·종료할 수 있습니다.");
    }
    let after: CompanyUsageBenefit;
    if (action === "revoke") {
      after = { ...before!, revokedAt: now, revokedBy: actorUid, revokeReason: reason,
        updatedAt: now, updatedBy: actorUid, revision: (revision as number) + 1 };
    } else {
      try {
        after = createCompanyUsageBenefit({
          input: { companyId, purpose: input.purpose, startDate: input.startDate,
            endDate: input.endDate, noExpiry: input.noExpiry, reason } as CompanyUsageBenefitInput,
          actorUid, isInternalTestCompany: internal, now,
        });
      } catch (error) {
        if (error instanceof InvalidCompanyUsageBenefitError) {
          throw new HttpsError("invalid-argument", error.message);
        }
        throw error;
      }
      if (after.endsAtExclusive && after.endsAtExclusive.toMillis() <= now.toMillis()) {
        throw new HttpsError("invalid-argument", "종료일은 오늘 이후로 지정해 주세요.");
      }
      after.revision = (revision as number) + 1;
      if (before) {
        after.createdAt = before.createdAt;
        after.createdBy = before.createdBy;
      }
    }
    const result = { companyId, benefit: after, status: resolveCompanyUsageBenefitStatus(after, now), historyId: eventId, replayed: false };
    tx.set(currentRef, after);
    tx.create(eventRef, { action, before, after, reason, actorUid, createdAt: now, requestId, fingerprint, result });
    return serializeForCallable(result);
  });
}

export const adminGetCompanyBenefits = withSuperAdminCallable<Input>(
  ({ request }) => getCompanyBenefitsCore(getDb(), readInputObject(request.data ?? {}))
);
export const adminGetCompanyBenefitSummaries = withSuperAdminCallable<Input>(
  ({ request }) => getCompanyBenefitSummariesCore(getDb(), readInputObject(request.data ?? {}))
);
export const adminGrantCompanyBenefit = withSuperAdminCallable<Input>(
  ({ request, claims }) => mutateCompanyBenefitCore(getDb(), "grant", readInputObject(request.data ?? {}), claims.uid)
);
export const adminUpdateCompanyBenefit = withSuperAdminCallable<Input>(
  ({ request, claims }) => mutateCompanyBenefitCore(getDb(), "update", readInputObject(request.data ?? {}), claims.uid)
);
export const adminRevokeCompanyBenefit = withSuperAdminCallable<Input>(
  ({ request, claims }) => mutateCompanyBenefitCore(getDb(), "revoke", readInputObject(request.data ?? {}), claims.uid)
);
