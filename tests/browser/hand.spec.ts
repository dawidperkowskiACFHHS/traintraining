import { test, expect, type Page } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';

async function loadHand(page: Page, scale = 1, count = 5) {
  const state = newGame('fanned-hand', 20);
  state.hand = [2, 10, 13, 20, 21, 8, 18].slice(0, count);
  state.handLimit = Math.max(5, count);
  state.settings.textScale = scale;
  state.actors.forEach((actor) => (actor.nextThink = 99999));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('#save-file').setInputFiles({
    name: 'hand.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#hand .travel-card')).toHaveCount(count);
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  await page.mouse.move(10, 400);
}

test('hand peeks, fans on hover, lifts an individual card and stows during movement', async ({ page }) => {
  mkdirSync('artifacts', { recursive: true });
  await loadHand(page);
  const body = page.locator('body');
  await expect(body).not.toHaveClass(/hand-open/);
  const cards = page.locator('#hand .travel-card');
  const resting = await cards.evaluateAll((nodes) =>
    nodes.map((node) => ({
      peek: innerHeight - node.getBoundingClientRect().top,
      angle: (node as HTMLElement).style.getPropertyValue('--fan-angle'),
    })),
  );
  expect(resting.every((card) => card.peek > 0 && card.peek < 65)).toBe(true);
  expect(new Set(resting.map((card) => card.angle)).size).toBe(5);
  await page.screenshot({ path: 'artifacts/hand-resting.png', animations: 'disabled' });
  await page.locator('.tray-toggle').hover();
  await expect(body).toHaveClass(/hand-open/);
  await page.waitForTimeout(260);
  await page.screenshot({ path: 'artifacts/hand-fanned.png', animations: 'disabled' });
  const center = cards.nth(2);
  await center.hover({ position: { x: 70, y: 35 } });
  await expect(center).toHaveCSS('z-index', '30');
  await page.screenshot({ path: 'artifacts/hand-selected.png', animations: 'disabled' });
  await center.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.move(10, 400);
  await page.keyboard.press('KeyR');
  await expect(body).toHaveClass(/hand-open/);
  await page.keyboard.down('KeyW');
  await expect(body).not.toHaveClass(/hand-open/);
  await page.keyboard.up('KeyW');
  await page.locator('.tray-toggle').hover();
  await page.locator('.tray-toggle').click();
  await expect(body).not.toHaveClass(/hand-open/);
  await page.waitForTimeout(350);
  await expect(body).not.toHaveClass(/hand-open/);
});

test('keyboard and controller browse the hand without moving the character', async ({ page }) => {
  await loadHand(page);
  await page.keyboard.press('KeyR');
  await expect(page.locator('#hand [data-index="0"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#hand [data-index="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#hand [data-index="0"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/hand-open/);
  await page.evaluate(() => {
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    (window as any).handPad = { axes: [0, 0], buttons };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [(window as any).handPad] });
  });
  async function press(index: number) {
    await page.evaluate((i) => {
      (window as any).handPad.buttons[i].pressed = true;
    }, index);
    await page.waitForTimeout(90);
    await page.evaluate((i) => {
      (window as any).handPad.buttons[i].pressed = false;
    }, index);
    await page.waitForTimeout(90);
  }
  await press(4);
  await expect(page.locator('#hand [data-index="0"]')).toBeFocused();
  await press(15);
  await expect(page.locator('#hand [data-index="1"]')).toBeFocused();
  await press(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await press(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await press(1);
  await expect(page.locator('body')).not.toHaveClass(/hand-open/);
});

test('large text and reduced motion keep an upgraded seven-card hand reachable', async ({ page }) => {
  await loadHand(page, 1.4, 7);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.keyboard.press('KeyR');
  for (const width of [1280, 880]) {
    await page.setViewportSize({ width, height: 800 });
    const bottoms = await page
      .locator('#hand .travel-card')
      .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect().bottom));
    expect(Math.max(...bottoms)).toBeLessThanOrEqual(800);
    for (let i = 0; i < 7; i++) {
      const card = page.locator(`#hand [data-index="${i}"]`);
      await expect(card).toBeFocused();
      const bounds = (await card.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThan(80);
      expect(bounds.y + bounds.height).toBeLessThan(800);
      await expect(card).toHaveCSS('transition-duration', '0s');
      await page.keyboard.press('ArrowRight');
    }
  }
  await page.screenshot({ path: 'artifacts/hand-seven-text-140.png', animations: 'disabled' });
});
