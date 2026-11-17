import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { writeAuditLog } from "../../shared/audit-logs";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { isAppRole, isUserStatus, type AppRole, type UserStatus } from "../../shared/roles";
import { serializeForCallable } from "../../shared/serialize";

interface ListUsersInput {
  limit?: number;
  role?: AppRole;
  status?: UserStatus;
}

interface GetUserInput {
  uid: string;
}

interface SetUserRoleInput {
  uid: string;
  role: AppRole;
}

interface SetUserStatusInput {
  uid: string;
  status: UserStatus;
}

type DeleteUserMode = "anonymize" | "hard_delete";

interface DeleteOrAnonymizeUserInput {
  uid: string;
  mode?: DeleteUserMode;
  deleteAuth?: boolean;
  reason?: string;
}

interface DeleteOrAnonymizeUserResult {
  uid: string;
  mode: DeleteUserMode;
  userDeleted: boolean;
  authDeleted: boolean;
  membershipsAffected: number;
  deletionRequestsUpdated: number;
}

type BatchOperation = (batch: FirebaseFirestore.WriteBatch) => void;

function isDeleteUserMode(value: unknown): value is DeleteUserMode {
  return value === "anonymize" || value === "hard_delete";
}

async function commitBatchOperations(
  db: FirebaseFirestore.Firestore,
  operations: BatchOperation[],
  chunkSize = 400
): Promise<void> {
  for (let i = 0; i < operations.length; i += chunkSize) {
    const batch = db.batch();
    const slice = operations.slice(i, i + chunkSize);
    slice.forEach((operation) => operation(batch));
    await batch.commit();
  }
}

function anonymizedIdentifier(uid: string): string {
  return `deleted:${uid}`;
}

async function deleteAuthUser(uid: string): Promise<boolean> {
  try {
    await getAuth().deleteUser(uid);
    return true;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";

    if (code === "auth/user-not-found") {
      return false;
    }
    throw error;
  }
}

export const adminListUsers = withSuperAdminCallable<ListUsersInput, { items: Array<Record<string, unknown>> }>(
  async ({ request }) => {
    const input = readInputObject(request.data ?? {});
    const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 100 }), 20, 100);
    const role = readString(input, "role", { required: false });
    const status = readString(input, "status", { required: false });

    if (role != null && !isAppRole(role)) {
      throw new Error("INVALID_ARGUMENT");
    }

    if (status != null && !isUserStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.users);

    if (role) {
      query = query.where("role", "==", role);
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    query = query.orderBy("updatedAt", "desc").limit(limit);

    const snapshot = await query.get();
    const items = snapshot.docs.map((doc) => serializeForCallable({ id: doc.id, ...doc.data() }));

    return { items };
  }
);

export const adminGetUser = withSuperAdminCallable<GetUserInput, { user: Record<string, unknown> }>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const uid = readString(input, "uid");
  if (!uid) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  const snapshot = await db.collection(COLLECTIONS.users).doc(uid).get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  return { user: serializeForCallable({ id: snapshot.id, ...snapshot.data() }) };
});

export const adminSetUserRole = withSuperAdminCallable<
  SetUserRoleInput,
  { uid: string; role: AppRole; membershipsSynced: number }
>(
  async ({ request, claims }) => {
    const input = readInputObject(request.data ?? {});
    const uid = readString(input, "uid");
    const role = readString(input, "role");

    if (!uid || !role || !isAppRole(role)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    const ref = db.collection(COLLECTIONS.users).doc(uid);
    let beforeData: Record<string, unknown> | null = null;

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) {
        throw new Error("NOT_FOUND");
      }
      beforeData = { id: snapshot.id, ...snapshot.data() };

      const currentRole = snapshot.data()?.role as AppRole | undefined;
      const superAdminProtected = snapshot.data()?.superAdminProtected === true;
      if ((currentRole === "super_admin" || superAdminProtected) && role !== "super_admin") {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      tx.update(ref, {
        role,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
    });

    let membershipsSynced = 0;
    if (role !== "super_admin") {
      const membershipsSnapshot = await db.collection(COLLECTIONS.memberships).where("uid", "==", uid).get();
      const membershipUpdateOperations: BatchOperation[] = membershipsSnapshot.docs
        .filter((doc) => doc.data()?.role !== role)
        .map(
          (doc): BatchOperation =>
            (batch) =>
              batch.update(doc.ref, {
                role,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: claims.uid,
              })
        );

      membershipsSynced = membershipUpdateOperations.length;
      await commitBatchOperations(db, membershipUpdateOperations);
    }

    await writeAuditLog({
      actorUid: claims.uid,
      actorRole: claims.role,
      action: "user.role.set",
      resourceType: COLLECTIONS.users,
      resourceId: uid,
      before: beforeData,
      after: {
        role,
      },
      metadata: {
        membershipsSynced,
      },
    });

    return { uid, role, membershipsSynced };
  }
);

export const adminSetUserStatus = withSuperAdminCallable<SetUserStatusInput, { uid: string; status: UserStatus }>(
  async ({ request, claims }) => {
    const input = readInputObject(request.data ?? {});
    const uid = readString(input, "uid");
    const status = readString(input, "status");

    if (!uid || !status || !isUserStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    const ref = db.collection(COLLECTIONS.users).doc(uid);
    let beforeData: Record<string, unknown> | null = null;
    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) {
        throw new Error("NOT_FOUND");
      }
      beforeData = { id: snapshot.id, ...snapshot.data() };

      const currentRole = snapshot.data()?.role as AppRole | undefined;
      const currentStatus = snapshot.data()?.status as UserStatus | undefined;
      const superAdminProtected = snapshot.data()?.superAdminProtected === true;
      if ((currentRole === "super_admin" || superAdminProtected) && currentStatus !== status) {
        throw new Error("PROTECTED_ROLE_TARGET");
      }

      tx.update(ref, {
        status,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: claims.uid,
      });
    });

    await writeAuditLog({
      actorUid: claims.uid,
      actorRole: claims.role,
      action: "user.status.set",
      resourceType: COLLECTIONS.users,
      resourceId: uid,
      before: beforeData,
      after: {
        status,
      },
    });

    return { uid, status };
  }
);

