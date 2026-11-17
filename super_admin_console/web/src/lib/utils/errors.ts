function errorCodeOf(error: unknown): string {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return "";
  }

  const value = (error as { code?: unknown }).code;
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function toActionErrorMessage(error: unknown, fallback: string): string {
  const code = errorCodeOf(error);

  if (code.includes("failed-precondition")) {
    return "보호 대상(super_admin) 데이터는 변경할 수 없습니다.";
  }

  if (code.includes("permission-denied")) {
    return "권한이 없습니다. super admin 계정으로 다시 확인해 주세요.";
  }

  if (code.includes("functions/not-found") || code.includes("unimplemented")) {
    return "필수 Firebase Functions가 배포되지 않았습니다.";
  }

  if (code.includes("not-found")) {
    return "대상 데이터가 존재하지 않습니다.";
  }

  if (code.includes("invalid-argument")) {
    return "입력값이 올바르지 않습니다.";
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    const raw = error.message;
    if (raw === "PROTECTED_ROLE_TARGET") {
      return "보호 대상(super_admin) 데이터는 변경할 수 없습니다.";
    }
    if (raw === "NOT_FOUND") {
      return "대상 데이터가 존재하지 않습니다.";
    }
    if (raw === "INVALID_ARGUMENT") {
      return "입력값이 올바르지 않습니다.";
    }
    if (raw === "PERMISSION_DENIED") {
      return "권한이 없습니다. super admin 계정으로 다시 확인해 주세요.";
    }
    if (raw === "FUNCTIONS_NOT_CONFIGURED") {
      return "Firebase Functions 설정이 필요합니다. `.env`와 Firebase 초기화를 확인해 주세요.";
    }
    return raw;
  }

  return fallback;
}
