import { Timestamp } from "firebase-admin/firestore";

export type CompanyUsageBenefitPurpose = "sales_support" | "internal_test";
export type CompanyUsageBenefitStatus = "not_configured" | "scheduled" | "active" | "expired" | "revoked";

/** Stored at companies/{companyId}/usage_benefits/current. Paid subscriptions stay separate. */
export type CompanyUsageBenefit = {
  companyId: string;
  purpose: CompanyUsageBenefitPurpose;
  startsAt: Timestamp;
  endsAtExclusive: Timestamp | null;
  noExpiry: boolean;
  allPaidFeatures: true;
  waiveCoinCharges: true;
  reason: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
  revokedBy: string | null;
  revokedAt: Timestamp | null;
  revokeReason: string | null;
  revision: number;
};

export type CompanyUsageBenefitInput = {
  companyId: string;
  purpose: CompanyUsageBenefitPurpose;
  startDate: string;
  endDate: string | null;
  noExpiry: boolean;
  reason: string;
};

export class InvalidCompanyUsageBenefitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCompanyUsageBenefitError";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Strict calendar-date parsing; independent of the execution host's timezone. */
export function koreanDateStart(date: string): Timestamp {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new InvalidCompanyUsageBenefitError("Date must use YYYY-MM-DD.");
  }
  const utcMidnight = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(utcMidnight.getTime()) || utcMidnight.toISOString().slice(0, 10) !== date) {
    throw new InvalidCompanyUsageBenefitError("Invalid calendar date.");
  }
  try {
    return Timestamp.fromMillis(utcMidnight.getTime() - KST_OFFSET_MS);
  } catch {
    throw new InvalidCompanyUsageBenefitError("Date is outside the supported range.");
  }
}

/** actorUid, internal-test classification and now must come from trusted server context. */
export function createCompanyUsageBenefit(params: {
  input: CompanyUsageBenefitInput;
  actorUid: string;
  isInternalTestCompany: boolean;
  now?: Timestamp;
}): CompanyUsageBenefit {
  const { input } = params;
  const companyId = typeof input.companyId === "string" ? input.companyId.trim() : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  const actorUid = typeof params.actorUid === "string" ? params.actorUid.trim() : "";
  if (!companyId || companyId.includes("/") || companyId === "." || companyId === ".." || !actorUid || !reason) {
    throw new InvalidCompanyUsageBenefitError("Company ID, actor and reason are required.");
  }
  if (input.purpose !== "sales_support" && input.purpose !== "internal_test") {
    throw new InvalidCompanyUsageBenefitError("Invalid benefit purpose.");
  }
  if (typeof input.noExpiry !== "boolean") {
    throw new InvalidCompanyUsageBenefitError("noExpiry must be explicit.");
  }
  if (input.noExpiry && (input.purpose !== "internal_test" || params.isInternalTestCompany !== true)) {
    throw new InvalidCompanyUsageBenefitError("Only internal test companies may have no expiry.");
  }
  if (input.noExpiry && input.endDate !== null) {
    throw new InvalidCompanyUsageBenefitError("An unlimited period must have no end date.");
  }
  const startsAt = koreanDateStart(input.startDate);
  let endsAtExclusive: Timestamp | null = null;
  if (!input.noExpiry) {
    if (typeof input.endDate !== "string") {
      throw new InvalidCompanyUsageBenefitError("End date is required.");
    }
    const endStart = koreanDateStart(input.endDate);
    if (endStart.toMillis() < startsAt.toMillis()) {
      throw new InvalidCompanyUsageBenefitError("End date precedes start date.");
    }
    try {
      endsAtExclusive = Timestamp.fromMillis(endStart.toMillis() + DAY_MS);
    } catch {
      throw new InvalidCompanyUsageBenefitError("End date is outside the supported range.");
    }
  }
  const now = params.now ?? Timestamp.now();
  return {
    companyId, purpose: input.purpose, startsAt, endsAtExclusive,
    noExpiry: input.noExpiry, allPaidFeatures: true, waiveCoinCharges: true,
    reason, createdBy: actorUid, createdAt: now, updatedBy: actorUid, updatedAt: now,
    revokedBy: null, revokedAt: null, revokeReason: null, revision: 1,
  };
}

/** Server time is authoritative; expiry is exclusive and revocation takes precedence. */
export function resolveCompanyUsageBenefitStatus(
  benefit: CompanyUsageBenefit | null,
  now: Timestamp = Timestamp.now()
): CompanyUsageBenefitStatus {
  if (benefit === null) return "not_configured";
  if (benefit.revokedAt !== null) return "revoked";
  if (benefit.noExpiry !== true && benefit.noExpiry !== false) {
    throw new InvalidCompanyUsageBenefitError("Invalid stored noExpiry flag.");
  }
  if (benefit.noExpiry && (benefit.purpose !== "internal_test" || benefit.endsAtExclusive !== null)) {
    throw new InvalidCompanyUsageBenefitError("Invalid stored unlimited period.");
  }
  if (!benefit.noExpiry && (!benefit.endsAtExclusive || benefit.endsAtExclusive.toMillis() <= benefit.startsAt.toMillis())) {
    throw new InvalidCompanyUsageBenefitError("Invalid stored benefit period.");
  }
  if (now.toMillis() < benefit.startsAt.toMillis()) return "scheduled";
  if (benefit.endsAtExclusive !== null && now.toMillis() >= benefit.endsAtExclusive.toMillis()) return "expired";
  return "active";
}