export const adminDeleteOrAnonymizeUser = withSuperAdminCallable<
  DeleteOrAnonymizeUserInput,
  DeleteOrAnonymizeUserResult
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const uid = readString(input, "uid");
  const modeRaw = readString(input, "mode", { required: false });
  const reason = readString(input, "reason", { required: false, allowEmpty: true });

  if (!uid) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (uid === claims.uid) {
    throw new Error("PERMISSION_DENIED");
  }

  const modeCandidate = modeRaw ?? "anonymize";
  if (!isDeleteUserMode(modeCandidate)) {
    throw new Error("INVALID_ARGUMENT");
  }
  const mode: DeleteUserMode = modeCandidate;

  const deleteAuthInput = input.deleteAuth;
  if (deleteAuthInput != null && typeof deleteAuthInput !== "boolean") {
    throw new Error("INVALID_ARGUMENT");
  }
  const shouldDeleteAuth = deleteAuthInput ?? (mode === "hard_delete");

  const db = getDb();
  const userRef = db.collection(COLLECTIONS.users).doc(uid);
  const userSnapshot = await userRef.get();
  if (!userSnapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const userData = userSnapshot.data() as { role?: AppRole; superAdminProtected?: boolean } | undefined;
  if (!userData?.role || !isAppRole(userData.role)) {
    throw new Error("INVALID_ARGUMENT");
  }
  if (userData.role === "super_admin" || userData.superAdminProtected === true) {
    throw new Error("PROTECTED_ROLE_TARGET");
  }

  const beforeData = { id: userSnapshot.id, ...userSnapshot.data() };

  const membershipsSnapshot = await db.collection(COLLECTIONS.memberships).where("uid", "==", uid).get();
  const membershipsAffected = membershipsSnapshot.size;

  let deletionRequestsUpdated = 0;
  let userDeleted = false;

  if (mode === "anonymize") {
    const operations: BatchOperation[] = [
      (batch) =>
        batch.update(userRef, {
          role: "worker",
          status: "disabled",
          displayName: "Deleted User",
          email: `${anonymizedIdentifier(uid)}@deleted.local`,
          phoneNumber: null,
          photoUrl: null,
          companyIds: [],
          projectIds: [],
          anonymizedAt: FieldValue.serverTimestamp(),
          anonymizedBy: claims.uid,
          anonymizedReason: reason ?? null,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: claims.uid,
        }),
      ...membershipsSnapshot.docs.map(
        (doc): BatchOperation =>
          (batch) =>
            batch.update(doc.ref, {
              status: "inactive",
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: claims.uid,
            })
      ),
    ];

    await commitBatchOperations(db, operations);
  } else {
    const [requesterSnapshot, targetSnapshot] = await Promise.all([
      db.collection(COLLECTIONS.deletionRequests).where("requesterUid", "==", uid).get(),
      db.collection(COLLECTIONS.deletionRequests).where("targetUid", "==", uid).get(),
    ]);

    const deletionRequestUpdates = new Map<string, Record<string, unknown>>();
    requesterSnapshot.docs.forEach((doc) => {
      const existing = deletionRequestUpdates.get(doc.id) ?? {};
      deletionRequestUpdates.set(doc.id, {
        ...existing,
        requesterUid: anonymizedIdentifier(uid),
      });
    });

    targetSnapshot.docs.forEach((doc) => {
      const existing = deletionRequestUpdates.get(doc.id) ?? {};
      deletionRequestUpdates.set(doc.id, {
        ...existing,
        targetUid: anonymizedIdentifier(uid),
        targetRole: "worker",
      });
    });

    deletionRequestsUpdated = deletionRequestUpdates.size;

    const operations: BatchOperation[] = [
      ...membershipsSnapshot.docs.map((doc): BatchOperation => (batch) => batch.delete(doc.ref)),
      ...Array.from(deletionRequestUpdates.entries()).map(
        ([requestId, data]): BatchOperation =>
          (batch) =>
            batch.update(db.collection(COLLECTIONS.deletionRequests).doc(requestId), {
              ...data,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: claims.uid,
            })
      ),
      (batch) => batch.delete(userRef),
    ];

    await commitBatchOperations(db, operations);
    userDeleted = true;
  }

  const authDeleted = shouldDeleteAuth ? await deleteAuthUser(uid) : false;

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: mode === "hard_delete" ? "user.delete" : "user.anonymize",
    resourceType: COLLECTIONS.users,
    resourceId: uid,
    before: beforeData,
    after:
      mode === "hard_delete"
        ? null
        : {
            role: "worker",
            status: "disabled",
            displayName: "Deleted User",
            email: `${anonymizedIdentifier(uid)}@deleted.local`,
          },
    metadata: {
      mode,
      shouldDeleteAuth,
      authDeleted,
      membershipsAffected,
      deletionRequestsUpdated,
      reason: reason ?? null,
    },
  });

  return {
    uid,
    mode,
    userDeleted,
    authDeleted,
    membershipsAffected,
    deletionRequestsUpdated,
  };
});
