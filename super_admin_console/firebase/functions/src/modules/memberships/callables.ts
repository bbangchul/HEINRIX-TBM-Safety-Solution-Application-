import { FieldValue } from "firebase-admin/firestore";
import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { isAppRole, type AppRole } from "../../shared/roles";
import { assertNotProtectedRoleTarget } from "../../guards/require-role";
import { writeAuditLog } from "../../shared/audit-logs";
import { serializeForCallable } from "../../shared/serialize";

type MembershipStatus = "active" | "inactive";

interface ListMembershipsInput {
  limit?: number;
  uid?: string;
  companyId?: string;
  projectId?: string;
  role?: AppRole;
  status?: MembershipStatus;
}

interface UpsertMembershipInput {
  membershipId?: string;
  uid: string;
  companyId: string;
  projectId?: string;
  role: AppRole;
  status?: MembershipStatus;
}

interface DeleteMembershipInput {
  membershipId: string;
}

function isMembershipStatus(value: unknown): value is MembershipStatus {
  return value === "active" || value === "inactive";
}

function buildMembershipId(uid: string, companyId: string, projectId?: string): string {
  return [uid, companyId, projectId ?? "root"].join("_");
}

export const adminListMemberships = withSuperAdminCallable<
  ListMembershipsInput,
  { items: Array<Record<string, unknown>> }
>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 100 }), 20, 100);
  const uid = readString(input, "uid", { required: false });
  const companyId = readString(input, "companyId", { required: false });
  const projectId = readString(input, "projectId", { required: false });
  const role = readString(input, "role", { required: false });
  const status = readString(input, "status", { required: false });

  if (role != null && !isAppRole(role)) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (status != null && !isMembershipStatus(status)) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.memberships);

  if (uid) {
    query = query.where("uid", "==", uid);
  }

  if (companyId) {
    query = query.where("companyId", "==", companyId);
  }

  if (projectId) {
    query = query.where("projectId", "==", projectId);
  }

  if (role) {
    query = query.where("role", "==", role);
  }

  if (status) {
    query = query.where("status", "==", status);
  }

  query = query.orderBy("updatedAt", "desc").limit(limit);

  const snapshot = await query.get();
  return { items: snapshot.docs.map((doc) => serializeForCallable({ id: doc.id, ...doc.data() })) };
});

export const adminUpsertMembership = withSuperAdminCallable<
  UpsertMembershipInput,
  { membershipId: string }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const membershipIdInput = readString(input, "membershipId", { required: false });
  const uid = readString(input, "uid");
  const companyId = readString(input, "companyId");
  const projectId = readString(input, "projectId", { required: false, allowEmpty: true });
  const role = readString(input, "role");
  const status = readString(input, "status", { required: false }) ?? "active";

  if (!uid || !companyId || !role || !isAppRole(role) || !isMembershipStatus(status)) {
    throw new Error("INVALID_ARGUMENT");
  }

  assertNotProtectedRoleTarget(role);

  const membershipId = membershipIdInput ?? buildMembershipId(uid, companyId, projectId ?? undefined);
  const db = getDb();
  const ref = db.collection(COLLECTIONS.memberships).doc(membershipId);
  const now = FieldValue.serverTimestamp();

  let beforeData: Record<string, unknown> | null = null;

  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (snapshot.exists) {
      beforeData = { id: snapshot.id, ...snapshot.data() };
      const currentRole = snapshot.data()?.role as AppRole | undefined;
      if (currentRole) {
        assertNotProtectedRoleTarget(currentRole);
      }
    }

    tx.set(
      ref,
      {
        uid,
        companyId,
        projectId: projectId ?? null,
        role,
        status,
        updatedAt: now,
        updatedBy: claims.uid,
        createdAt: snapshot.exists ? snapshot.data()?.createdAt ?? now : now,
        createdBy: snapshot.exists ? snapshot.data()?.createdBy ?? claims.uid : claims.uid,
      },
      { merge: true }
    );
  });

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "membership.upsert",
    resourceType: COLLECTIONS.memberships,
    resourceId: membershipId,
    companyId,
    projectId: projectId ?? undefined,
    before: beforeData,
    after: {
      uid,
      companyId,
      projectId: projectId ?? null,
      role,
      status,
    },
  });

  return { membershipId };
});

export const adminDeleteMembership = withSuperAdminCallable<
  DeleteMembershipInput,
  { membershipId: string; deleted: true }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const membershipId = readString(input, "membershipId");
  if (!membershipId) {
    throw new Error("INVALID_ARGUMENT");
  }

  const ref = getDb().collection(COLLECTIONS.memberships).doc(membershipId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const data = snapshot.data() as { role?: AppRole; companyId?: string; projectId?: string };
  if (data.role && isAppRole(data.role)) {
    assertNotProtectedRoleTarget(data.role);
  }

  const before = { id: snapshot.id, ...snapshot.data() };

  await ref.delete();

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "membership.delete",
    resourceType: COLLECTIONS.memberships,
    resourceId: membershipId,
    companyId: data.companyId,
    projectId: data.projectId,
    before,
    after: null,
  });

  return { membershipId, deleted: true };
});
