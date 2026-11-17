#!/usr/bin/env node
const assert = require("node:assert/strict");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = process.env.SECURITY_TEST_PROJECT_ID ?? "tbm-application-v2";
const REGION = process.env.SECURITY_TEST_REGION ?? "asia-northeast3";
const RUNTIME_ENV = process.env.SECURITY_TEST_RUNTIME_ENV ?? "dev";
const ALLOWED_DOMAIN = process.env.SECURITY_TEST_ALLOWED_DOMAIN ?? "heinrix.com";
const API_KEY = process.env.FIREBASE_API_KEY;

if (!API_KEY) {
  throw new Error("FIREBASE_API_KEY is required");
}

const app =
  getApps()[0] ??
  initializeApp({
    projectId: PROJECT_ID,
  });
const auth = getAuth(app);
const db = getFirestore(app);

function asErrorMessage(error) {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function randomSuffix() {
  return `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

async function signInWithEmailAndPassword(email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const body = await response.json();
  if (!response.ok || body.error) {
    throw new Error(`signInWithPassword failed: ${JSON.stringify(body)}`);
  }
  if (!body.idToken) {
    throw new Error("ID token missing from signInWithPassword response");
  }
  return body.idToken;
}

async function callCallableRaw(name, payload, idToken) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  const headers = {
    "Content-Type": "application/json",
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ data: payload }),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  const callableError = body?.error;
  const success = response.ok && !callableError;

  return {
    success,
    httpStatus: response.status,
    body,
    errorStatus: typeof callableError?.status === "string" ? callableError.status : "",
    errorMessage: typeof callableError?.message === "string" ? callableError.message : "",
  };
}

function assertCallableDenied(result, expectedStatus, expectedMessageIncludes) {
  assert.equal(result.success, false);
  assert.equal(result.errorStatus, expectedStatus);
  if (expectedMessageIncludes) {
    assert.match(result.errorMessage, new RegExp(expectedMessageIncludes, "i"));
  }
}

async function firestoreCreateDocAsUser({ idToken, collection, documentId, fields }) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?documentId=${documentId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  const errorStatus = typeof body?.error?.status === "string" ? body.error.status : "";
  const errorMessage = typeof body?.error?.message === "string" ? body.error.message : "";

  return {
    success: response.ok,
    httpStatus: response.status,
    body,
    errorStatus,
    errorMessage,
  };
}

async function createUserWithClaims({ uid, email, password, claims }) {
  await auth.createUser({ uid, email, password, displayName: uid });
  await auth.setCustomUserClaims(uid, claims);
}

(async () => {
  const runId = randomSuffix();
  const now = new Date().toISOString();

  const uids = {
    callerSuperAdmin: `sec_sa_${runId}`,
    worker: `sec_worker_${runId}`,
    superNoMfa: `sec_nomfa_${runId}`,
    superWrongDomain: `sec_domain_${runId}`,
    superWrongEnv: `sec_env_${runId}`,
    protectedTarget: `sec_target_super_${runId}`,
  };

  const passwords = {
    callerSuperAdmin: `Sec!${runId}A`,
    worker: `Sec!${runId}B`,
    superNoMfa: `Sec!${runId}C`,
    superWrongDomain: `Sec!${runId}D`,
    superWrongEnv: `Sec!${runId}E`,
    protectedTarget: `Sec!${runId}F`,
  };

  const emails = {
    callerSuperAdmin: `${uids.callerSuperAdmin}@${ALLOWED_DOMAIN}`,
    worker: `${uids.worker}@example.com`,
    superNoMfa: `${uids.superNoMfa}@${ALLOWED_DOMAIN}`,
    superWrongDomain: `${uids.superWrongDomain}@example.com`,
    superWrongEnv: `${uids.superWrongEnv}@${ALLOWED_DOMAIN}`,
    protectedTarget: `${uids.protectedTarget}@${ALLOWED_DOMAIN}`,
  };

  const protectedUserDocPath = `users/${uids.protectedTarget}`;
  const workerBypassConfigKey = `sec_bypass_${runId}`;
  const workerBypassConfigPath = `systemConfigs/${workerBypassConfigKey}`;

  const cleanupAuthUids = Object.values(uids);
  const cleanupDocPaths = [protectedUserDocPath, workerBypassConfigPath];
  const summary = {
    runId,
    projectId: PROJECT_ID,
    region: REGION,
    runtimeEnv: RUNTIME_ENV,
    scenarios: [],
  };
  const guardCallableName = "adminDeleteOrAnonymizeUser";

  async function runScenario(name, fn) {
    try {
      const details = await fn();
      summary.scenarios.push({ name, result: "pass", details });
      return true;
    } catch (error) {
      summary.scenarios.push({ name, result: "fail", error: asErrorMessage(error) });
      return false;
    }
  }

  let hasFailure = false;

  try {
    await createUserWithClaims({
      uid: uids.callerSuperAdmin,
      email: emails.callerSuperAdmin,
      password: passwords.callerSuperAdmin,
      claims: {
        role: "super_admin",
        mfaVerified: true,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: uids.worker,
      email: emails.worker,
      password: passwords.worker,
      claims: {
        role: "worker",
        mfaVerified: false,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: uids.superNoMfa,
      email: emails.superNoMfa,
      password: passwords.superNoMfa,
      claims: {
        role: "super_admin",
        mfaVerified: false,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: uids.superWrongDomain,
      email: emails.superWrongDomain,
      password: passwords.superWrongDomain,
      claims: {
        role: "super_admin",
        mfaVerified: true,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: uids.superWrongEnv,
      email: emails.superWrongEnv,
      password: passwords.superWrongEnv,
      claims: {
        role: "super_admin",
        mfaVerified: true,
        environment: RUNTIME_ENV === "prod" ? "stg" : "prod",
      },
    });
    await createUserWithClaims({
      uid: uids.protectedTarget,
      email: emails.protectedTarget,
      password: passwords.protectedTarget,
      claims: {
        role: "super_admin",
        mfaVerified: true,
        environment: RUNTIME_ENV,
      },
    });

    await db.doc(protectedUserDocPath).set({
      role: "super_admin",
      status: "active",
      email: emails.protectedTarget,
      displayName: "Security Protected Target",
      companyIds: [],
      projectIds: [],
      superAdminProtected: true,
      createdAt: now,
      updatedAt: now,
      createdBy: uids.callerSuperAdmin,
      updatedBy: uids.callerSuperAdmin,
    });

    const [superAdminToken, workerToken, noMfaToken, wrongDomainToken, wrongEnvToken] = await Promise.all([
      signInWithEmailAndPassword(emails.callerSuperAdmin, passwords.callerSuperAdmin),
      signInWithEmailAndPassword(emails.worker, passwords.worker),
      signInWithEmailAndPassword(emails.superNoMfa, passwords.superNoMfa),
      signInWithEmailAndPassword(emails.superWrongDomain, passwords.superWrongDomain),
      signInWithEmailAndPassword(emails.superWrongEnv, passwords.superWrongEnv),
    ]);

    hasFailure =
      !(await runScenario("unauthenticated callable access is blocked", async () => {
        const result = await callCallableRaw(guardCallableName, {}, undefined);
        assertCallableDenied(result, "UNAUTHENTICATED", "Authentication required");
        return { httpStatus: result.httpStatus, errorStatus: result.errorStatus, errorMessage: result.errorMessage };
      })) || hasFailure;

    hasFailure =
      !(await runScenario("worker role cannot access super admin callable", async () => {
        const result = await callCallableRaw(guardCallableName, {}, workerToken);
        assertCallableDenied(result, "PERMISSION_DENIED", "Super admin permission required");
        return { httpStatus: result.httpStatus, errorStatus: result.errorStatus, errorMessage: result.errorMessage };
      })) || hasFailure;

    hasFailure =
      !(await runScenario("super_admin without mfa is blocked", async () => {
        const result = await callCallableRaw(guardCallableName, {}, noMfaToken);
        assertCallableDenied(result, "PERMISSION_DENIED", "Super admin MFA required");
        return { httpStatus: result.httpStatus, errorStatus: result.errorStatus, errorMessage: result.errorMessage };
      })) || hasFailure;

    hasFailure =
      !(await runScenario("super_admin with non-allowlisted domain is blocked", async () => {
        const result = await callCallableRaw(guardCallableName, {}, wrongDomainToken);
        assertCallableDenied(result, "PERMISSION_DENIED", "Super admin email domain not allowed");
        return { httpStatus: result.httpStatus, errorStatus: result.errorStatus, errorMessage: result.errorMessage };
      })) || hasFailure;

    hasFailure =
      !(await runScenario("super_admin with wrong environment claim is blocked", async () => {
        const result = await callCallableRaw(guardCallableName, {}, wrongEnvToken);
        assertCallableDenied(result, "PERMISSION_DENIED", "Super admin token environment does not match");
        return { httpStatus: result.httpStatus, errorStatus: result.errorStatus, errorMessage: result.errorMessage };
      })) || hasFailure;

    hasFailure =
      !(await runScenario("protected super admin account cannot be deleted", async () => {
        const result = await callCallableRaw(
          "adminDeleteOrAnonymizeUser",
          {
            uid: uids.protectedTarget,
            mode: "anonymize",
            deleteAuth: false,
            reason: "security-test",
          },
          superAdminToken
        );
        assert.equal(result.success, false);
        assert.ok(
          result.errorStatus === "FAILED_PRECONDITION" || result.errorStatus === "PERMISSION_DENIED",
          `Unexpected error status: ${result.errorStatus || "empty"}`
        );
        const targetSnapshot = await db.doc(protectedUserDocPath).get();
        assert.equal(targetSnapshot.exists, true);
        return {
          httpStatus: result.httpStatus,
          errorStatus: result.errorStatus,
          errorMessage: result.errorMessage,
          targetStillExists: targetSnapshot.exists,
        };
      })) || hasFailure;

    hasFailure =
      !(await runScenario("worker direct Firestore API write bypass is blocked", async () => {
        const result = await firestoreCreateDocAsUser({
          idToken: workerToken,
          collection: "systemConfigs",
          documentId: workerBypassConfigKey,
          fields: {
            category: { stringValue: "policy" },
            description: { stringValue: "security-test-direct-write" },
            value: { mapValue: { fields: { enabled: { booleanValue: true } } } },
          },
        });
        assert.equal(result.success, false);
        assert.equal(result.errorStatus, "PERMISSION_DENIED");
        return { httpStatus: result.httpStatus, errorStatus: result.errorStatus, errorMessage: result.errorMessage };
      })) || hasFailure;

    console.log("SECURITY_E2E_SUMMARY");
    console.log(JSON.stringify(summary, null, 2));

    if (hasFailure) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("SECURITY_E2E_FAILED");
    console.error(asErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await Promise.all(
      cleanupDocPaths.map(async (docPath) => {
        try {
          await db.doc(docPath).delete();
        } catch {
          // ignore cleanup failures
        }
      })
    );

    await Promise.all(
      cleanupAuthUids.map(async (uid) => {
        try {
          await auth.deleteUser(uid);
        } catch {
          // ignore cleanup failures
        }
      })
    );
  }
})();
