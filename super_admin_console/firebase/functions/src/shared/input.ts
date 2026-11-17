export type GenericInput = Record<string, unknown>;

export function readInputObject(value: unknown): GenericInput {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("INVALID_ARGUMENT");
  }
  return value as GenericInput;
}

export function readString(
  input: GenericInput,
  key: string,
  options?: { required?: boolean; allowEmpty?: boolean }
): string | undefined {
  const required = options?.required ?? true;
  const allowEmpty = options?.allowEmpty ?? false;
  const value = input[key];

  if (value == null) {
    if (required) {
      throw new Error("INVALID_ARGUMENT");
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("INVALID_ARGUMENT");
  }

  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) {
    throw new Error("INVALID_ARGUMENT");
  }

  return trimmed;
}

export function readNumber(
  input: GenericInput,
  key: string,
  options?: { required?: boolean; min?: number; max?: number }
): number | undefined {
  const required = options?.required ?? true;
  const value = input[key];

  if (value == null) {
    if (required) {
      throw new Error("INVALID_ARGUMENT");
    }
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (options?.min != null && value < options.min) {
    throw new Error("INVALID_ARGUMENT");
  }

  if (options?.max != null && value > options.max) {
    throw new Error("INVALID_ARGUMENT");
  }

  return value;
}

export function clampLimit(value: number | undefined, fallback = 20, max = 100): number {
  if (value == null) {
    return fallback;
  }
  if (value < 1) {
    return 1;
  }
  if (value > max) {
    return max;
  }
  return value;
}
