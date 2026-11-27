import { test, expect, type Page, menuAction } from './fixtures';
import { newGame, startRound, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';
const SAVE = 'last-stop-match-v1';
async function load(page: Page, state: ReturnType<typeof newGame>) {
  await page.locator('#save-file').setInputFiles({
    name: 'exploration.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect
    .poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).world.seed, SAVE))
    .toBe(state.world.seed);
}
async function save(page: Page) {
  await menuAction(page, 'save');
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE);
}
test('organic region, sprint inputs and physical hiding stay readable and functional', async ({ page }) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const state = newGame('organic-overview', 40);
  startRound(state);
  state.actors.forEach((actor) => (actor.nextThink = 9999));
  await load(page, state);
  await page.keyboard.press('KeyM');
  await expect(page.locator('.station-node')).toHaveCount(40);
  await expect(page.locator('.railway-route').first()).toHaveAttribute('d', /Q/);
  await page.screenshot({ path: 'artifacts/organic-region-40.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  const start = await save(page);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyD');
  await page.keyboard.up('ShiftLeft');
  const sprinted = await save(page);
  expect(sprinted.actors[0].x - start.actors[0].x).toBeGreaterThan(1.2);
  expect(sprinted.actors[0].x - start.actors[0].x).toBeLessThan(2.7);
  await page.locator('[data-action=sprint-toggle]').click();
  await expect(page.locator('[data-action=sprint-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action=sprint-toggle]').click();
  const hidden = newGame('bush-cover', 20);
  startRound(hidden);
  hidden.actors.forEach((actor) => (actor.nextThink = 9999));
  const station = hidden.world.stations[0];
  const bush = station.local.cover!.find((cover) => cover.kind === 'bush')!;
  Object.assign(hidden.actors[0], bush.hide);
  await load(page, hidden);
  await page.waitForTimeout(400);
  await expect(page.locator('[data-action=hide]')).toBeEnabled();
  await page.keyboard.press('KeyH');
  await expect(page.locator('[data-action=hide]')).toHaveAttribute('aria-pressed', 'true');
  expect((await save(page)).actors[0].hiding).toBe(true);
  await page.screenshot({ path: 'artifacts/hiding-in-bush.png', animations: 'disabled' });
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  await expect(page.locator('[data-action=hide]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-action=hide]').click();
  expect((await save(page)).actors[0].hiding).toBe(false);
  // Controller X hides; its right trigger sprints while the stick moves.
  const controller = async (button: number | null, axis = 0) => {
    await page.evaluate(
      ({ button, axis }) =>
        Object.defineProperty(navigator, 'getGamepads', {
          configurable: true,
          value: () => [
            {
              axes: [axis, 0],
              buttons: Array.from({ length: 16 }, (_, index) => ({
                pressed: index === button,
                value: index === button ? 1 : 0,
                touched: false,
              })),
              connected: true,
              index: 0,
              id: 'test-standard',
              mapping: 'standard',
              timestamp: 1,
            },
          ],
        }),
      { button, axis },
    );
    await page.waitForTimeout(button === 7 ? 300 : 120);
  };
  await controller(2);
  await controller(null);
  await expect(page.locator('[data-action=hide]')).toHaveAttribute('aria-pressed', 'true');
  // Use a clear platform for a repeatable sprint movement check.
  const platform = newGame('controller-sprint', 20);
  startRound(platform);
  platform.actors.forEach((actor) => (actor.nextThink = 9999));
  await load(page, platform);
  await controller(7, 1);
  await controller(null);
  expect((await save(page)).actors[0].x - platform.actors[0].x).toBeGreaterThan(1.2);
  await page.screenshot({ path: 'artifacts/organic-town-1280.png', animations: 'disabled' });
  expect(errors).toEqual([]);
});
