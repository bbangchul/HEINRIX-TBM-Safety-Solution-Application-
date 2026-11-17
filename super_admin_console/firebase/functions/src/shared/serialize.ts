import { GeoPoint, Timestamp } from "firebase-admin/firestore";

type UnknownRecord = Record<string, unknown>;

function isDocumentReferenceLike(value: unknown): value is { path: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    typeof (value as { path?: unknown }).path === "string"
  );
}

export function serializeForCallable<T = unknown>(value: T): T {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString() as T;
  }

  if (value instanceof Date) {
    return value.toISOString() as T;
  }

  if (value instanceof GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude } as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeForCallable(item)) as T;
  }

  if (isDocumentReferenceLike(value)) {
    return value.path as T;
  }

  if (typeof value === "object" && value !== null) {
    const serialized: UnknownRecord = {};
    for (const [key, entry] of Object.entries(value as UnknownRecord)) {
      const normalized = serializeForCallable(entry);
      if (normalized !== undefined) {
        serialized[key] = normalized;
      }
    }
    return serialized as T;
  }

  return value;
}
