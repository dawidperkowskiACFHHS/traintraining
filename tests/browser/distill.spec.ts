import { test, expect, menuAction, openMenu } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';
test('the distilled interface keeps quick start and grouped settings compact while secondary tools remain reachable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await expect(page.locator('[name=seed]')).toBeHidden();
  await expect(page.locator('[name=pace]')).toBeVisible();
  await expect(page.locator('[name=difficulty]')).toBeVisible();
  await page.locator('[name=difficulty]').selectOption('relaxed');
  await expect(page.locator('#difficulty-description')).toContainText('18% slower');
  await page.locator('[data-disclosure=journey-options] > summary').click();
  await page.locator('[name=seed]').fill('distilled-interface');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await expect(page.locator('.rail-nav > button')).toHaveCount(1);
  await openMenu(page);
  await expect(page.getByRole('dialog', { name: 'Field tools' })).toBeVisible();
  await page.keyboard.down('Escape');
  await page.keyboard.down('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.keyboard.up('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Field tools' })).toBeVisible();
  const before = await page.locator('.clock-label strong').innerText();
  await page.waitForTimeout(1100);
  expect(await page.locator('.clock-label strong').innerText()).toBe(before);
  await page.getByRole('button', { name: 'Card guide', exact: true }).last().click();
  await expect(page.locator('.card-library .travel-card')).toHaveCount(24);
  await page.keyboard.press('Escape');
  await menuAction(page, 'settings');
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toBeHidden();
  await page.locator('[data-disclosure=sound-levels] > summary').focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toBeVisible();
  await page.locator('[data-disclosure=local-ai] > summary').click();
  await page.locator('[data-action=ollama-reconnect]').click();
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Field tools' })).toBeVisible();
});

test('settled play leaves the world clear and keeps the fanned hand tucked at normal and enlarged sizes', async ({
  page,
}) => {
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const state = newGame('quiet-game-hud', 20, 'hider');
  state.phase = 'headstart';
  state.phaseAt = state.time = 0;
  state.actors.forEach((a) => (a.nextThink = 1e9));
  state.hand = [2, 10, 13, 20, 21];
  await page
    .locator('#save-file')
    .setInputFiles({
      name: 'quiet-hud.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serialize(state)),
    });
  await expect(page.locator('.role-intro-card')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  expect(await page.locator('.party-plaque').evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe(
    '0px',
  );
  await expect(page.locator('body')).not.toHaveClass(/hand-open/);
  const hand = await page.locator('#hand').boundingBox();
  expect(hand!.y).toBeGreaterThan(745);
  await page.screenshot({ path: 'artifacts/field-play/settled-hud.png', animations: 'disabled' });
  await page.keyboard.press('KeyR');
  await expect(page.locator('body')).toHaveClass(/hand-open/);
  await openMenu(page);
  await expect(page.locator('body')).not.toHaveClass(/hand-open/);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 880, height: 700 });
  state.settings.textScale = 1.4;
  await page
    .locator('#save-file')
    .setInputFiles({
      name: 'large-hud.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serialize(state)),
    });
  await expect(page.locator('.role-intro-card')).toHaveCount(0, { timeout: 10000 });
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/field-play/settled-hud-140.png', animations: 'disabled' });
});
