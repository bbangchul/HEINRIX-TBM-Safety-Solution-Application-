import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.BENEFITS_EMULATOR_QA !== "true", "Requires the explicitly started isolated demo emulator and QA bridge.");
test.describe.configure({ mode: "serial" });
const bridge = "http://127.0.0.1:4789";
async function api(page: Page, operation: string, input: Record<string, unknown> = {}) {
  return page.evaluate(async ({ operation, input }) => {
    const res = await fetch(`/qa-api/${operation}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    return { status: res.status, body: await res.json() };
  }, { operation, input });
}
let today = "";
test.beforeEach(async ({ page, request }) => {
  const response = await request.post(`${bridge}/setup`);
  expect(response.ok()).toBeTruthy();
  const fixture = await response.json();
  today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(fixture.serverTime));
  await page.route("**/*.cloudfunctions.net/**", route => route.abort());
  await page.route("**/qa-api/**", async route => {
    const operation = new URL(route.request().url()).pathname.split("/").pop();
    const response = await route.fetch({ url: `${bridge}/${operation}` });
    await route.fulfill({ response });
  });
  await page.route("**/src/lib/api/company-benefits-api.ts", route => route.fulfill({ contentType: "text/javascript", body: `
    export const BENEFIT_STATUS_LABELS={not_configured:'미설정',scheduled:'시작 예정',active:'이용 중',expired:'만료',revoked:'종료됨'};
    async function call(operation,input={}) {
      const res=await fetch('/qa-api/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
      const body=await res.json(); if(!res.ok){const error=new Error(body.error);error.code=body.code;throw error;} return body;
    }
    export const getCompanyBenefits=()=>call('get');
    export const saveCompanyBenefit=(action,input)=>call('save',{...input,action});
    export const grantCompanyCoins=input=>call('coins',input);
  ` }));
  await page.route("**/benefits-emulator-test", route => route.fulfill({ contentType: "text/html", body: `
    <html><head><link rel="stylesheet" href="/src/styles.css"></head><body><div id="root"></div>
    <script type="module">import R from '/@react-refresh';R.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>t=>t;window.__vite_plugin_react_preamble_installed__=true;</script>
    <script type="module">
      import React from '/node_modules/.vite/deps/react.js';import DOM from '/node_modules/.vite/deps/react-dom_client.js';
      import {CompanyBenefitsModal} from '/src/features/company-approval-requests/pages/CompanyBenefitsModal.tsx';
      DOM.createRoot(document.getElementById('root')).render(React.createElement(CompanyBenefitsModal,{companyId:'${fixture.companyId}',approvalRequestId:'${fixture.approvalRequestId}',companyName:'QA TEST ONLY',onClose:()=>{}}));
    </script></body></html>` }));
  await page.goto("/benefits-emulator-test");
  await expect(page.getByText("현재 상태: 미설정")).toBeVisible();
});

async function grantToday(page: Page) {
  await page.getByLabel("시작일 (한국 시간)").fill(today);
  await page.getByLabel("종료일 (한국 시간)").fill(today);
  await page.getByLabel("처리 사유", { exact: true }).fill("QA TEST ONLY 날짜 경계");
  await page.getByRole("button", { name: "무료 이용 설정 저장" }).click();
  await expect(page.getByText("현재 상태: 이용 중")).toBeVisible();
}

test("real emulator transactions: date boundary and return to subscription/free/paid coins", async ({ page }) => {
  await grantToday(page);
  const end = Date.parse(`${today}T00:00:00+09:00`) + 86400000;
  await api(page, "clock", { iso: new Date(end - 1).toISOString() });
  expect((await api(page, "status")).body.currentEntitlementMode).toBe("benefit");
  await api(page, "clock", { iso: new Date(end).toISOString() });
  expect((await api(page, "status")).body.currentEntitlementMode).toBe("free_coin");
  await page.getByRole("button", { name: "최신 상태 다시 불러오기" }).click();
  await expect(page.getByText("현재 상태: 만료")).toBeVisible();
  await api(page, "profile", { patch: { subscriptionStatus: "active" } });
  expect((await api(page, "status")).body.currentEntitlementMode).toBe("subscription");
  await api(page, "profile", { patch: { subscriptionStatus: "inactive", freeCoinsRemaining: 0 } });
  expect((await api(page, "status")).body.currentEntitlementMode).toBe("paid_coin");
});

test("real concurrent coin requests are applied exactly once and conflict on changed input", async ({ page }) => {
  const input = { requestId: "qa-duplicate", amount: 100, reason: "QA TEST ONLY 중복 지급" };
  const results = await Promise.all([api(page, "coins", input), api(page, "coins", input)]);
  expect(results.map(r => r.status)).toEqual([200, 200]);
  expect(results.filter(r => r.body.replayed)).toHaveLength(1);
  const snapshot = (await api(page, "snapshot")).body;
  expect(snapshot.profile.freeCoinsRemaining).toBe(110);
  expect(snapshot.grants).toBe(1);
  expect(snapshot.ledger.filter((row: { transactionType: string }) => row.transactionType === "admin_adjustment")).toHaveLength(1);
  expect((await api(page, "coins", { ...input, amount: 101 })).status).toBe(409);
  await page.getByRole("tab", { name: "코인 지급", exact: true }).click();
  await page.getByRole("button", { name: "최신 상태 다시 불러오기" }).click();
  await expect(page.getByText("무료 110 · 유료 20 · 예약 0")).toBeVisible();
});

test("real concurrent benefit changes reject one stale revision without losing history", async ({ page }) => {
  await grantToday(page);
  const input = { action: "update", purpose: "sales_support", startDate: today, endDate: today, noExpiry: false, expectedRevision: 1 };
  const results = await Promise.all([
    api(page, "save", { ...input, requestId: "change-a", reason: "QA TEST ONLY A" }),
    api(page, "save", { ...input, requestId: "change-b", reason: "QA TEST ONLY B" }),
  ]);
  expect(results.map(r => r.status).sort()).toEqual([200, 409]);
  expect((await api(page, "snapshot")).body.changes).toBe(2);
  await page.getByLabel("처리 사유", { exact: true }).fill("QA TEST ONLY stale web input");
  await page.getByRole("button", { name: "기간 변경 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("다른 관리자가 변경했습니다");
});

test("PDF failure refunds free/paid reservations once and never invents a free-benefit refund", async ({ page }) => {
  for (const kind of ["free_coin", "paid_coin"]) {
    const free = kind === "free_coin" ? 10 : 0;
    await api(page, "profile", { patch: { freeCoinsRemaining: free, paidCoinsRemaining: 20 } });
    const reserved = (await api(page, "reserve", { key: kind })).body;
    expect(reserved.entitlementMode).toBe(kind);
    expect(reserved.reservedCoins).toBe(1);
    const failed = await api(page, "fail", { jobId: reserved.jobId, key: `fail-${kind}` });
    expect(failed.status).toBe(200);
    expect(failed.body.releasedCoins).toBe(1);
    await api(page, "fail", { jobId: reserved.jobId, key: `fail-${kind}` });
    const snapshot = (await api(page, "snapshot")).body;
    expect(snapshot.profile.freeCoinsRemaining).toBe(free);
    expect(snapshot.profile.paidCoinsRemaining).toBe(20);
    expect(snapshot.profile.reservedCoins).toBe(0);
  }
  await grantToday(page);
  const reserved = (await api(page, "reserve", { key: "benefit" })).body;
  expect(reserved.entitlementMode).toBe("benefit");
  expect(reserved.reservedCoins).toBe(0);
  const failed = (await api(page, "fail", { jobId: reserved.jobId, key: "fail-benefit" })).body;
  expect(failed.releasedCoins).toBe(0);
  expect((await api(page, "snapshot")).body.profile.freeCoinsRemaining).toBe(0);
});
