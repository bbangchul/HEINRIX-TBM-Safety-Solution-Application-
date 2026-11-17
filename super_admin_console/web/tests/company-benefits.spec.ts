import { expect, test } from "@playwright/test";

// Render the real modal with a browser-local API stub. No Firebase reads or writes.
test.beforeEach(async ({ page }) => {
  page.on("pageerror", error => console.error("Benefits test page error:", error.message));
  await page.route("**/*.cloudfunctions.net/**", route => route.abort());
  await page.route("**/src/lib/api/company-benefits-api.ts", route => route.fulfill({
    contentType: "text/javascript",
    body: `
      export const BENEFIT_STATUS_LABELS = {not_configured:'미설정', scheduled:'시작 예정', active:'이용 중', expired:'만료', revoked:'종료됨'};
      const activeBenefit = {purpose:'sales_support',startsAt:'2027-01-01T15:00:00Z',endsAtExclusive:'2027-01-31T15:00:00Z',noExpiry:false,revision:1,reason:'영업 체험'};
      let view = {serverTime:'2027-01-15T00:00:00Z',benefit:null,status:'not_configured',isInternalTestCompany:false,history:[],billing:{freeCoinsRemaining:7,paidCoinsRemaining:30,reservedCoins:2},coinHistory:[]};
      if (location.pathname.includes('list-test')) {view.benefit=activeBenefit; view.status='active';}
      window.benefitCalls = [];
      window.coinCalls = [];
      export async function getCompanyBenefits() {return structuredClone(view);}
      export async function getCompanyBenefitSummaries(companies) {
        return {serverTime:window.forcedServerNow ?? view.serverTime,items:companies.map(({companyId})=>{
          const values = {
            'test-active':{benefit:view.benefit,status:view.status},
            'test-none':{benefit:null,status:'not_configured'},
            'test-scheduled':{benefit:{...activeBenefit,startsAt:'2027-02-01T15:00:00Z',endsAtExclusive:'2027-02-28T15:00:00Z'},status:'scheduled'},
            'test-expired':{benefit:{...activeBenefit,endsAtExclusive:'2027-01-10T15:00:00Z'},status:'expired'},
            'test-revoked':{benefit:activeBenefit,status:'revoked'},
            'test-unlimited':{benefit:{...activeBenefit,noExpiry:true,endsAtExclusive:null},status:'active'},
          };
          return {companyId,...values[companyId]};
        })};
      }
      export async function grantCompanyCoins(input) {
        window.coinCalls.push(input);
        if (window.failCoinSave) {window.failCoinSave=false; throw new Error('network failure');}
        const beforeFreeCoins = view.billing.freeCoinsRemaining;
        view.billing.freeCoinsRemaining += input.amount;
        const result = {amount:input.amount,beforeFreeCoins,afterFreeCoins:view.billing.freeCoinsRemaining,initialFreeCoinsSeeded:0};
        view.coinHistory.unshift({id:input.requestId,...result,reason:input.reason,actorUid:'test-admin',createdAt:new Date().toISOString()});
        return result;
      }
      export async function saveCompanyBenefit(action, input) {
        window.benefitCalls.push({action,input});
        if (window.failBenefitSave) {window.failBenefitSave=false; throw new Error('network failure');}
        view.benefit = {
          purpose:input.purpose ?? view.benefit.purpose,
          startsAt:input.startDate ? new Date(input.startDate+'T00:00:00+09:00').toISOString() : view.benefit.startsAt,
          endsAtExclusive:input.endDate ? new Date(new Date(input.endDate+'T00:00:00+09:00').getTime()+86400000).toISOString() : view.benefit?.endsAtExclusive ?? null,
          revision:(view.benefit?.revision ?? 0)+1, noExpiry:input.noExpiry ?? false, reason:input.reason
        };
        view.status = action === 'revoke' ? 'revoked' : 'active';
        view.history.unshift({id:input.requestId,action,reason:input.reason,actorUid:'test-admin',createdAt:new Date().toISOString(),after:structuredClone(view.benefit)});
      }
    `,
  }));
  await page.route("**/src/lib/api/admin-api.ts", route => route.fulfill({
    contentType: "text/javascript", body: `
      const rows = [['active','활성 회사'],['none','미설정 회사'],['scheduled','시작 예정 회사'],['expired','만료 회사'],['revoked','종료 회사'],['unlimited','내부 테스트 회사'],['pending','승인 대기 회사']].map(([id,name])=>({
        id:'request-'+id+'-12345678901234567890',companyId:'test-'+id,approvedCompanyId:id==='pending'?null:'test-'+id,
        companyName:name,requesterUid:'qa-user-1234567890123456789012345678',status:id==='pending'?'pending':'approved'
      }));
      export const adminApi = {usingMockData:true,listCompanyApprovalRequests:async()=>rows};
    `,
  }));
  await page.route(/\/benefits(?:-list)?-test$/, route => route.fulfill({
    contentType: "text/html",
    body: `<html><head><link rel="stylesheet" href="/src/styles.css"></head><body><div id="root"></div>
      <script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {};
        window.$RefreshSig$ = () => (type) => type;
        window.__vite_plugin_react_preamble_installed__ = true;
      </script>
      <script type="module">
        import React from '/node_modules/.vite/deps/react.js';
        import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
        import {CompanyBenefitsModal} from '/src/features/company-approval-requests/pages/CompanyBenefitsModal.tsx';
        import {CompanyApprovalRequestsPage} from '/src/features/company-approval-requests/pages/CompanyApprovalRequestsPage.tsx';
        const listPage = React.createElement('div',{className:'admin-shell'},
          React.createElement('aside',{className:'admin-sidebar'},'안전한하루'),
          React.createElement('div',{className:'admin-main'},
            React.createElement('header',{className:'admin-topbar'},'관리자 콘솔'),
            React.createElement('main',{className:'admin-content'},React.createElement(CompanyApprovalRequestsPage))));
        ReactDOM.createRoot(document.getElementById('root')).render(location.pathname.includes('list-test') ? listPage : React.createElement(CompanyBenefitsModal,{
          companyId:'test-company',approvalRequestId:'test-request',companyName:'테스트 회사',onClose:()=>{}
        }));
      </script></body></html>`,
  }));
  await page.goto("/benefits-test");
  await expect(page.getByText("현재 상태: 미설정")).toBeVisible();
});

