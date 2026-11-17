#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const functionsRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(functionsRoot, "..", "..");

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mustContainText(content, text) {
  const pattern = new RegExp(escapeRegExp(text), "m");
  return pattern.test(content);
}

const checks = [];

const rulesPath = path.join(workspaceRoot, "firebase", "firestore", "firestore.rules");
const requireRolePath = path.join(functionsRoot, "src", "guards", "require-role.ts");
const callablePath = path.join(functionsRoot, "src", "shared", "callable.ts");
const webGuardPath = path.join(workspaceRoot, "web", "src", "features", "auth", "RequireSuperAdmin.tsx");

const rulesContent = read(rulesPath);
const requireRoleContent = read(requireRolePath);
const callableContent = read(callablePath);
const webGuardContent = read(webGuardPath);

checks.push({
  id: "rules: protected user delete blocked",
  ok: mustContainText(rulesContent, "allow delete: if isSuperAdmin() && !isProtectedUserDocument();"),
});
checks.push({
  id: "rules: audit log write blocked",
  ok: mustContainText(rulesContent, "allow create, update, delete: if false;"),
});
checks.push({
  id: "rules: system config write restricted to super_admin",
  ok: mustContainText(rulesContent, "allow create, update, delete: if isSuperAdmin();"),
});
checks.push({
  id: "rules: deletion target excludes protected users",
  ok: mustContainText(rulesContent, "deletionTargetNotProtected(request.resource.data.targetUid)"),
});
checks.push({
  id: "rules: default deny all fallback",
  ok: mustContainText(rulesContent, "allow read, write: if false;"),
});

checks.push({
  id: "function guard: role required",
  ok: mustContainText(requireRoleContent, 'throw new Error("SUPER_ADMIN_REQUIRED");'),
});
checks.push({
  id: "function guard: mfa required",
  ok: mustContainText(requireRoleContent, 'throw new Error("SUPER_ADMIN_MFA_REQUIRED");'),
});
checks.push({
  id: "function guard: domain allowlist required",
  ok: mustContainText(requireRoleContent, 'throw new Error("SUPER_ADMIN_DOMAIN_NOT_ALLOWED");'),
});
checks.push({
  id: "function guard: environment match required",
  ok: mustContainText(requireRoleContent, 'throw new Error("SUPER_ADMIN_ENVIRONMENT_MISMATCH");'),
});
checks.push({
  id: "callable wrapper: withSuperAdminCallable enforces requireSuperAdmin",
  ok: mustContainText(callableContent, "requireSuperAdmin(context.claims);"),
});

checks.push({
  id: "web guard: role gate enabled",
  ok: mustContainText(webGuardContent, "if (!hasRequiredRole(role, ADMIN_CONSOLE_ALLOWED_ROLES))"),
});
checks.push({
  id: "web guard: domain gate enabled",
  ok: mustContainText(webGuardContent, "if (!emailAllowed)"),
});
checks.push({
  id: "web guard: environment gate enabled",
  ok: mustContainText(webGuardContent, "if (!environmentAllowed)"),
});
checks.push({
  id: "web guard: mfa gate enabled",
  ok: mustContainText(webGuardContent, "if (!mfaVerified)"),
});

const failed = checks.filter((item) => !item.ok);

if (failed.length > 0) {
  console.error("Security control verification failed:");
  for (const item of failed) {
    console.error(`- ${item.id}`);
  }
  process.exit(1);
}

console.log("OK: security controls are present in rules, function guards, and web guard.");
