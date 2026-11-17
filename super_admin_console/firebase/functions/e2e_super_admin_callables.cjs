const assert = require("node:assert/strict");
const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "tbm-application-v2";
const REGION = "asia-northeast3";
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

async function signInWithEmailAndPassword(email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(`signInWithPassword failed: ${JSON.stringify(data)}`);
  }
  if (!data.idToken) {
    throw new Error("ID token missing from signInWithPassword response");
  }

  return data.idToken;
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

(async () => {
  const runId = Date.now();
  const now = new Date().toISOString();

  const callerUid = `e2e_superadmin_${runId}`;
  const callerEmail = `${callerUid}@heinrix.com`;
  const callerPassword = `E2e!${runId}_Hx`;
  const anonymizeUid = `e2e_anon_${runId}`;
  const hardDeleteUid = `e2e_hard_${runId}`;

  const configKey = `e2e_config_${runId}`;
  const membershipAnonymizeId = `${anonymizeUid}_e2e_company_e2e_project`;
  const membershipHardDeleteId = `${hardDeleteUid}_e2e_company_e2e_project`;
  const deletionRequesterDocId = `e2e_dr_req_${runId}`;
  const deletionTargetDocId = `e2e_dr_tgt_${runId}`;

  const cleanupDocPaths = [
    `users/${anonymizeUid}`,
    `memberships/${membershipAnonymizeId}`,
    `memberships/${membershipHardDeleteId}`,
    `deletionRequests/${deletionRequesterDocId}`,
    `deletionRequests/${deletionTargetDocId}`,
    `systemConfigs/${configKey}`,
  ];

  const cleanupAuthUids = [callerUid, anonymizeUid, hardDeleteUid];

  const summary = {
    runId,
    callerUid,
    anonymize: null,
    hardDelete: null,
    systemConfig: null,
  };

  try {
    await auth.createUser({
      uid: callerUid,
      email: callerEmail,
      password: callerPassword,
      displayName: "E2E Super Admin",
    });
    await auth.setCustomUserClaims(callerUid, {
      role: "super_admin",
      mfaVerified: true,
      environment: "prod",
    });
    const idToken = await signInWithEmailAndPassword(callerEmail, callerPassword);

    await auth.createUser({
      uid: hardDeleteUid,
      email: `${hardDeleteUid}@example.com`,
      displayName: "E2E Hard Delete",
    });

    await db.doc(`users/${anonymizeUid}`).set({
      role: "worker",
      status: "active",
      email: `${anonymizeUid}@example.com`,
      displayName: "E2E Anonymize",
      companyIds: ["e2e_company"],
      projectIds: ["e2e_project"],
      superAdminProtected: false,
      createdAt: now,
      updatedAt: now,
      createdBy: callerUid,
      updatedBy: callerUid,
    });

    await db.doc(`users/${hardDeleteUid}`).set({
      role: "worker",
      status: "active",
      email: `${hardDeleteUid}@example.com`,
      displayName: "E2E Hard Delete",
      companyIds: ["e2e_company"],
      projectIds: ["e2e_project"],
      superAdminProtected: false,
      createdAt: now,
      updatedAt: now,
      createdBy: callerUid,
      updatedBy: callerUid,
    });

    await db.doc(`memberships/${membershipAnonymizeId}`).set({
      uid: anonymizeUid,
      companyId: "e2e_company",
      projectId: "e2e_project",
      role: "worker",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: callerUid,
      updatedBy: callerUid,
    });

    await db.doc(`memberships/${membershipHardDeleteId}`).set({
      uid: hardDeleteUid,
      companyId: "e2e_company",
      projectId: "e2e_project",
      role: "worker",
      status: "active",
      createdAt: now,
      updatedAt: now,
      createdBy: callerUid,
      updatedBy: callerUid,
    });

    await db.doc(`deletionRequests/${deletionRequesterDocId}`).set({
      requesterUid: hardDeleteUid,
      targetUid: "e2e_target_keep",
      targetRole: "worker",
      status: "requested",
      reason: "e2e requester",
      createdAt: now,
      updatedAt: now,
      createdBy: callerUid,
      updatedBy: callerUid,
    });

    await db.doc(`deletionRequests/${deletionTargetDocId}`).set({
      requesterUid: "e2e_requester_keep",
      targetUid: hardDeleteUid,
      targetRole: "worker",
      status: "approved",
      reason: "e2e target",
      createdAt: now,
      updatedAt: now,
      createdBy: callerUid,
      updatedBy: callerUid,
    });

    const anonymizeResult = await callCallable(
      "adminDeleteOrAnonymizeUser",
      {
        uid: anonymizeUid,
        mode: "anonymize",
        deleteAuth: false,
        reason: "e2e anonymize",
      },
      idToken
    );

    assert.equal(anonymizeResult.mode, "anonymize");

    const anonymizeUserSnapshot = await db.doc(`users/${anonymizeUid}`).get();
    assert.equal(anonymizeUserSnapshot.exists, true);
    const anonymizeUserData = anonymizeUserSnapshot.data() ?? {};
    assert.equal(anonymizeUserData.status, "disabled");
    assert.equal(anonymizeUserData.role, "worker");
    assert.equal(anonymizeUserData.displayName, "Deleted User");

    const anonymizeMembershipSnapshot = await db.doc(`memberships/${membershipAnonymizeId}`).get();
    assert.equal(anonymizeMembershipSnapshot.exists, true);
    assert.equal(anonymizeMembershipSnapshot.data()?.status, "inactive");

    summary.anonymize = {
      callableResult: anonymizeResult,
      userStatus: anonymizeUserData.status,
      membershipStatus: anonymizeMembershipSnapshot.data()?.status,
    };

    const hardDeleteResult = await callCallable(
      "adminDeleteOrAnonymizeUser",
      {
        uid: hardDeleteUid,
        mode: "hard_delete",
        deleteAuth: true,
        reason: "e2e hard delete",
      },
      idToken
    );

    assert.equal(hardDeleteResult.mode, "hard_delete");
    assert.equal(hardDeleteResult.userDeleted, true);
    assert.equal(hardDeleteResult.authDeleted, true);

    const hardDeleteUserSnapshot = await db.doc(`users/${hardDeleteUid}`).get();
    assert.equal(hardDeleteUserSnapshot.exists, false);

    const hardDeleteMembershipSnapshot = await db.doc(`memberships/${membershipHardDeleteId}`).get();
    assert.equal(hardDeleteMembershipSnapshot.exists, false);

    const requesterDocSnapshot = await db.doc(`deletionRequests/${deletionRequesterDocId}`).get();
    const targetDocSnapshot = await db.doc(`deletionRequests/${deletionTargetDocId}`).get();
    assert.equal(requesterDocSnapshot.exists, true);
    assert.equal(targetDocSnapshot.exists, true);
    assert.equal(requesterDocSnapshot.data()?.requesterUid, `deleted:${hardDeleteUid}`);
    assert.equal(targetDocSnapshot.data()?.targetUid, `deleted:${hardDeleteUid}`);
    assert.equal(targetDocSnapshot.data()?.targetRole, "worker");

    let authDeletedVerified = false;
    try {
      await auth.getUser(hardDeleteUid);
      authDeletedVerified = false;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      authDeletedVerified = code === "auth/user-not-found";
    }
    assert.equal(authDeletedVerified, true);

    summary.hardDelete = {
      callableResult: hardDeleteResult,
      userDocExists: hardDeleteUserSnapshot.exists,
      membershipDocExists: hardDeleteMembershipSnapshot.exists,
      requesterUidAfter: requesterDocSnapshot.data()?.requesterUid,
      targetUidAfter: targetDocSnapshot.data()?.targetUid,
      authDeletedVerified,
    };

    const upsertResult = await callCallable(
      "adminUpsertSystemConfig",
      {
        configKey,
        category: "policy",
        value: { enabled: true, step: 1 },
        description: "e2e upsert",
      },
      idToken
    );

    assert.equal(upsertResult.configKey, configKey);

    let configSnapshot = await db.doc(`systemConfigs/${configKey}`).get();
    assert.equal(configSnapshot.exists, true);
    assert.equal(configSnapshot.data()?.category, "policy");
    assert.equal(configSnapshot.data()?.value?.enabled, true);

    const updateResult = await callCallable(
      "adminUpdateSystemConfig",
      {
        configKey,
        category: "policy",
        value: { enabled: false, step: 2 },
        description: "e2e update",
      },
      idToken
    );

    assert.equal(updateResult.configKey, configKey);
    configSnapshot = await db.doc(`systemConfigs/${configKey}`).get();
    assert.equal(configSnapshot.exists, true);
    assert.equal(configSnapshot.data()?.value?.enabled, false);
    assert.equal(configSnapshot.data()?.value?.step, 2);

    summary.systemConfig = {
      key: configKey,
      upsertResult,
      updateResult,
      valueAfterUpdate: configSnapshot.data()?.value,
      descriptionAfterUpdate: configSnapshot.data()?.description,
    };

    console.log("E2E_CHECK_OK");
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error("E2E_CHECK_FAILED");
    console.error(asErrorMessage(error));
    process.exitCode = 1;
  } finally {
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
