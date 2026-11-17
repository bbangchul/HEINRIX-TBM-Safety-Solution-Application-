import { CallableRequest, HttpsError, onCall } from "firebase-functions/v2/https";
import { normalizeClaims, type AuthClaims } from "../auth/claims";
import { requireSuperAdmin } from "../guards/require-role";

const DEFAULT_REGION = process.env.FUNCTION_REGION ?? "asia-northeast3";

type ErrorCode =
  | "ok"
  | "cancelled"
  | "unknown"
  | "invalid-argument"
  | "deadline-exceeded"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "resource-exhausted"
  | "failed-precondition"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "internal"
  | "unavailable"
  | "data-loss"
  | "unauthenticated";

const KNOWN_ERROR_MAP: Record<string, { code: ErrorCode; message: string }> = {
  UNAUTHENTICATED: { code: "unauthenticated", message: "Authentication required." },
  SUPER_ADMIN_REQUIRED: { code: "permission-denied", message: "Super admin permission required." },
  SUPER_ADMIN_MFA_REQUIRED: { code: "permission-denied", message: "Super admin MFA required." },
  SUPER_ADMIN_DOMAIN_NOT_ALLOWED: { code: "permission-denied", message: "Super admin email domain not allowed." },
  SUPER_ADMIN_ENVIRONMENT_MISMATCH: {
    code: "permission-denied",
    message: "Super admin token environment does not match runtime environment.",
  },
  PERMISSION_DENIED: { code: "permission-denied", message: "Permission denied." },
  PROTECTED_ROLE_TARGET: { code: "failed-precondition", message: "Protected role target." },
  INVALID_ARGUMENT: { code: "invalid-argument", message: "Invalid request payload." },
  NOT_FOUND: { code: "not-found", message: "Resource not found." },
  ALREADY_EXISTS: { code: "already-exists", message: "Resource already exists." },
};

export interface AuthenticatedCallableContext<TData = unknown> {
  request: CallableRequest<TData>;
  claims: AuthClaims;
}

export type AuthenticatedCallableHandler<TData = unknown, TResult = unknown> = (
  context: AuthenticatedCallableContext<TData>
) => Promise<TResult> | TResult;

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }

  if (error instanceof Error) {
    const mapped = KNOWN_ERROR_MAP[error.message];
    if (mapped) {
      return new HttpsError(mapped.code, mapped.message);
    }
    return new HttpsError("internal", error.message);
  }

  return new HttpsError("internal", "Unknown error.");
}

export function getClaimsFromRequest<TData>(request: CallableRequest<TData>): AuthClaims {
  if (!request.auth?.uid) {
    throw new Error("UNAUTHENTICATED");
  }

  const token = request.auth.token ?? {};
  const firebaseToken =
    typeof token.firebase === "object" && token.firebase !== null ? (token.firebase as Record<string, unknown>) : null;
  const hasSecondFactor =
    typeof firebaseToken?.sign_in_second_factor === "string" && firebaseToken.sign_in_second_factor.trim().length > 0;
  const hasMfaCustomClaim = token.mfaVerified === true;
  const mfaVerified = hasSecondFactor || hasMfaCustomClaim;
  const email = typeof token.email === "string" ? token.email : undefined;

  return normalizeClaims({
    uid: request.auth.uid,
    email,
    role: token.role,
    companyIds: token.companyIds,
    projectIds: token.projectIds,
    mfaVerified,
    environment: token.environment,
  });
}

export function withAuthenticatedCallable<TData = unknown, TResult = unknown>(
  handler: AuthenticatedCallableHandler<TData, TResult>
) {
  return onCall({ region: DEFAULT_REGION, cors: true }, async (request: CallableRequest<TData>): Promise<TResult> => {
    try {
      const claims = getClaimsFromRequest(request);
      return await handler({ request, claims });
    } catch (error) {
      throw toHttpsError(error);
    }
  });
}

export function withSuperAdminCallable<TData = unknown, TResult = unknown>(
  handler: AuthenticatedCallableHandler<TData, TResult>
) {
  return withAuthenticatedCallable<TData, TResult>(async (context) => {
    requireSuperAdmin(context.claims);
    return handler(context);
  });
}
