import { test, expect } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';

test('tagging shows the contact, caught reaction and skippable celebration before the score', async ({
  page,
}) => {
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  const s = newGame('playful-tag', 20, 'seeker');
  s.phase = 'search';
  s.time = 130;
  s.searchAt = 110;
  s.committed = 0;
  s.localAt = 120;
  s.actors.forEach((a) => (a.nextThink = 1e9));
  s.questionReady = 1e9;
  Object.assign(s.actors[1], { station: 0, x: s.actors[0].x + 1, y: s.actors[0].y });
  await page.goto('/');
  await page
    .locator('#save-file')
    .setInputFiles({ name: 'tag.json', mimeType: 'application/json', buffer: Buffer.from(serialize(s)) });
  await expect(page.locator('.context-talk')).toContainText('Tag');
  await page.keyboard.press('KeyE');
  await expect(page.locator('.capture-banner')).toContainText('You caught Mira!');
  await expect(page.locator('#overlay .modal')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/field-play/tag-contact.png', animations: 'allow' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Round results' })).toBeVisible();
  await expect(page.locator('.capture-explanation')).toContainText('close range with a clear sightline');
  await page.locator('.modal [data-action=save]').click();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem('last-stop-match-v1')!).results.length,
  );
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  await expect(page.locator('.capture-banner')).toHaveCount(0);
  await page.locator('.modal [data-action=save]').click();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!).results.length),
  ).toBe(before);
});

test('being tagged has a clear reduced-motion moment and then automatically reveals results', async ({
  page,
}) => {
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  const s = newGame('quiet-tag', 20, 'hider');
  s.phase = 'search';
  s.time = 130;
  s.searchAt = 110;
  s.committed = 0;
  s.localAt = 120;
  s.locked = true;
  s.settings.reducedMotion = true;
  s.questionReady = 1e9;
  s.cardReady = 1e9;
  s.actors.forEach((a) => (a.nextThink = 1e9));
  Object.assign(s.actors[1], { station: 0, x: s.actors[0].x + 1, y: s.actors[0].y, nextThink: 133 });
  await page.goto('/');
  await page
    .locator('#save-file')
    .setInputFiles({ name: 'caught.json', mimeType: 'application/json', buffer: Buffer.from(serialize(s)) });
  await expect(page.locator('.capture-banner')).toContainText('Mira caught you!', { timeout: 10000 });
  await expect(page.locator('.capture-banner')).toHaveCSS('animation-name', 'none');
  await page.screenshot({ path: 'artifacts/field-play/tag-reduced-motion.png', animations: 'disabled' });
  const first = await page.locator('#world canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await page.waitForTimeout(180);
  expect(await page.locator('#world canvas').evaluate((el) => (el as HTMLCanvasElement).toDataURL())).toBe(
    first,
  );
  await expect(page.getByRole('dialog', { name: 'Round results' })).toBeVisible();
  await expect(page.locator('.result-pose')).toBeVisible();
});
