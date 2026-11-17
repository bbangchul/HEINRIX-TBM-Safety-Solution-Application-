import { FieldValue } from "firebase-admin/firestore";
import type { AppRole } from "./roles";
import { COLLECTIONS } from "./collections";
import { getDb } from "./firebase-admin";

export interface AuditLogWriteInput {
  actorUid: string;
  actorRole: AppRole;
  action: string;
  resourceType: string;
  resourceId: string;
  companyId?: string;
  projectId?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAuditLog(input: AuditLogWriteInput): Promise<string> {
  const db = getDb();
  const ref = db.collection(COLLECTIONS.auditLogs).doc();

  await ref.set({
    actorUid: input.actorUid,
    actorRole: input.actorRole,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    companyId: input.companyId ?? null,
    projectId: input.projectId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    metadata: input.metadata ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}
