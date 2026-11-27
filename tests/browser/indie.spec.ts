import { test, expect, menuAction, setSpeed } from './fixtures';
import { newGame, serialize, startRound } from '../../src/simulation';
import { mkdirSync } from 'node:fs';

test('main menu flows into a fresh journey and customization returns to the menu', async ({ page }) => {
  mkdirSync('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.locator('.title-screen')).toBeVisible();
  await page.getByRole('button', { name: 'Your traveler', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your traveler' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.title-screen')).toBeVisible();
  await page.screenshot({ path: 'artifacts/indie-title.png' });
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  const first = await page.locator('[name=seed]').inputValue();
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#time-tools')).toContainText('Head start');
  await menuAction(page, 'new-menu');
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  expect(await page.locator('[name=seed]').inputValue()).not.toBe(first);
});

test('train and bus interiors move, pause, show the traveler and return to the world', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  for (const kind of ['local', 'bus'] as const) {
    const s = newGame('vehicle-interiors', 20);
    startRound(s);
    s.time = 10;
    s.actors.forEach((a) => (a.nextThink = 9999));
    s.actors[0].journey = [{ from: 0, to: 1, depart: 0, arrive: 50, kind, line: 0 }];
    await page.locator('#save-file').setInputFiles({
      name: 'vehicle.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serialize(s)),
    });
    await expect(page.locator('#journey-view')).toBeVisible();
    await expect(page.locator('#journey-caption')).toContainText(kind === 'bus' ? 'Bus' : 'Local train');
    const frame = () => page.locator('#journey-canvas').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
    const a = await frame();
    await page.waitForTimeout(350);
    expect((await frame()) === a).toBe(false);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const paused = await frame();
    await page.waitForTimeout(250);
    expect((await frame()) === paused).toBe(true);
    await page.screenshot({ path: `artifacts/indie-${kind === 'bus' ? 'bus' : 'train'}.png` });
    await page.keyboard.press('Space');
    await setSpeed(page, 4);
    // Shorten the timetable in a second import to verify the actual arrival transition.
    s.time = 49.8;
    s.actors[0].journey[0].arrive = 50;
    await page.locator('#save-file').setInputFiles({
      name: 'arrival.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serialize(s)),
    });
    await expect(page.locator('#journey-view')).toBeHidden();
  }
  expect(errors).toEqual([]);
});
