import { isEnvironmentName, type EnvironmentName } from "./claims";

const DEFAULT_ALLOWED_SUPER_ADMIN_EMAIL_DOMAINS = ["heinrix.com"] as const;
const DEFAULT_ALLOWED_SUPER_ADMIN_EMAILS: string[] = [];
const ALLOWED_EMAILS_ENV_KEY = "SUPER_ADMIN_ALLOWED_EMAILS";
const ALLOWED_DOMAINS_ENV_KEY = "SUPER_ADMIN_ALLOWED_EMAIL_DOMAINS";
const APP_ENV_KEY = "APP_ENV";
const ALLOWED_ENVIRONMENTS_ENV_KEY = "SUPER_ADMIN_ALLOWED_ENVIRONMENTS";

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
  if (!isEnvironmentName(lowered)) {
    return undefined;
  }
  return lowered;
}

function parseAllowedDomains(raw: string | undefined): string[] {
  if (!raw || raw.trim().length === 0) {
    return [...DEFAULT_ALLOWED_SUPER_ADMIN_EMAIL_DOMAINS];
  }

  const parsed = raw
    .split(",")
    .map((value) => normalizeDomain(value))
    .filter((value): value is string => typeof value === "string");

  if (parsed.length === 0) {
    return [...DEFAULT_ALLOWED_SUPER_ADMIN_EMAIL_DOMAINS];
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

const allowedSuperAdminEmails = parseAllowedEmails(process.env[ALLOWED_EMAILS_ENV_KEY]);
const allowAnySuperAdminEmail = allowedSuperAdminEmails.includes("*");
const allowedSuperAdminEmailDomains = parseAllowedDomains(process.env[ALLOWED_DOMAINS_ENV_KEY]);
const allowAnySuperAdminDomain = allowedSuperAdminEmailDomains.includes("*");
const runtimeEnvironment = normalizeEnvironment(process.env[APP_ENV_KEY] ?? "") ?? "dev";
const allowedSuperAdminEnvironments = parseAllowedEnvironments(
  process.env[ALLOWED_ENVIRONMENTS_ENV_KEY],
  runtimeEnvironment
);

export function getAllowedSuperAdminEmailDomains(): readonly string[] {
  return allowedSuperAdminEmailDomains;
}

export function getAllowedSuperAdminEmails(): readonly string[] {
  return allowedSuperAdminEmails;
}

export function getEmailDomain(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const at = email.lastIndexOf("@");
  if (at < 0 || at === email.length - 1) return undefined;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isAllowedSuperAdminEmail(email: string | undefined): boolean {
  const normalizedEmail = normalizeEmail(email ?? "");
  if (allowAnySuperAdminEmail) return true;
  if (allowedSuperAdminEmails.length > 0) {
    return typeof normalizedEmail === "string" && allowedSuperAdminEmails.includes(normalizedEmail);
  }
  if (allowAnySuperAdminDomain) return true;
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return allowedSuperAdminEmailDomains.includes(domain);
}

export function getAllowedSuperAdminEnvironments(): readonly EnvironmentName[] {
  return allowedSuperAdminEnvironments;
}

export function isAllowedSuperAdminEnvironment(environment: unknown): boolean {
  return isEnvironmentName(environment) && allowedSuperAdminEnvironments.includes(environment);
}
