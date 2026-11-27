import { test, expect, menuAction } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';

test('large text keeps the objective stack clear and controller A approves a suggestion', async ({
  page,
}) => {
  mkdirSync('artifacts/living-districts', { recursive: true });
  const s = newGame('large-text-approval', 20, 'seeker');
  s.phase = 'search';
  s.time = s.searchAt = 130;
  s.committed = 2;
  s.cardReady = 99999;
  s.settings.textScale = 1.4;
  s.settings.reducedMotion = true;
  Object.assign(s.actors[1], s.world.stations[2].local.platform, { station: 2, nextThink: 99999 });
  await page.setViewportSize({ width: 880, height: 800 });
  await page.goto('/');
  await page.locator('#save-file').setInputFiles({
    name: 'approval.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(s)),
  });
  await expect(page.locator('.route-objective')).toContainText('Review suggested question');
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  for (const width of [1280, 880]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(150);
    const controls = (await page.locator('#movement-tools').boundingBox())!;
    const goal = (await page.locator('#objective').boundingBox())!;
    const map = (await page.locator('.rail-nav').boundingBox())!;
    expect(controls.y + controls.height + 8).toBeLessThanOrEqual(map.y);
    expect(goal.x + goal.width + 12).toBeLessThanOrEqual(controls.x);
    if (await page.locator('#context-prompt').isVisible()) {
      const hint = (await page.locator('#context-prompt').boundingBox())!;
      expect(hint.y + hint.height + 4).toBeLessThanOrEqual(goal.y);
    }
  }
  await page.keyboard.press('KeyQ');
  const approve = page.getByRole('button', { name: 'Approve question', exact: true });
  const bounds = (await approve.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(880);
  expect(bounds.y + bounds.height).toBeLessThan(800);
  await page.screenshot({ path: 'artifacts/living-districts/approval-text-140.png', animations: 'disabled' });
  await approve.focus();
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          axes: [0, 0],
          buttons: Array.from({ length: 16 }, (_, index) => ({
            pressed: index === 0,
            value: index === 0 ? 1 : 0,
          })),
        },
      ],
    }),
  );
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }),
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await menuAction(page, 'save');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!));
  expect(saved.events.some((e: { type: string }) => e.type === 'question')).toBe(true);
});
