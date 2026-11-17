import { FieldValue } from "firebase-admin/firestore";
import { withAuthenticatedCallable, withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { writeAuditLog } from "../../shared/audit-logs";
import {
  COMPANY_APPROVAL_REQUEST_STATUSES,
  type CompanyApprovalRequestStatus,
} from "../../shared/firestore-schema";
import { sendCompanyApprovalRequestedPush } from "../../shared/push-notifications";
import { serializeForCallable } from "../../shared/serialize";

interface CreateCompanyApprovalRequestInput {
  companyId: string;
  requesterUid: string;
  reason?: string;
}

interface CreateCompanyApprovalRequestResult {
  requestId: string;
  status: "requested";
}

interface ListCompanyApprovalRequestsInput {
  limit?: number;
  status?: CompanyApprovalRequestStatus;
}

interface ReviewCompanyApprovalRequestInput {
  requestId: string;
  status: CompanyApprovalRequestStatus;
}

const ALLOWED_ADMIN_REVIEW_TRANSITIONS: Record<
  CompanyApprovalRequestStatus,
  readonly CompanyApprovalRequestStatus[]
> = {
  requested: ["approved", "rejected", "cancelled"],
  approved: [],
  rejected: [],
  cancelled: [],
};

function isCompanyApprovalRequestStatus(value: unknown): value is CompanyApprovalRequestStatus {
  return (
    typeof value === "string" &&
    (COMPANY_APPROVAL_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

function canAdminReviewTransition(from: CompanyApprovalRequestStatus, to: CompanyApprovalRequestStatus): boolean {
  return ALLOWED_ADMIN_REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

export const createCompanyApprovalRequest = withAuthenticatedCallable<
  CreateCompanyApprovalRequestInput,
  CreateCompanyApprovalRequestResult
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const companyId = readString(input, "companyId");
  const requesterUid = readString(input, "requesterUid");
  const reason = readString(input, "reason", { required: false, allowEmpty: true });

  if (!companyId || !requesterUid || requesterUid !== claims.uid) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (claims.role === "super_admin") {
    throw new Error("PERMISSION_DENIED");
  }

  const db = getDb();
  const companyRef = db.collection(COLLECTIONS.companies).doc(companyId);
  const companySnapshot = await companyRef.get();
  if (!companySnapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const companyData = companySnapshot.data() as { ownerUid?: string } | undefined;
  if (companyData?.ownerUid !== claims.uid) {
    throw new Error("PERMISSION_DENIED");
  }

  const existingRequestedSnapshot = await db
    .collection(COLLECTIONS.companyApprovalRequests)
    .where("companyId", "==", companyId)
    .where("status", "==", "requested")
    .limit(1)
    .get();
  if (!existingRequestedSnapshot.empty) {
    throw new Error("ALREADY_EXISTS");
  }

  const ref = db.collection(COLLECTIONS.companyApprovalRequests).doc();
  const now = FieldValue.serverTimestamp();

  await ref.set({
    companyId,
    requesterUid: claims.uid,
    status: "requested",
    reason: reason ?? null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
    createdBy: claims.uid,
    updatedBy: claims.uid,
  });

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "company_approval_request.create",
    resourceType: COLLECTIONS.companyApprovalRequests,
    resourceId: ref.id,
    companyId,
    before: null,
    after: {
      companyId,
      requesterUid: claims.uid,
      status: "requested",
    },
  });

  try {
    await sendCompanyApprovalRequestedPush({
      requestId: ref.id,
      companyId,
      requesterUid: claims.uid,
      reason: reason ?? null,
    });
  } catch (error) {
    console.error("[companyApprovalRequests] push dispatch failed", {
      requestId: ref.id,
      companyId,
      requesterUid: claims.uid,
      error,
    });
  }

  return { requestId: ref.id, status: "requested" };
});

export const adminListCompanyApprovalRequests = withSuperAdminCallable<
  ListCompanyApprovalRequestsInput,
  { items: Array<Record<string, unknown>> }
>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 100 }), 20, 100);
  const status = readString(input, "status", { required: false });

  if (status != null && !isCompanyApprovalRequestStatus(status)) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  if (!status) {
    const snapshot = await db
      .collection(COLLECTIONS.companyApprovalRequests)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return { items: snapshot.docs.map((doc) => serializeForCallable({ id: doc.id, ...doc.data() })) };
  }

  // Avoid requiring a composite index for status + createdAt by sorting in memory.
  const snapshot = await db
    .collection(COLLECTIONS.companyApprovalRequests)
    .where("status", "==", status)
    .get();

  const items = snapshot.docs
    .map((doc) => serializeForCallable({ id: doc.id, ...doc.data() }) as Record<string, unknown>)
    .sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")))
    .slice(0, limit);

  return { items };
});

export const adminReviewCompanyApprovalRequest = withSuperAdminCallable<
  ReviewCompanyApprovalRequestInput,
  { requestId: string; status: CompanyApprovalRequestStatus }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const requestId = readString(input, "requestId");
  const status = readString(input, "status");

  if (!requestId || !status || !isCompanyApprovalRequestStatus(status) || status === "requested") {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  const ref = db.collection(COLLECTIONS.companyApprovalRequests).doc(requestId);
  let beforeData: Record<string, unknown> | null = null;

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new Error("NOT_FOUND");
    }

    beforeData = serializeForCallable({ id: snapshot.id, ...snapshot.data() });
    const currentStatus = snapshot.data()?.status as CompanyApprovalRequestStatus | undefined;
    if (!currentStatus || !isCompanyApprovalRequestStatus(currentStatus)) {
      throw new Error("INVALID_ARGUMENT");
    }
    if (!canAdminReviewTransition(currentStatus, status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const companyId = snapshot.data()?.companyId;
    if (typeof companyId !== "string" || companyId.trim().length === 0) {
      throw new Error("INVALID_ARGUMENT");
    }

    const companySnapshot = await tx.get(db.collection(COLLECTIONS.companies).doc(companyId));
    if (!companySnapshot.exists) {
      throw new Error("NOT_FOUND");
    }

    tx.update(ref, {
      status,
      reviewedBy: claims.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
  });

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "company_approval_request.review",
    resourceType: COLLECTIONS.companyApprovalRequests,
    resourceId: requestId,
    before: beforeData,
    after: {
      status,
      reviewedBy: claims.uid,
    },
  });

  return { requestId, status };
});
