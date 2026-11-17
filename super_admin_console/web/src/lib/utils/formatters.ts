function isFirebaseTimestampLike(value: unknown): value is { seconds: number; nanoseconds?: number } {
  return typeof value === "object" && value !== null && "seconds" in value && typeof (value as { seconds: unknown }).seconds === "number";
}

export function formatDateTime(value: unknown): string {
  if (!value) {
    return "-";
  }

  if (value instanceof Date) {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toLocaleString();
    }
    return value;
  }

  if (isFirebaseTimestampLike(value)) {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  if (typeof value === "number") {
    return new Date(value).toLocaleString();
  }

  return "-";
}

export function stringifySafe(value: unknown): string {
  if (value == null) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
