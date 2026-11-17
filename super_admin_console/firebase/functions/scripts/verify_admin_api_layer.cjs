#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const modulesDir = path.join(rootDir, "src", "modules");

function walk(dir, result = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, result);
      continue;
    }
    result.push(fullPath);
  }
  return result;
}

function getCallablesFiles() {
  return walk(modulesDir).filter((filePath) => filePath.endsWith("callables.ts"));
}

function collectCallableExports(content) {
  const exports = [];
  const regex = /export const\s+([A-Za-z0-9_]+)\s*=\s*([A-Za-z0-9_]+)\s*</g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    exports.push({
      name: match[1],
      wrapper: match[2],
    });
  }
  return exports;
}

const violations = [];
const callablesFiles = getCallablesFiles();

for (const filePath of callablesFiles) {
  const relative = path.relative(rootDir, filePath);
  const content = fs.readFileSync(filePath, "utf8");

  if (/export const\s+[A-Za-z0-9_]+\s*=\s*onCall\s*\(/.test(content)) {
    violations.push(`${relative}: direct onCall export is not allowed`);
  }

  const exports = collectCallableExports(content);
  if (exports.length === 0) {
    violations.push(`${relative}: no callable export found`);
    continue;
  }

  const invalidWrapperExports = exports.filter(
    ({ wrapper }) => wrapper !== "withSuperAdminCallable" && wrapper !== "withAuthenticatedCallable"
  );
  for (const item of invalidWrapperExports) {
    violations.push(`${relative}: ${item.name} uses unsupported wrapper "${item.wrapper}"`);
  }

  const inputReadCount = (content.match(/readInputObject\(request\.data \?\? \{\}\)/g) ?? []).length;
  if (inputReadCount < exports.length) {
    violations.push(
      `${relative}: readInputObject count(${inputReadCount}) is less than exported callable count(${exports.length})`
    );
  }
}

if (violations.length > 0) {
  console.error("Admin API layer verification failed:");
  for (const message of violations) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("OK: all callables use wrapper guards and input parsing standards.");
