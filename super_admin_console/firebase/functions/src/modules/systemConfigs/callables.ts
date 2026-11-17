import { FieldValue } from "firebase-admin/firestore";
import { withSuperAdminCallable } from "../../shared/callable";
import { COLLECTIONS } from "../../shared/collections";
import { getDb } from "../../shared/firebase-admin";
import { clampLimit, readInputObject, readNumber, readString } from "../../shared/input";
import { writeAuditLog } from "../../shared/audit-logs";

interface ListSystemConfigsInput {
  limit?: number;
  category?: string;
  keyword?: string;
}

interface UpsertSystemConfigInput {
  configKey: string;
  category: string;
  value: unknown;
  description?: string;
}

interface UpdateSystemConfigInput {
  configKey: string;
  category?: string;
  value?: unknown;
  description?: string;
}

type UnknownRecord = Record<string, unknown>;

function includesIgnoreCase(value: string, keyword: string): boolean {
  return value.toLowerCase().includes(keyword.toLowerCase());
}

function timestampMillis(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (typeof value === "object" && value !== null && "seconds" in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    return typeof seconds === "number" ? seconds * 1000 : 0;
  }
  return 0;
}

export const adminListSystemConfigs = withSuperAdminCallable<
  ListSystemConfigsInput,
  { items: Array<Record<string, unknown>> }
>(async ({ request }) => {
  const input = readInputObject(request.data ?? {});
  const limit = clampLimit(readNumber(input, "limit", { required: false, min: 1, max: 200 }), 50, 200);
  const category = readString(input, "category", { required: false });
  const keyword = readString(input, "keyword", { required: false, allowEmpty: true })?.trim() ?? "";

  const db = getDb();
  let query: FirebaseFirestore.Query = db.collection(COLLECTIONS.systemConfigs);

  if (category) {
    query = query.where("category", "==", category).limit(200);
  } else {
    query = query.orderBy("updatedAt", "desc").limit(200);
  }

  const snapshot = await query.get();
  const items = snapshot.docs
    .map((doc): UnknownRecord => ({ id: doc.id, ...(doc.data() as UnknownRecord) }))
    .filter((row) => {
      if (category && row["category"] !== category) return false;
      if (!keyword) return true;
      const target = `${row["id"]} ${row["category"] ?? ""} ${row["description"] ?? ""} ${JSON.stringify(
        row["value"] ?? ""
      )}`;
      return includesIgnoreCase(target, keyword);
    })
    .sort((a, b) => timestampMillis(b["updatedAt"]) - timestampMillis(a["updatedAt"]))
    .slice(0, limit);

  return { items };
});

export const adminUpsertSystemConfig = withSuperAdminCallable<
  UpsertSystemConfigInput,
  { configKey: string; updated: boolean }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const configKey = readString(input, "configKey");
  const category = readString(input, "category");
  const description = readString(input, "description", { required: false, allowEmpty: true });

  if (!configKey || !category) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (!Object.prototype.hasOwnProperty.call(input, "value")) {
    throw new Error("INVALID_ARGUMENT");
  }
  const value = input.value;

  const db = getDb();
  const ref = db.collection(COLLECTIONS.systemConfigs).doc(configKey);
  const beforeSnapshot = await ref.get();
  const before = beforeSnapshot.exists ? { id: beforeSnapshot.id, ...beforeSnapshot.data() } : null;

  const payload = {
    category,
    value,
    description: description && description.length > 0 ? description : null,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: claims.uid,
  };

  if (beforeSnapshot.exists) {
    await ref.set(payload, { merge: true });
  } else {
    await ref.set({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: claims.uid,
    });
  }

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "system_config.upsert",
    resourceType: COLLECTIONS.systemConfigs,
    resourceId: configKey,
    before,
    after: {
      category,
      value,
      description: description && description.length > 0 ? description : null,
    },
  });

  return { configKey, updated: beforeSnapshot.exists };
});

export const adminUpdateSystemConfig = withSuperAdminCallable<
  UpdateSystemConfigInput,
  { configKey: string; updated: true }
>(async ({ request, claims }) => {
  const input = readInputObject(request.data ?? {});
  const configKey = readString(input, "configKey");

  if (!configKey) {
    throw new Error("INVALID_ARGUMENT");
  }

  const hasCategory = Object.prototype.hasOwnProperty.call(input, "category");
  const hasDescription = Object.prototype.hasOwnProperty.call(input, "description");
  const hasValue = Object.prototype.hasOwnProperty.call(input, "value");

  if (!hasCategory && !hasDescription && !hasValue) {
    throw new Error("INVALID_ARGUMENT");
  }

  const db = getDb();
  const ref = db.collection(COLLECTIONS.systemConfigs).doc(configKey);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error("NOT_FOUND");
  }

  const before = { id: snapshot.id, ...snapshot.data() };
  const updateData: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: claims.uid,
  };

  if (hasCategory) {
    const category = readString(input, "category");
    if (!category) {
      throw new Error("INVALID_ARGUMENT");
    }
    updateData.category = category;
  }

  if (hasDescription) {
    const description = readString(input, "description", { required: false, allowEmpty: true });
    updateData.description = description && description.length > 0 ? description : null;
  }

  if (hasValue) {
    updateData.value = input.value;
  }

  await ref.update(updateData);

  await writeAuditLog({
    actorUid: claims.uid,
    actorRole: claims.role,
    action: "system_config.update",
    resourceType: COLLECTIONS.systemConfigs,
    resourceId: configKey,
    before,
    after: updateData,
  });

  return { configKey, updated: true };
});
