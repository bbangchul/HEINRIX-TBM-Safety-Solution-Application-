import { FieldValue } from "firebase-admin/firestore";
import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { writeAuditLog } from "../../shared/audit-logs";

interface ListCompaniesInput {
  limit?: number;
  status?: "active" | "inactive";
}

interface UpsertCompanyInput {
  companyId?: string;
  name: string;
  code: string;
  status?: "active" | "inactive";
}

interface SetCompanyStatusInput {
  companyId: string;
  status: "active" | "inactive";
}

function isCompanyStatus(value: unknown): value is "active" | "inactive" {
  return value === "active" || value === "inactive";
}

export const adminListCompanies = withSuperAdminCallable<ListCompaniesInput, { items: Array<Record<string, unknown>> }>(
  async ({ request }) => {
    const input = readInputObject(request.data ?? {});
    const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 100 }), 20, 100);
    const status = readString(input, "status", { required: false });

    if (status != null && !isCompanyStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.companies);
    if (status) {
      query = query.where("status", "==", status);
    }

    query = query.orderBy("updatedAt", "desc").limit(limit);

    const snapshot = await query.get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const adminUpsertCompany = withSuperAdminCallable<UpsertCompanyInput, { companyId: string }>(
  async ({ request, claims }) => {
    const input = readInputObject(request.data ?? {});
    const companyId = readString(input, "companyId", { required: false });
    const name = readString(input, "name");
    const code = readString(input, "code");
    const status = readString(input, "status", { required: false }) ?? "active";

    if (!name || !code || !isCompanyStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    const now = FieldValue.serverTimestamp();
    const payload = {
      name,
      code,
      status,
      updatedAt: now,
      updatedBy: claims.uid,
    };
    let resolvedCompanyId: string;
    let before: Record<string, unknown> | null = null;

    if (companyId) {
      const snapshot = await db.collection(COLLECTIONS.companies).doc(companyId).get();
      before = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
      await db.collection(COLLECTIONS.companies).doc(companyId).set(payload, { merge: true });
      resolvedCompanyId = companyId;
    } else {
      const ref = db.collection(COLLECTIONS.companies).doc();
      await ref.set({
        ...payload,
        createdAt: now,
        createdBy: claims.uid,
        ownerUid: claims.uid,
      });

      resolvedCompanyId = ref.id;
    }

    await writeAuditLog({
      actorUid: claims.uid,
      actorRole: claims.role,
      action: "company.upsert",
      resourceType: COLLECTIONS.companies,
      resourceId: resolvedCompanyId,
      before,
      after: {
        name,
        code,
        status,
      },
    });

    return { companyId: resolvedCompanyId };
  }
);

export const adminSetCompanyStatus = withSuperAdminCallable<SetCompanyStatusInput, { companyId: string; status: string }>(
  async ({ request, claims }) => {
    const input = readInputObject(request.data ?? {});
    const companyId = readString(input, "companyId");
    const status = readString(input, "status");

    if (!companyId || !status || !isCompanyStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const ref = getDb().collection(COLLECTIONS.companies).doc(companyId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new Error("NOT_FOUND");
    }
    const before = { id: snapshot.id, ...snapshot.data() };

    await ref.update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });

    await writeAuditLog({
      actorUid: claims.uid,
      actorRole: claims.role,
      action: "company.status.set",
      resourceType: COLLECTIONS.companies,
      resourceId: companyId,
      before,
      after: {
        status,
      },
    });

    return { companyId, status };
  }
);
