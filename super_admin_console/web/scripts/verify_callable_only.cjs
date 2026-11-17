#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "src");

const bannedPatterns = [
  /\b(addDoc|setDoc|updateDoc|deleteDoc|writeBatch|runTransaction)\b/,
];

function collectTsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = collectTsFiles(srcDir);
const violations = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const pattern of bannedPatterns) {
    if (pattern.test(content)) {
      violations.push(path.relative(rootDir, filePath));
      break;
    }
  }
}

if (violations.length > 0) {
  console.error("Callable-only policy violation detected:");
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log("OK: web/src avoids Firestore write APIs; callable actions remain the default policy.");
