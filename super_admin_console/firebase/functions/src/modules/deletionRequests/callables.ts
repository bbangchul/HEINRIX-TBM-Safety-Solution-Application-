import { FieldValue } from "firebase-admin/firestore";
import { withAuthenticatedCallable, withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import {
  DELETION_REQUEST_STATUSES,
  type DeletionRequestStatus,
} from "../../shared/firestore-schema";
import { assertNotProtectedRoleTarget } from "../../guards/require-role";
import { isAppRole, type AppRole } from "../../shared/roles";
import { writeAuditLog } from "../../shared/audit-logs";

interface CreateDeletionRequestInput {
  targetUid: string;
  targetRole: AppRole;
  reason?: string;
}

interface ListDeletionRequestsInput {
  limit?: number;
  status?: DeletionRequestStatus;
}

interface ReviewDeletionRequestInput {
  requestId: string;
  status: DeletionRequestStatus;
  reviewComment?: string;
}

interface CancelDeletionRequestInput {
  requestId: string;
}

const ALLOWED_ADMIN_REVIEW_TRANSITIONS: Record<DeletionRequestStatus, readonly DeletionRequestStatus[]> = {
  requested: ["in_review", "approved", "rejected", "cancelled"],
  in_review: ["approved", "rejected", "cancelled"],
  approved: ["completed", "cancelled"],
  rejected: [],
  completed: [],
  cancelled: [],
};

function isDeletionRequestStatus(value: unknown): value is DeletionRequestStatus {
  return (
    typeof value === "string" &&
    (DELETION_REQUEST_STATUSES as readonly string[]).includes(value)
  );
}

function canAdminReviewTransition(from: DeletionRequestStatus, to: DeletionRequestStatus): boolean {
  return ALLOWED_ADMIN_REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

export const createDeletionRequest = withAuthenticatedCallable<
  CreateDeletionRequestInput,
  { requestId: string; status: DeletionRequestStatus }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const targetUid = readString(input, "targetUid");
  const targetRole = readString(input, "targetRole");
  const reason = readString(input, "reason", { required: false, allowEmpty: true });

  if (!targetUid || !targetRole || !isAppRole(targetRole)) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  const targetUserSnapshot = await db.collection(COLLECTIONS.users).doc(targetUid).get();
  if (!targetUserSnapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const targetUserData = targetUserSnapshot.data() as { role?: AppRole; superAdminProtected?: boolean } | undefined;
  if (!targetUserData?.role || !isAppRole(targetUserData.role)) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (targetUserData.superAdminProtected === true) {
    throw new Error("PROTECTED_ROLE_TARGET");
  }

  assertNotProtectedRoleTarget(targetUserData.role);

  if (targetRole !== targetUserData.role) {
    throw new Error("INVALID_ARGUMENT");
  }

  const ref = db.collection(COLLECTIONS.deletionRequests).doc();
  const now = FieldValue.serverTimestamp();

  await ref.set({
    requesterUid: claims.uid,
    targetUid,
    targetRole: targetUserData.role,
    status: "requested",
    reason: reason ?? null,
    reviewComment: null,
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
    action: "deletion_request.create",
    resourceType: COLLECTIONS.deletionRequests,
    resourceId: ref.id,
    before: null,
    after: {
      requesterUid: claims.uid,
      targetUid,
      targetRole: targetUserData.role,
      status: "requested",
    },
  });

  return { requestId: ref.id, status: "requested" };
});

export const adminListDeletionRequests = withSuperAdminCallable<
  ListDeletionRequestsInput,
  { items: Array<Record<string, unknown>> }
>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 100 }), 20, 100);
  const status = readString(input, "status", { required: false });

  if (status != null && !isDeletionRequestStatus(status)) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.deletionRequests);

  if (status) {
    query = query.where("status", "==", status);
  }

  query = query.orderBy("createdAt", "desc").limit(limit);

  const snapshot = await query.get();
  return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

export const adminReviewDeletionRequest = withSuperAdminCallable<
  ReviewDeletionRequestInput,
  { requestId: string; status: DeletionRequestStatus }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const requestId = readString(input, "requestId");
  const status = readString(input, "status");
  const reviewComment = readString(input, "reviewComment", { required: false, allowEmpty: true });

  if (!requestId || !status || !isDeletionRequestStatus(status)) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  const ref = db.collection(COLLECTIONS.deletionRequests).doc(requestId);
  let beforeData: Record<string, unknown> | null = null;

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new Error("NOT_FOUND");
    }

    beforeData = { id: snapshot.id, ...snapshot.data() };
    const currentStatus = snapshot.data()?.status as DeletionRequestStatus | undefined;
    if (!currentStatus || !isDeletionRequestStatus(currentStatus)) {
      throw new Error("INVALID_ARGUMENT");
    }
    if (!canAdminReviewTransition(currentStatus, status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const targetRole = snapshot.data()?.targetRole as AppRole | undefined;
    if (!targetRole || !isAppRole(targetRole)) {
      throw new Error("INVALID_ARGUMENT");
    }

    assertNotProtectedRoleTarget(targetRole);

    const targetUid = snapshot.data()?.targetUid;
    if (typeof targetUid !== "string" || targetUid.trim().length === 0) {
      throw new Error("INVALID_ARGUMENT");
    }
    const targetUserSnapshot = await tx.get(db.collection(COLLECTIONS.users).doc(targetUid));
    if (targetUserSnapshot.exists) {
      const targetUserData = targetUserSnapshot.data() as { role?: AppRole; superAdminProtected?: boolean } | undefined;
      if (targetUserData?.superAdminProtected === true) {
        throw new Error("PROTECTED_ROLE_TARGET");
      }
      if (targetUserData?.role && isAppRole(targetUserData.role)) {
        assertNotProtectedRoleTarget(targetUserData.role);
      }
    }

    tx.update(ref, {
      status,
      reviewComment: reviewComment ?? null,
      reviewedBy: claims.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
  });

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "deletion_request.review",
    resourceType: COLLECTIONS.deletionRequests,
    resourceId: requestId,
    before: beforeData,
    after: {
      status,
      reviewedBy: claims.uid,
    },
  });

  return { requestId, status };
});

export const cancelDeletionRequest = withAuthenticatedCallable<
  CancelDeletionRequestInput,
  { requestId: string; status: DeletionRequestStatus }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const requestId = readString(input, "requestId");
  if (!requestId) {
    throw new Error("INVALID_ARGUMENT");
  }

  const ref = getDb().collection(COLLECTIONS.deletionRequests).doc(requestId);
  let beforeData: Record<string, unknown> | null = null;

  await getDb().runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new Error("NOT_FOUND");
    }

    beforeData = { id: snapshot.id, ...snapshot.data() };

    const data = snapshot.data() as {
      requesterUid?: string;
      status?: DeletionRequestStatus;
    };

    if (data.requesterUid !== claims.uid || data.status !== "requested") {
      throw new Error("PERMISSION_DENIED");
    }

    tx.update(ref, {
      status: "cancelled",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });
  });

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "deletion_request.cancel",
    resourceType: COLLECTIONS.deletionRequests,
    resourceId: requestId,
    before: beforeData,
    after: {
      status: "cancelled",
      updatedBy: claims.uid,
    },
  });

  return { requestId, status: "cancelled" };
});
