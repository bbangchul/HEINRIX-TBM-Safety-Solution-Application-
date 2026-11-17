#!/usr/bin/env node
const assert = require("node:assert/strict");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = process.env.REGRESSION_TEST_PROJECT_ID ?? "tbm-application-v2";
const REGION = process.env.REGRESSION_TEST_REGION ?? "asia-northeast3";
const RUNTIME_ENV = process.env.REGRESSION_TEST_RUNTIME_ENV ?? "dev";
const ALLOWED_DOMAIN = process.env.REGRESSION_TEST_ALLOWED_DOMAIN ?? "heinrix.com";
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

async function callCallable(name, payload, idToken) {
  const url = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${name}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data: payload }),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }

  if (!response.ok || body?.error) {
    throw new Error(`${name} failed: ${JSON.stringify(body)}`);
  }
  return body.result ?? body.data ?? body;
}

async function createUserWithClaims({ uid, email, password, claims }) {
  await auth.createUser({ uid, email, password, displayName: uid });
  await auth.setCustomUserClaims(uid, claims);
}

(async () => {
  const runId = randomSuffix();
  const now = new Date().toISOString();
  const testCompanyId = `reg_company_${runId}`;
  const testProjectId = `reg_project_${runId}`;

  const users = {
    superAdmin: {
      uid: `reg_sa_${runId}`,
      email: `reg_sa_${runId}@${ALLOWED_DOMAIN}`,
      password: `Reg!${runId}A`,
      role: "super_admin",
      protected: true,
    },
    requester: {
      uid: `reg_req_${runId}`,
      email: `reg_req_${runId}@example.com`,
      password: `Reg!${runId}B`,
      role: "worker",
      protected: false,
    },
    deletionTarget: {
      uid: `reg_del_target_${runId}`,
      email: `reg_del_target_${runId}@example.com`,
      password: `Reg!${runId}C`,
      role: "worker",
      protected: false,
    },
    roleTarget: {
      uid: `reg_role_target_${runId}`,
      email: `reg_role_target_${runId}@example.com`,
      password: `Reg!${runId}D`,
      role: "worker",
      protected: false,
    },
  };

  const roleTargetMembershipId = `${users.roleTarget.uid}_${testCompanyId}_${testProjectId}`;
  const cleanupDocPaths = [
    `users/${users.superAdmin.uid}`,
    `users/${users.requester.uid}`,
    `users/${users.deletionTarget.uid}`,
    `users/${users.roleTarget.uid}`,
    `memberships/${roleTargetMembershipId}`,
  ];
  const cleanupAuthUids = Object.values(users).map((user) => user.uid);
  let deletionRequestId = "";

  const summary = {
    runId,
    projectId: PROJECT_ID,
    region: REGION,
    runtimeEnv: RUNTIME_ENV,
    flows: {
      login: null,
      roleChange: null,
      deletionReview: null,
    },
  };

  try {
    await createUserWithClaims({
      uid: users.superAdmin.uid,
      email: users.superAdmin.email,
      password: users.superAdmin.password,
      claims: {
        role: "super_admin",
        mfaVerified: true,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: users.requester.uid,
      email: users.requester.email,
      password: users.requester.password,
      claims: {
        role: "worker",
        mfaVerified: false,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: users.deletionTarget.uid,
      email: users.deletionTarget.email,
      password: users.deletionTarget.password,
      claims: {
        role: "worker",
        mfaVerified: false,
        environment: RUNTIME_ENV,
      },
    });
    await createUserWithClaims({
      uid: users.roleTarget.uid,
      email: users.roleTarget.email,
      password: users.roleTarget.password,
      claims: {
        role: "worker",
        mfaVerified: false,
        environment: RUNTIME_ENV,
      },
    });

    await Promise.all(
      Object.values(users).map((user) =>
        db.doc(`users/${user.uid}`).set({
          role: user.role,
          status: "active",
          email: user.email,
          displayName: user.uid,
          companyIds: [testCompanyId],
          projectIds: [testProjectId],
          superAdminProtected: user.protected,
          createdAt: now,
          updatedAt: now,
          createdBy: users.superAdmin.uid,
          updatedBy: users.superAdmin.uid,
        })
      )
    );

    await db.doc(`memberships/${roleTargetMembershipId}`).set({
      uid: users.roleTarget.uid,
      companyId: testCompanyId,
      projectId: testProjectId,
      role: "worker",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: users.superAdmin.uid,
      updatedBy: users.superAdmin.uid,
    });

    const superAdminToken = await signInWithEmailAndPassword(users.superAdmin.email, users.superAdmin.password);
    const requesterToken = await signInWithEmailAndPassword(users.requester.email, users.requester.password);

    const loginProbe = await callCallable("adminListDeletionRequests", { limit: 5 }, superAdminToken);
    assert.ok(Array.isArray(loginProbe.items));
    summary.flows.login = {
      superAdminUid: users.superAdmin.uid,
      requesterUid: users.requester.uid,
      listProbeItems: loginProbe.items.length,
    };

    const roleResult = await callCallable(
      "adminSetUserRole",
      {
        uid: users.roleTarget.uid,
        role: "project_admin",
      },
      superAdminToken
    );
    assert.equal(roleResult.uid, users.roleTarget.uid);
    assert.equal(roleResult.role, "project_admin");
    assert.equal(typeof roleResult.membershipsSynced, "number");
    assert.ok(roleResult.membershipsSynced >= 1);

    const roleTargetDoc = await db.doc(`users/${users.roleTarget.uid}`).get();
    assert.equal(roleTargetDoc.exists, true);
    assert.equal(roleTargetDoc.data()?.role, "project_admin");

    const roleTargetMembershipDoc = await db.doc(`memberships/${roleTargetMembershipId}`).get();
    assert.equal(roleTargetMembershipDoc.exists, true);
    assert.equal(roleTargetMembershipDoc.data()?.role, "project_admin");

    summary.flows.roleChange = {
      uid: roleResult.uid,
      roleAfter: roleTargetDoc.data()?.role,
      membershipRoleAfter: roleTargetMembershipDoc.data()?.role,
      membershipsSynced: roleResult.membershipsSynced,
    };

    const createDeletionResult = await callCallable(
      "createDeletionRequest",
      {
        targetUid: users.deletionTarget.uid,
        targetRole: "worker",
        reason: "regression-e2e",
      },
      requesterToken
    );
    assert.equal(createDeletionResult.status, "requested");
    deletionRequestId = String(createDeletionResult.requestId ?? "");
    assert.ok(deletionRequestId.length > 0);

    const reviewResult = await callCallable(
      "adminReviewDeletionRequest",
      {
        requestId: deletionRequestId,
        status: "approved",
        reviewComment: "regression approved",
      },
      superAdminToken
    );
    assert.equal(reviewResult.requestId, deletionRequestId);
    assert.equal(reviewResult.status, "approved");

    const reviewedRequestDoc = await db.doc(`deletionRequests/${deletionRequestId}`).get();
    assert.equal(reviewedRequestDoc.exists, true);
    assert.equal(reviewedRequestDoc.data()?.status, "approved");
    assert.equal(reviewedRequestDoc.data()?.reviewedBy, users.superAdmin.uid);

    const reviewedListResult = await callCallable(
      "adminListDeletionRequests",
      {
        limit: 20,
      },
      superAdminToken
    );
    const reviewedItems = Array.isArray(reviewedListResult.items) ? reviewedListResult.items : [];
    const reviewedItem = reviewedItems.find((item) => item && item.id === deletionRequestId);
    const foundReviewedItem = Boolean(reviewedItem);
    assert.equal(foundReviewedItem, true);
    assert.equal(reviewedItem?.status, "approved");

    summary.flows.deletionReview = {
      requestId: deletionRequestId,
      createdStatus: createDeletionResult.status,
      reviewedStatus: reviewResult.status,
      listedInApproved: foundReviewedItem,
    };

    console.log("REGRESSION_E2E_OK");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("REGRESSION_E2E_FAILED");
    console.error(asErrorMessage(error));
    process.exitCode = 1;
  } finally {
    if (deletionRequestId) {
      cleanupDocPaths.push(`deletionRequests/${deletionRequestId}`);
    }

    await Promise.all(
      cleanupDocPaths.map(async (path) => {
        try {
          await db.doc(path).delete();
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
