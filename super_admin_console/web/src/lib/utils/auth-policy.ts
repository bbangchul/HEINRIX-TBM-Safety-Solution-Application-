const DEFAULT_ALLOWED_SUPER_ADMIN_DOMAINS = ["heinrix.com"] as const;
const DEFAULT_ALLOWED_SUPER_ADMIN_EMAILS: string[] = [];
type EnvironmentName = "dev" | "stg" | "prod";

function normalizeDomain(value: string): string | undefined {
  const lowered = value.trim().toLowerCase();
  if (!lowered) return undefined;
  if (lowered === "*") return "*";
  if (!lowered.includes(".")) return undefined;
  return lowered;
}

function normalizeEmail(value: string): string | undefined {
  const lowered = value.trim().toLowerCase();
  const at = lowered.lastIndexOf("@");
  if (at <= 0 || at === lowered.length - 1) return undefined;
  const domain = normalizeDomain(lowered.slice(at + 1));
  if (!domain) return undefined;
  return `${lowered.slice(0, at)}@${domain}`;
}

function normalizeEnvironment(value: string): EnvironmentName | undefined {
  const lowered = value.trim().toLowerCase();
  if (lowered === "dev" || lowered === "stg" || lowered === "prod") {
    return lowered;
  }
  return undefined;
}

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [...DEFAULT_ALLOWED_SUPER_ADMIN_DOMAINS];
  }

  const parsed = raw
    .split(",")
    .map((value) => normalizeDomain(value))
    .filter((value): value is string => typeof value === "string");

  if (parsed.length === 0) {
    return [...DEFAULT_ALLOWED_SUPER_ADMIN_DOMAINS];
  }

  return Array.from(new Set(parsed));
}

function parseAllowedEmails(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [...DEFAULT_ALLOWED_SUPER_ADMIN_EMAILS];
  }

  const parsed = raw
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter((value): value is string => typeof value === "string");

  return Array.from(new Set(parsed));
}

function parseAllowedEnvironments(raw: string | undefined, fallback: EnvironmentName): EnvironmentName[] {
  if (!raw || raw.trim().length === 0) {
    return [fallback];
  }

  const parsed = raw
    .split(",")
    .map((value) => normalizeEnvironment(value))
    .filter((value): value is EnvironmentName => typeof value === "string");

  if (parsed.length === 0) {
    return [fallback];
  }

  return Array.from(new Set(parsed));
}

const allowedSuperAdminEmails = parseAllowedEmails(import.meta.env.VITE_SUPER_ADMIN_ALLOWED_EMAILS);
const allowAnyEmail = allowedSuperAdminEmails.includes("*");
const allowedSuperAdminDomains = parseAllowedDomains(import.meta.env.VITE_SUPER_ADMIN_ALLOWED_DOMAINS);
const allowAnyDomain = allowedSuperAdminDomains.includes("*");
const runtimeEnvironment = normalizeEnvironment(import.meta.env.VITE_APP_ENV ?? "") ?? "dev";
const allowedSuperAdminEnvironments = parseAllowedEnvironments(
  import.meta.env.VITE_SUPER_ADMIN_ALLOWED_ENVIRONMENTS,
  runtimeEnvironment
);

export function getAllowedSuperAdminDomains(): readonly string[] {
  return allowedSuperAdminDomains;
}

export function getAllowedSuperAdminDomainsLabel(): string {
  return allowAnyDomain ? "*" : allowedSuperAdminDomains.join(", ");
}

export function getAllowedSuperAdminEmails(): readonly string[] {
  return allowedSuperAdminEmails;
}

export function getAllowedSuperAdminIdentityLabel(): string {
  if (allowAnyEmail || allowAnyDomain) return "*";
  if (allowedSuperAdminEmails.length > 0) return allowedSuperAdminEmails.join(", ");
  return allowedSuperAdminDomains.join(", ");
}

export function getAllowedSuperAdminEnvironments(): readonly EnvironmentName[] {
  return allowedSuperAdminEnvironments;
}

export function getAllowedSuperAdminEnvironmentsLabel(): string {
  return allowedSuperAdminEnvironments.join(", ");
}

export function getEmailDomain(email: string | null | undefined): string | undefined {
  if (!email) return undefined;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return undefined;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isAllowedSuperAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email ?? "");
  if (allowAnyEmail) return true;
  if (allowedSuperAdminEmails.length > 0) {
    return typeof normalizedEmail === "string" && allowedSuperAdminEmails.includes(normalizedEmail);
  }
  if (allowAnyDomain) return true;
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return allowedSuperAdminDomains.includes(domain);
}

export function isAllowedSuperAdminEnvironment(environment: unknown): boolean {
  return (
    typeof environment === "string" &&
    (environment === "dev" || environment === "stg" || environment === "prod") &&
    allowedSuperAdminEnvironments.includes(environment)
  );
}

export function getPreferredHostedDomain(): string | undefined {
  if (allowedSuperAdminEmails.length > 0) return undefined;
  if (allowAnyDomain) return undefined;
  return allowedSuperAdminDomains[0];
}