test("web modal grants, changes dates, revokes and shows history", async ({ page }) => {
  await expect(page.getByText("기간 제한 없음", { exact: true })).toHaveCount(0);
  await page.getByLabel("시작일 (한국 시간)").fill("2027-01-01");
  await page.getByLabel("종료일 (한국 시간)").fill("2027-01-31");
  await page.getByLabel("처리 사유").fill("영업 체험");
  await page.getByRole("button", { name: "무료 이용 설정 저장" }).click();
  await expect(page.getByText("현재 상태: 이용 중")).toBeVisible();
  await page.getByLabel("종료일 (한국 시간)").fill("2027-02-28");
  await page.getByLabel("처리 사유").fill("체험 연장");
  await page.getByRole("button", { name: "기간 변경 저장" }).click();
  await expect(page.getByRole("status")).toHaveText("기간 변경을 저장했습니다.");
  await page.getByLabel("처리 사유").fill("체험 종료");
  await page.getByRole("button", { name: "즉시 종료", exact: true }).click();
  await page.getByRole("button", { name: "종료 확정" }).click();
  await expect(page.getByText("현재 상태: 종료됨")).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { benefitCalls: { action: string; input: { expectedRevision: number } }[] }).benefitCalls);
  expect(calls.map(c => c.action)).toEqual(["grant", "update", "revoke"]);
  expect(calls.map(c => c.input.expectedRevision)).toEqual([0, 1, 2]);
  await page.getByRole("tab", { name: "이력", exact: true }).click();
  await expect(page.getByText("체험 종료", { exact: true })).toBeVisible();
});

test("retry after ambiguous failure retains the request ID", async ({ page }) => {
  await page.getByLabel("시작일 (한국 시간)").fill("2027-01-01");
  await page.getByLabel("종료일 (한국 시간)").fill("2027-01-31");
  await page.getByLabel("처리 사유").fill("재시도 테스트");
  await page.evaluate(() => { (window as unknown as { failBenefitSave: boolean }).failBenefitSave = true; });
  await page.getByRole("button", { name: "무료 이용 설정 저장" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "무료 이용 설정 저장" }).click();
  await expect(page.getByText("현재 상태: 이용 중")).toBeVisible();
  const ids = await page.evaluate(() => (window as unknown as { benefitCalls: { input: { requestId: string } }[] }).benefitCalls.map(c => c.input.requestId));
  expect(ids).toHaveLength(2);
  expect(ids[0]).toEqual(ids[1]);
});

