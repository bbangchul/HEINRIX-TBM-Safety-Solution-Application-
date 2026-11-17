// Local-only browser QA bridge. Executes production core functions against an isolated emulator.
// Never imported by the app or deployed Functions entrypoint.
const http = require("node:http");
const path = require("node:path");
const { createRequire } = require("node:module");
const { randomUUID } = require("node:crypto");
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8787" || process.env.GCLOUD_PROJECT !== "demo-heinrix-benefits-qa") {
  throw new Error("QA bridge requires the isolated demo emulator; production access is forbidden.");
}
const root = path.resolve(__dirname, "../../..");
const appRoot = path.resolve(root, "../../00.tbm_application_v2/functions");
const adminRequire = createRequire(path.join(root, "firebase/functions/package.json"));
const appRequire = createRequire(path.join(appRoot, "package.json"));
const adminSDK = adminRequire("firebase-admin");
const appSDK = appRequire("firebase-admin");
const benefits = require(path.join(root, "firebase/functions/lib/modules/companyBenefits/callables.js"));
if (!appSDK.apps.length) appSDK.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const adminDb = adminSDK.firestore();
const appDb = appSDK.firestore();
const billing = require(path.join(appRoot, "lib/http/billing/_billing_store.js"));
const coins = require(path.join(appRoot, "lib/http/billing/admin_grant_company_coins.js"));
const pdfReserve = require(path.join(appRoot, "lib/http/billing/request_pdf_issue_reserve.js"));
const pdfFail = require(path.join(appRoot, "lib/http/billing/finalize_pdf_issue_failure.js"));
let now = Date.now();
let fixture = null;
const adminClock = () => adminSDK.firestore.Timestamp.fromMillis(now);
const appClock = () => appSDK.firestore.Timestamp.fromMillis(now);

async function execute(operation, body) {
  if (operation === "setup") {
    now = Date.now();
    const companyId = `qa-${randomUUID()}`;
    const approvalRequestId = `approval-${companyId}`;
    fixture = { companyId, approvalRequestId };
    await adminDb.collection("companies").doc(companyId).set({ name: "QA TEST ONLY", isInternalTestCompany: false });
    await adminDb.collection("company_admin_conversion_requests").doc(approvalRequestId).set({ status: "approved", approvedCompanyId: companyId });
    await appDb.collection("companies").doc(companyId).collection("billing_profile").doc("billing_profile").set({
      companyId, freeCoinsRemaining: 10, paidCoinsRemaining: 20, reservedCoins: 0, subscriptionStatus: "inactive",
    });
    return { ...fixture, serverTime: new Date(now).toISOString() };
  }
  if (!fixture) throw new Error("Set up the test company first.");
  const input = { ...body, ...fixture };
  switch (operation) {
    case "get": return benefits.getCompanyBenefitsCore(adminDb, input, adminClock);
    case "save": return benefits.mutateCompanyBenefitCore(adminDb, body.action, input, "qa-admin", adminClock);
    case "coins": return coins.grantCompanyCoinsCore({ db: appDb, input, actorUid: "qa-admin" });
    case "clock": now = Date.parse(body.iso); return { serverTime: new Date(now).toISOString() };
    case "profile":
      await appDb.collection("companies").doc(fixture.companyId).collection("billing_profile").doc("billing_profile").set(body.patch, { merge: true });
      return {};
    case "status": return appDb.runTransaction(tx => billing.ensureCompanyBillingProfileTx({ db: appDb, tx,
      companyId: fixture.companyId, actorUid: "qa-admin", deferWrites: true, now: appClock() })).then(result => result.profile);
    case "reserve": return pdfReserve.requestPdfIssueReserveCore({ db: appDb, companyId: fixture.companyId,
      actorUid: "qa-admin", sourceType: "tbm_session", sourceId: "qa-source", sourceProjectId: "qa-project",
      sourceVersionKey: body.key, idempotencyKey: body.key, decisionTime: appClock() });
    case "fail": return pdfFail.finalizePdfIssueFailureCore({ db: appDb, companyId: fixture.companyId, actorUid: "qa-admin",
      jobId: body.jobId, errorCode: "qa_forced_generation_failure", errorMessage: "QA TEST ONLY", idempotencyKey: body.key });
    case "snapshot": {
      const company = appDb.collection("companies").doc(fixture.companyId);
      const [profile, ledger, grants, changes] = await Promise.all([
        company.collection("billing_profile").doc("billing_profile").get(), company.collection("billing_transactions").get(),
        company.collection("coin_grant_history").get(), company.collection("usage_benefit_history").get(),
      ]);
      return { profile: profile.data(), grants: grants.size, changes: changes.size, ledger: ledger.docs.map(doc => doc.data()) };
    }
    default: throw new Error("Unknown QA operation");
  }
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:4173");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (req.method !== "POST") { res.writeHead(405).end(); return; }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
    const result = await execute(req.url.slice(1), body);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(error.status ?? 409, { "Content-Type": "application/json" }).end(JSON.stringify({ code: error.code ?? "qa_error", error: error.message }));
  }
});
server.listen(4789, "127.0.0.1", () => console.log("Benefits QA bridge ready at http://127.0.0.1:4789 (emulator only)"));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
