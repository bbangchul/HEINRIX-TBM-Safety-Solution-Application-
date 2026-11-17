const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const api = require("../lib/modules/companyBenefits/callables");

// In-memory transaction adapter: writes commit together only after callback success.
function database() {
  let state = new Map([
    ["companies/c1", { isInternalTestCompany: false }],
    ["company_admin_conversion_requests/r1", { status: "approved", approvedCompanyId: "c1" }],
  ]);
  const ref = path => ({ path, collection: name => collection(`${path}/${name}`) });
  const collection = path => ({
    doc: name => ref(`${path}/${name}`),
    orderBy: () => ({ limit: count => ({ query: path, count }) }),
  });
  return {
    collection,
    read: path => state.get(path),
    set: (path, data) => state.set(path, data),
    size: () => state.size,
    async runTransaction(fn) {
      const writes = [];
      const snapshot = (path, value) => ({ exists: value !== undefined, id: path.split("/").pop(), data: () => value, get: key => value?.[key] });
      const tx = {
        async get(target) {
          assert.equal(writes.length, 0, "Firestore transactions must read before writing");
          if (target.query) return { docs: [...state].filter(([p]) => p.startsWith(target.query + "/"))
            .sort((a, b) => b[1].createdAt.toMillis() - a[1].createdAt.toMillis())
            .slice(0, target.count).map(([p, v]) => snapshot(p, v)) };
          return snapshot(target.path, state.get(target.path));
        },
        set: (target, data) => writes.push([target.path, data]),
        create: (target, data) => { assert.equal(state.has(target.path), false); writes.push([target.path, data]); },
      };
      const result = await fn(tx);
      for (const [path, data] of writes) state.set(path, data);
      return result;
    },
  };
}
const input = {
  companyId: "c1", approvalRequestId: "r1", requestId: "request-1", expectedRevision: 0,
  purpose: "sales_support", startDate: "2026-11-17", endDate: "2026-11-30", noExpiry: false, reason: "영업 지원",
};
const now = () => Timestamp.fromDate(new Date("2026-11-17T00:00:00Z"));
const run = (db, action, patch = {}) => api.mutateCompanyBenefitCore(db, action, { ...input, ...patch }, "admin", now);

test("grant, update, revoke and regrant preserve atomic history and revision", async () => {
  const db = database();
  const first = await run(db, "grant");
  assert.equal(first.status, "active");
  assert.equal(first.benefit.revision, 1);
  const updated = await run(db, "update", { requestId: "request-2", expectedRevision: 1, endDate: "2026-12-31" });
  assert.equal(updated.benefit.endsAtExclusive, "2026-12-31T15:00:00.000Z");
  const revoked = await run(db, "revoke", { requestId: "request-3", expectedRevision: 2 });
  assert.equal(revoked.status, "revoked");
  const regranted = await run(db, "grant", { requestId: "request-4", expectedRevision: 3 });
  assert.equal(regranted.benefit.revision, 4);
  assert.equal(regranted.benefit.revokedAt, null);
  const view = await api.getCompanyBenefitsCore(db, input);
  assert.equal(view.history.length, 4);
  assert.equal(view.history.find(h => h.action === "revoke").before.revision, 2);
});

test("retry replays result; a changed payload with the same request ID is rejected", async () => {
  const db = database();
  await run(db, "grant");
  const size = db.size();
  assert.equal((await run(db, "grant")).replayed, true);
  assert.equal(db.size(), size);
  await assert.rejects(run(db, "grant", { reason: "changed" }), { code: "already-exists" });
});

test("stale revisions and duplicate active grants do not change data", async () => {
  const db = database();
  await run(db, "grant");
  const size = db.size();
  await assert.rejects(run(db, "update", { requestId: "new" }), { code: "aborted" });
  await assert.rejects(run(db, "grant", { requestId: "new", expectedRevision: 1 }), { code: "failed-precondition" });
  assert.equal(db.size(), size);
  assert.equal(db.read("companies/c1/usage_benefits/current").revision, 1);
});

test("approval must exist, be approved and reference this company for reads and writes", async () => {
  for (const approval of [{ status: "pending", approvedCompanyId: "c1" }, { status: "approved", approvedCompanyId: "other" }]) {
    const db = database(); db.set("company_admin_conversion_requests/r1", approval);
    await assert.rejects(run(db, "grant"), { code: "failed-precondition" });
    await assert.rejects(api.getCompanyBenefitsCore(db, input), { code: "failed-precondition" });
    assert.equal(db.read("companies/c1/usage_benefits/current"), undefined);
  }
});

test("client cannot self-classify a company as internal; server classification is required", async () => {
  const db = database();
  const patch = { purpose: "internal_test", noExpiry: true, endDate: null, isInternalTestCompany: true };
  await assert.rejects(run(db, "grant", patch), { code: "invalid-argument" });
  db.set("companies/c1", { isInternalTestCompany: true });
  assert.equal((await run(db, "grant", patch)).benefit.noExpiry, true);
});

test("invalid date, expired period, missing end, unsafe IDs and missing reasons never write", async () => {
  for (const patch of [
    { startDate: "2026-02-30" }, { startDate: "2026-11-01", endDate: "2026-11-02" },
    { endDate: null }, { companyId: "x/y" }, { reason: " " }, { expectedRevision: -1 },
  ]) {
    const db = database();
    await assert.rejects(run(db, "grant", patch), { code: "invalid-argument" });
    assert.equal(db.size(), 2);
  }
});

test("unconfigured benefits cannot be changed or revoked", async () => {
  for (const action of ["update", "revoke"]) {
    await assert.rejects(run(database(), action), { code: "failed-precondition" });
  }
});

test("all callable endpoints reject unauthenticated callers and non-admin roles", async () => {
  for (const name of ["adminGetCompanyBenefits", "adminGetCompanyBenefitSummaries", "adminGrantCompanyBenefit", "adminUpdateCompanyBenefit", "adminRevokeCompanyBenefit"]) {
    await assert.rejects(api[name].run({ data: input }), { code: "unauthenticated" });
    await assert.rejects(api[name].run({ data: input, auth: { uid: "user", token: { role: "company_admin" } } }), { code: "permission-denied" });
    await assert.rejects(api[name].run({ data: input, auth: { uid: "user", token: { role: "super_admin" } } }), { code: "permission-denied" });
  }
});

test("batch summaries return only status and dates for verified approved companies", async () => {
  const db = database();
  await run(db, "grant");
  const result = await api.getCompanyBenefitSummariesCore(db, { companies: [{ companyId: "c1", approvalRequestId: "r1" }] });
  assert.equal(result.items[0].companyId, "c1");
  assert.equal(result.items[0].benefit.endsAtExclusive, "2026-11-30T15:00:00.000Z");
  assert.equal(result.items[0].benefit.reason, undefined);
  assert.equal(typeof result.serverTime, "string");
  await assert.rejects(api.getCompanyBenefitSummariesCore(db, { companies: Array(101).fill(input) }), { code: "invalid-argument" });
  await assert.rejects(api.getCompanyBenefitSummariesCore(db, { companies: [{ companyId: "c1", approvalRequestId: "missing" }] }), { code: "failed-precondition" });
});