test("coin grant previews balance, confirms and shows history; retry keeps request ID", async ({ page }) => {
  await page.getByRole("tab", { name: "코인 지급", exact: true }).click();
  const section = page.getByRole("region", { name: "코인 지급", exact: true });
  await section.getByLabel("지급 코인 수량").fill("100");
  await section.getByLabel("코인 지급 사유").fill("영업 코인 지원");
  await expect(section.getByText("지급 후 예상 무료 잔액: 107코인")).toBeVisible();
  await section.getByRole("button", { name: "코인 지급", exact: true }).click();
  await page.evaluate(() => { (window as unknown as { failCoinSave: boolean }).failCoinSave = true; });
  await section.getByRole("button", { name: "지급 확정" }).click();
  await expect(section.getByRole("alert")).toBeVisible();
  await section.getByRole("button", { name: "지급 확정" }).click();
  await expect(section.getByRole("status")).toContainText("100코인 지급 완료");
  await expect(section.getByText("무료 100코인 지급 · 7 → 107")).toBeVisible();
  await expect(section.getByText("무료 107 · 유료 30 · 예약 2")).toBeVisible();
  const ids = await page.evaluate(() => (window as unknown as { coinCalls: { requestId: string }[] }).coinCalls.map(c => c.requestId));
  expect(ids).toHaveLength(2);
  expect(ids[0]).toEqual(ids[1]);
});

test("approved-company list shows statuses, Korean end dates and appropriate actions", async ({ page }) => {
  await page.goto("/benefits-list-test");
  const active = page.getByRole("row").filter({ hasText: "활성 회사" });
  await expect(active.getByText("이용 중", { exact: true })).toBeVisible();
  await expect(active.getByText("2027-01-31까지 (한국 시간)")).toBeVisible();
  await expect(active.getByRole("button", { name: "혜택 설정", exact: true })).toBeDisabled();
  await expect(active.getByRole("button", { name: "기간 변경", exact: true })).toBeEnabled();
  await expect(page.getByRole("row").filter({ hasText: "시작 예정 회사" }).getByText("시작 예정", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "만료 회사" }).getByText("만료", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "종료 회사" }).getByText("종료됨", { exact: true })).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "내부 테스트 회사" }).getByText("기간 제한 없음")).toBeVisible();
  const pending = page.getByRole("row").filter({ hasText: "승인 대기 회사" });
  await expect(pending.getByRole("button", { name: "코인 지급", exact: true })).toHaveCount(0);
  await expect(pending.getByText("승인 후 설정 가능")).toBeVisible();
  await active.getByRole("button", { name: "코인 지급", exact: true }).click();
  await expect(page.getByRole("tab", { name: "코인 지급", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "기간 변경 저장" })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await active.getByRole("button", { name: "이력", exact: true }).click();
  await expect(page.getByRole("heading", { name: "최근 혜택 변경 이력 (최대 30건)" })).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await active.getByRole("button", { name: "즉시 종료", exact: true }).click();
  await page.getByLabel("처리 사유", { exact: true }).fill("영업 체험 종료");
  await page.getByRole("button", { name: "종료 확정" }).click();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(active.getByText("종료됨", { exact: true })).toBeVisible();
  await expect(active.getByRole("button", { name: "혜택 설정", exact: true })).toBeEnabled();
  await expect(active.getByRole("button", { name: "기간 변경", exact: true })).toBeDisabled();
});

test("list recalculates expiry using refreshed server time", async ({ page }) => {
  await page.goto("/benefits-list-test");
  const active = page.getByRole("row").filter({ hasText: "활성 회사" });
  await expect(active.getByText("이용 중", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { forcedServerNow: string }).forcedServerNow = "2027-01-31T15:00:00Z";
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(active.getByText("만료", { exact: true })).toBeVisible();
  await expect(active.getByRole("button", { name: "즉시 종료", exact: true })).toBeDisabled();
});

for (const width of [1440, 1024, 768, 390, 320]) {
  test(`action buttons stay readable and visible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/benefits-list-test");
    const row = page.getByRole("row").filter({ hasText: "활성 회사" });
    const button = row.getByRole("button", { name: "코인 지급", exact: true });
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBeTruthy();
    for (const item of await row.getByRole("button").all()) {
      const metrics = await item.evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        return { oneLine: range.getClientRects().length === 1, fits: el.scrollWidth <= el.clientWidth, noWrap: getComputedStyle(el).whiteSpace === "nowrap" };
      });
      expect(metrics).toEqual({ oneLine: true, fits: true, noWrap: true });
    }
    await expect(button).toBeInViewport();
    const before = await button.boundingBox();
    await page.locator(".table-wrap").evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect(button).toBeInViewport();
    const after = await button.boundingBox();
    expect(Math.abs(before!.x - after!.x)).toBeLessThan(2);
    await button.click();
    await expect(page.getByRole("tab", { name: "코인 지급", exact: true })).toHaveAttribute("aria-selected", "true");
  });
}
