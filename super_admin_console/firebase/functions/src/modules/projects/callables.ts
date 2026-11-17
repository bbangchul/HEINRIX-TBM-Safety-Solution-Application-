import { FieldValue } from "firebase-admin/firestore";
import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { writeAuditLog } from "../../shared/audit-logs";

type ProjectStatus = "active" | "archived";

interface ListProjectsInput {
  limit?: number;
  companyId?: string;
  status?: ProjectStatus;
}

interface UpsertProjectInput {
  projectId?: string;
  companyId: string;
  name: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
}

interface ArchiveProjectInput {
  projectId: string;
}

function isProjectStatus(value: unknown): value is ProjectStatus {
  return value === "active" || value === "archived";
}

export const adminListProjects = withSuperAdminCallable<ListProjectsInput, { items: Array<Record<string, unknown>> }>(
  async ({ request }) => {
    const input = readInputObject(request.data ?? {});
    const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 100 }), 20, 100);
    const companyId = readString(input, "companyId", { required: false });
    const status = readString(input, "status", { required: false });

    if (status != null && !isProjectStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.projects);

    if (companyId) {
      query = query.where("companyId", "==", companyId);
    }

    if (status) {
      query = query.where("status", "==", status);
    }

    query = query.orderBy("updatedAt", "desc").limit(limit);

    const snapshot = await query.get();
    return { items: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const adminUpsertProject = withSuperAdminCallable<UpsertProjectInput, { projectId: string }>(
  async ({ request, claims }) => {
    const input = readInputObject(request.data ?? {});
    const projectId = readString(input, "projectId", { required: false });
    const companyId = readString(input, "companyId");
    const name = readString(input, "name");
    const status = readString(input, "status", { required: false }) ?? "active";
    const startDate = readString(input, "startDate", { required: false, allowEmpty: true });
    const endDate = readString(input, "endDate", { required: false, allowEmpty: true });

    if (!companyId || !name || !isProjectStatus(status)) {
      throw new Error("INVALID_ARGUMENT");
    }

    const db = getDb();
    const now = FieldValue.serverTimestamp();
    const payload = {
      companyId,
      name,
      status,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      updatedAt: now,
      updatedBy: claims.uid,
    };
    let resolvedProjectId: string;
    let before: Record<string, unknown> | null = null;

    if (projectId) {
      const snapshot = await db.collection(COLLECTIONS.projects).doc(projectId).get();
      before = snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
      await db.collection(COLLECTIONS.projects).doc(projectId).set(payload, { merge: true });
      resolvedProjectId = projectId;
    } else {
      const ref = db.collection(COLLECTIONS.projects).doc();
      await ref.set({
        ...payload,
        createdAt: now,
        createdBy: claims.uid,
      });
      resolvedProjectId = ref.id;
    }

    await writeAuditLog({
      actorUid: claims.uid,
      actorRole: claims.role,
      action: "project.upsert",
      resourceType: COLLECTIONS.projects,
      resourceId: resolvedProjectId,
      companyId,
      before,
      after: {
        companyId,
        name,
        status,
        startDate: startDate ?? null,
        endDate: endDate ?? null,
      },
    });

    return { projectId: resolvedProjectId };
  }
);

export const adminArchiveProject = withSuperAdminCallable<ArchiveProjectInput, { projectId: string; status: ProjectStatus }>(
  async ({ request, claims }) => {
    const input = readInputObject(request.data ?? {});
    const projectId = readString(input, "projectId");
    if (!projectId) {
      throw new Error("INVALID_ARGUMENT");
    }

    const ref = getDb().collection(COLLECTIONS.projects).doc(projectId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      throw new Error("NOT_FOUND");
    }
    const before = { id: snapshot.id, ...snapshot.data() };

    await ref.update({
      status: "archived",
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: claims.uid,
    });

    await writeAuditLog({
      actorUid: claims.uid,
      actorRole: claims.role,
      action: "project.archive",
      resourceType: COLLECTIONS.projects,
      resourceId: projectId,
      companyId: (snapshot.data()?.companyId as string | undefined) ?? undefined,
      before,
      after: {
        status: "archived",
      },
    });

    return { projectId, status: "archived" };
  }
);
