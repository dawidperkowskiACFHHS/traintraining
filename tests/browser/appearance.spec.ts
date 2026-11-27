import { test, expect, type Page, menuAction } from './fixtures';
import { APPEARANCE_KEY, DEFAULT_APPEARANCE } from '../../src/appearance';
import { newGame, serialize, startRound } from '../../src/simulation';
import { mkdirSync } from 'node:fs';

const MATCH = 'last-stop-match-v1';
const custom = { skinTone: 5, hairstyle: 3, hairColor: 3, shirtColor: 1, trousersColor: 1, accessory: 2 };

test('custom traveler previews, saves, walks, appears on the map and survives reloads', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await page.locator('[data-disclosure=journey-options] > summary').click();
  await page.locator('[name=seed]').fill('custom-traveler');
  await page.locator('[name=size]').selectOption('20');
  await page.locator('[name=mode][value=hider]').check();
  await page.locator('.new-game [data-action=appearance]').click();
  await expect(page.getByRole('dialog', { name: 'Your traveler' })).toBeVisible();
  await expect(page.locator('.preview-sprite')).toHaveCount(4);
  for (const [key, value] of Object.entries(custom))
    await page.locator(`[data-appearance=${key}]`).selectOption(String(value));
  for (const direction of ['up', 'right', 'down', 'left'])
    await expect(page.getByRole('img', { name: `Walking ${direction}` })).toHaveCSS(
      'animation-name',
      'traveler-walk',
    );
  const sheet = await page
    .locator('.character-preview')
    .evaluate(
      (element) =>
        (element as HTMLElement).style.getPropertyValue('--sprite-sheet').match(/url\(["']?(.*?)["']?\)/)![1],
    );
  // Every direction has a distinct facing and two distinct walking poses.
  const frames = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    return Array.from({ length: 4 }, (_, direction) =>
      [0, 1, 2, 3].map((frame) => {
        context.clearRect(0, 0, 24, 32);
        context.drawImage(image, frame * 24, direction * 32, 24, 32, 0, 0, 24, 32);
        return canvas.toDataURL();
      }),
    );
  }, sheet);
  expect(new Set(frames.map((row) => row[0])).size).toBe(4);
  for (const row of frames) expect(new Set(row).size).toBe(3);
  await page.screenshot({ path: 'artifacts/character-editor.png', animations: 'allow' });
  await page.getByRole('button', { name: 'Save appearance', exact: true }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), APPEARANCE_KEY)).toEqual(
    custom,
  );
  await expect(page.locator('[name=seed]')).toHaveValue('custom-traveler');
  await expect(page.locator('[name=size]')).toHaveValue('20');
  await expect(page.locator('[name=mode][value=hider]')).toBeChecked();
  const portrait = await page.locator('#player-avatar img').getAttribute('src');
  await expect(page.locator('.new-traveler img')).toHaveAttribute('src', portrait!);
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(450);
  await page.keyboard.up('KeyW');
  await menuAction(page, 'save');
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), MATCH);
  expect(saved.appearance).toEqual(custom);
  expect(saved.actors[0].y).toBeLessThan(36.5);
  await page.keyboard.press('Space');
  await page.screenshot({ path: 'artifacts/custom-traveler-world.png', animations: 'disabled' });
  await page.keyboard.press('KeyM');
  await expect(page.locator('.player-map-marker')).toHaveAttribute('href', portrait!);
  await page.screenshot({ path: 'artifacts/custom-traveler-map.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  await expect(page.locator('#player-avatar img')).toHaveAttribute('src', portrait!);
  await page.keyboard.press('KeyV');
  for (const [key, value] of Object.entries(custom))
    await expect(page.locator(`[data-appearance=${key}]`)).toHaveValue(String(value));
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  const random = await page
    .locator('[data-appearance]')
    .evaluateAll((selects) => selects.map((select) => (select as HTMLSelectElement).value));
  expect(random).not.toEqual(Object.values(custom).map(String));
  await page.keyboard.press('Escape');
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).appearance, MATCH)).toEqual(
    custom,
  );
  await page.locator('#player-avatar button').click();
  await page.getByRole('button', { name: 'Randomize', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#player-avatar img')).toHaveAttribute('src', portrait!);
  expect(errors).toEqual([]);
});

