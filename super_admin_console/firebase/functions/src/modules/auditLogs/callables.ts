import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { isAppRole, type AppRole } from "../../shared/roles";

interface ListAuditLogsInput {
  limit?: number;
  actorUid?: string;
  actorRole?: AppRole;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  keyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

type UnknownRecord = Record<string, unknown>;

function includesIgnoreCase(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

function toKeywordTarget(data: UnknownRecord): string {
  return [
    data.actorUid ?? "",
    data.actorRole ?? "",
    data.action ?? "",
    data.resourceType ?? "",
    data.resourceId ?? "",
    data.companyId ?? "",
    data.projectId ?? "",
  ]
    .map((value) => String(value))
    .join(" ");
}

function parseDateBoundary(raw: string | undefined, boundary: "start" | "end"): Date | undefined {
  if (!raw) return undefined;

  const value = raw.trim();
  if (!value) return undefined;

  const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      throw new Error("INVALID_ARGUMENT");
    }

    if (boundary === "start") {
      return new Date(year, month - 1, day, 0, 0, 0, 0);
    }
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("INVALID_ARGUMENT");
  }

  return parsed;
}

export const adminListAuditLogs = withSuperAdminCallable<
  ListAuditLogsInput,
  { items: Array<Record<string, unknown>> }
>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 200 }), 30, 200);
  const actorUid = readString(input, "actorUid", { required: false });
  const actorRole = readString(input, "actorRole", { required: false });
  const action = readString(input, "action", { required: false });
  const resourceType = readString(input, "resourceType", { required: false });
  const resourceId = readString(input, "resourceId", { required: false });
  const keyword = readString(input, "keyword", { required: false, allowEmpty: true })?.trim() ?? "";
  const dateFromRaw = readString(input, "dateFrom", { required: false, allowEmpty: true });
  const dateToRaw = readString(input, "dateTo", { required: false, allowEmpty: true });
  const dateFrom = parseDateBoundary(dateFromRaw, "start");
  const dateTo = parseDateBoundary(dateToRaw, "end");

  if (actorRole != null && !isAppRole(actorRole)) {
    throw new Error("INVALID_ARGUMENT");
  }
  if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
    throw new Error("INVALID_ARGUMENT");
  }

  const shouldWidenFetch = Boolean(keyword || actorRole || resourceId || (resourceType && !resourceId) || (actorUid && action));
  const fetchLimit = shouldWidenFetch ? Math.min(200, Math.max(limit * 4, 120)) : limit;

  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.auditLogs);

  // Avoid over-relying on composite indexes by selecting only one indexed predicate.
  if (actorUid) {
    query = query.where("actorUid", "==", actorUid);
  } else if (action) {
    query = query.where("action", "==", action);
  } else if (resourceType && resourceId) {
    query = query.where("resourceType", "==", resourceType).where("resourceId", "==", resourceId);
  }

  if (dateFrom) {
    query = query.where("createdAt", ">=", dateFrom);
  }
  if (dateTo) {
    query = query.where("createdAt", "<=", dateTo);
  }

  query = query.orderBy("createdAt", "desc").limit(fetchLimit);
  const snapshot = await query.get();

  const items = snapshot.docs
    .map((doc): UnknownRecord => ({ id: doc.id, ...(doc.data() as UnknownRecord) }))
    .filter((row) => {
      if (actorUid && row["actorUid"] !== actorUid) return false;
      if (actorRole && row["actorRole"] !== actorRole) return false;
      if (action && row["action"] !== action) return false;
      if (resourceType && row["resourceType"] !== resourceType) return false;
      if (resourceId && row["resourceId"] !== resourceId) return false;
      if (keyword && !includesIgnoreCase(toKeywordTarget(row), keyword)) return false;
      return true;
    })
    .slice(0, limit);

  return { items };
});
