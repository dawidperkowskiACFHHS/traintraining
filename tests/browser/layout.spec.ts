import { expect, test, menuAction } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { mkdirSync, writeFileSync } from 'node:fs';

test('RPG layout keeps the world large, trays readable and notebook collapsible', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.screenshot({ path: 'artifacts/gba-new-game.png', animations: 'disabled' });
  const state = newGame('rpg-interface', 30);
  state.hand = [2, 10, 13, 20, 21];
  await page.locator('#save-file').setInputFiles({
    name: 'interface-review.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  await page.keyboard.press('KeyR');
  await page.locator('.tray-toggle').focus();
  const measurements = [];
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    const metrics = await page.evaluate(() => {
      const rect = document.querySelector('#world-wrap')!.getBoundingClientRect();
      const canvas = document.querySelector('#world canvas')!.getBoundingClientRect();
      return {
        viewport: `${innerWidth}×${innerHeight}`,
        worldShare: (rect.width * rect.height) / (innerWidth * innerHeight),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        noOverflow: document.documentElement.scrollWidth <= innerWidth,
        cards: [...document.querySelectorAll('#hand .travel-card')].map((card) => {
          const title = card.querySelector<HTMLElement>('strong')!;
          const copy = card.querySelector('p')!;
          const cost = card.querySelector('.card-cost')!;
          return {
            titleFits: title.scrollWidth <= title.clientWidth,
            copyFits: copy.getBoundingClientRect().bottom <= cost.getBoundingClientRect().top + 1,
            fontSize: parseFloat(getComputedStyle(copy).fontSize),
          };
        }),
      };
    });
    expect(metrics.worldShare).toBeGreaterThanOrEqual(0.7);
    expect(metrics.noOverflow).toBe(true);
    expect(metrics.cards.every((card) => card.titleFits && card.copyFits && card.fontSize >= 12)).toBe(true);
    measurements.push(metrics);
    await page.screenshot({ path: `artifacts/gba-play-${viewport.width}.png`, animations: 'disabled' });
  }
  writeFileSync('artifacts/layout-measurements.json', JSON.stringify(measurements, null, 2));
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('complementary', { name: 'Live notebook' })).toBeHidden();
  await menuAction(page, 'toggle-notebook');
  await expect(page.getByRole('complementary', { name: 'Live notebook' })).toBeVisible();
  await page.screenshot({ path: 'artifacts/gba-notebook.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Collapse live notebook', exact: true }).click();
  const before = (await page.locator('#world-wrap').boundingBox())!.height;
  await page.keyboard.press('KeyR');
  await page.getByRole('button', { name: 'Collapse card tray', exact: true }).click();
  await expect(page.locator('body')).not.toHaveClass(/hand-open/);
  expect((await page.locator('#world-wrap').boundingBox())!.height).toBe(before);
  await page.keyboard.press('KeyR');
  await page.locator('.rail-nav [data-action=map]').click();
  await page.locator('[data-action=select-station][data-index="1"]').click();
  await page.screenshot({ path: 'artifacts/gba-map.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Close panel' }).click();
  state.rewards = [{ cards: [2, 13, 20], keep: 1 }];
  await page.locator('#save-file').setInputFiles({
    name: 'reward-review.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  const picked = page.locator('[data-action=reward-pick]').first();
  expect(await picked.evaluate((card) => (card as HTMLElement).style.getPropertyValue('--fan-slot'))).toBe(
    '',
  );
  await picked.click();
  await expect(picked).toHaveAttribute('aria-pressed', 'true');
  await expect(picked.locator('.card-selection')).toBeVisible();
  await picked.hover();
  await expect(picked).toHaveCSS('background-color', 'rgb(240, 221, 169)');
  await page.screenshot({ path: 'artifacts/gba-selected-reward.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Keep 1 / 1 selected' }).click();
  await page.locator('[data-action=overflow-discard]').first().click();
  await menuAction(page, 'settings');
  await page.locator('#text-scale').fill('1.4');
  await page.getByRole('button', { name: 'Close panel' }).click();
  expect(
    await page
      .locator('#hand .card-copy strong')
      .evaluateAll((elements) => elements.every((element) => element.scrollWidth <= element.clientWidth)),
  ).toBe(true);
  await page.screenshot({ path: 'artifacts/gba-text-140.png', animations: 'disabled' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#save-file').setInputFiles({
    name: 'large-region-review.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(newGame('rpg-large-region', 40))),
  });
  await page.locator('.rail-nav [data-action=map]').click();
  await expect(page.locator('.station-node')).toHaveCount(40);
  await page.screenshot({ path: 'artifacts/gba-map-40.png', animations: 'disabled' });
  expect(errors).toEqual([]);
});