async function pad(page: Page, button: number | null) {
  await page.evaluate((button) => {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          axes: [0, 0],
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
    });
  }, button);
  await page.waitForTimeout(button === null ? 140 : 120);
}

test('changing appearance from the startup menu preserves the existing saved match', async ({ page }) => {
  await page.goto('/');
  const state = newGame('keep-this-match', 20);
  state.notes[1] = 'Keep this investigation.';
  await page.locator('#save-file').setInputFiles({
    name: 'existing.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect
    .poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).world.seed, MATCH))
    .toBe(state.world.seed);
  await page.reload();
  const before = await page.evaluate((key) => localStorage.getItem(key), MATCH);
  await page.getByRole('button', { name: 'Your traveler', exact: true }).click();
  await page.locator('[data-appearance=shirtColor]').selectOption('4');
  await page.getByRole('button', { name: 'Save appearance', exact: true }).click();
  expect((await page.evaluate((key) => localStorage.getItem(key), MATCH)) === before).toBe(true);
  await page.reload();
  expect((await page.evaluate((key) => localStorage.getItem(key), MATCH)) === before).toBe(true);
  await page.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  await menuAction(page, 'save');
  const resumed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), MATCH);
  expect(resumed.world.seed).toBe(state.world.seed);
  expect(resumed.notes[1]).toBe('Keep this investigation.');
  expect(resumed.appearance.shirtColor).toBe(4);
});

test('keyboard and gamepad edit every field; legacy saves and reduced motion remain usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const state = newGame('wardrobe-controls', 20);
  startRound(state);
  state.settings.reducedMotion = true;
  state.settings.panelPause = false;
  state.settings.textScale = 1.4;
  const legacy = JSON.parse(serialize(state));
  delete legacy.appearance;
  await page.locator('#save-file').setInputFiles({
    name: 'legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await expect
    .poll(async () => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).world.seed, MATCH))
    .toBe(state.world.seed);
  await page.keyboard.press('KeyV');
  await expect(page.locator('.preview-sprite').first()).toHaveCSS('animation-name', 'none');
  const frozen = await page.locator('.clock-label strong').innerText();
  await page.waitForTimeout(1200);
  await expect(page.locator('.clock-label strong')).toHaveText(frozen);
  await page.getByRole('button', { name: 'Animate preview', exact: true }).click();
  await expect(page.locator('.preview-sprite').first()).toHaveCSS('animation-name', 'traveler-walk');
  await page.screenshot({ path: 'artifacts/character-editor-text-140.png', animations: 'allow' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Save appearance', exact: true })).toBeInViewport();
  await page.locator('[data-appearance=skinTone]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-appearance=skinTone]')).toHaveValue('2');
  await page.keyboard.press('Escape');
  await pad(page, 8);
  await pad(page, null);
  await expect(page.getByRole('dialog', { name: 'Your traveler' })).toBeVisible();
  for (const [key, initial] of Object.entries(DEFAULT_APPEARANCE)) {
    // Focus uses the same native select reached by d-pad panel navigation.
    await page.locator(`[data-appearance=${key}]`).focus();
    await pad(page, 0);
    await pad(page, null);
    await pad(page, 15);
    await pad(page, null);
    await expect(page.locator(`[data-appearance=${key}]`)).toHaveValue(String(initial + 1));
    await pad(page, 0);
    await pad(page, null);
  }
  await page.locator('[data-action=save-appearance]').focus();
  await pad(page, 0);
  await pad(page, null);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), APPEARANCE_KEY);
  for (const [key, value] of Object.entries(DEFAULT_APPEARANCE)) expect(saved[key]).toBe(value + 1);
  await pad(page, 8);
  await pad(page, null);
  // D-pad really moves focus, and B cancels from an editable selector.
  await pad(page, 13);
  await pad(page, null);
  await pad(page, 13);
  await pad(page, null);
  await expect(page.locator('[data-appearance=skinTone]')).toBeFocused();
  await pad(page, 0);
  await pad(page, null);
  await pad(page, 1);
  await pad(page, null);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
