import { expect, test } from "@playwright/test";

const ROUTES: Array<{ path: string; heading: string }> = [
  { path: "/admin", heading: "대시보드" },
  { path: "/admin/companies", heading: "회사 관리" },
  { path: "/admin/company-approval-requests", heading: "회사 승인 요청" },
  { path: "/admin/billing", heading: "결제 관리" },
  { path: "/admin/projects", heading: "프로젝트 관리" },
  { path: "/admin/memberships", heading: "멤버십 관리" },
  { path: "/admin/users", heading: "사용자/권한" },
  { path: "/admin/deletion-requests", heading: "삭제 요청" },
  { path: "/admin/audit-logs", heading: "감사 로그" },
  { path: "/admin/system-configs", heading: "운영 설정" },
];

test.describe("admin web ui smoke", () => {
  for (const route of ROUTES) {
    test(`loads ${route.path}`, async ({ page }) => {
      await page.goto(route.path);

      await expect(page).toHaveURL(new RegExp(`${route.path.replace("/", "\\/")}$`));
      await expect(page.getByRole("heading", { level: 2, name: "관리자 콘솔" })).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: route.heading })).toBeVisible();
      if (route.path === "/admin/company-approval-requests") {
        await expect(page.getByRole("columnheader", { name: "무료 이용 상태·종료일" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "코인 지급", exact: true })).toHaveCount(0);
        await page.getByRole("link", { name: "결제 관리", exact: true }).last().click();
        await expect(page).toHaveURL(/\/admin\/billing$/);
        await expect(page.getByRole("heading", { level: 1, name: "결제 관리" })).toBeVisible();
      }
    });
  }
});
