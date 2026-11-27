import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
export type { Page } from '@playwright/test';
export { expect };
export async function setSpeed(page: Page, speed: 1 | 2 | 4 | 8, timeout = 5000) {
  await page.locator('.speed-rates [data-value="' + speed + '"]').click({ timeout });
}
export async function openMenu(page: Page) {
  if (!(await page.locator('.tool-drawer').isVisible()))
    await page.locator('.header-tools [data-action=tools]').click();
}
export async function menuAction(page: Page, action: string) {
  await openMenu(page);
  await page.locator(`#overlay [data-action="${action}"]`).click();
}
export async function openLocalModelSettings(page: Page) {
  if (!(await page.locator('.settings-body').isVisible())) {
    if (await page.locator('.title-screen').isVisible())
      await page.locator('.title-utilities [data-action=settings]').click();
    else await menuAction(page, 'settings');
  }
  const disclosure = page.locator('[data-disclosure=local-ai]');
  if (!(await disclosure.evaluate((node) => (node as HTMLDetailsElement).open)))
    await disclosure.locator('summary').click();
}
export const test = base.extend<{ isolateLocalModels: void }>({
  isolateLocalModels: [
    async ({ page }, use) => {
      // Gameplay regressions never depend on a local model or consume its resources.
      await page.route('http://127.0.0.1:11434/**', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: '{"error":"offline test fixture"}',
        }),
      );
      await use();
    },
    { auto: true },
  ],
});
