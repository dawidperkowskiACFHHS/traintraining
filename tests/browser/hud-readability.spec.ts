import { test, expect, setSpeed, openMenu } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';

test('shadowed HUD controls and the tucked hand have separate space at ordinary and enlarged sizes', async ({
  page,
}) => {
  test.setTimeout(60000);
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.goto('/');
  for (const view of [
    { width: 1848, height: 1000, scale: 1 },
    { width: 1280, height: 800, scale: 1 },
    { width: 880, height: 700, scale: 1.4 },
  ]) {
    await page.setViewportSize({ width: view.width, height: view.height });
    const s = newGame('hud-cover-readability', 20, 'hider');
    s.phase = 'headstart';
    s.paused = true;
    s.committed = 0;
    s.settings.textScale = view.scale;
    s.actors[0].hiding = true;
    s.hand = [2, 10, 13, 20, 21, 3, 4];
    s.handLimit = 7;
    await page
      .locator('#save-file')
      .setInputFiles({
        name: 'readable-hud.json',
        mimeType: 'application/json',
        buffer: Buffer.from(serialize(s)),
      });
    await expect(page.locator('#movement-tools [data-action=hide]')).toBeVisible();
    await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
    const result = await page.evaluate(() => {
      const selectors = [
        '.party-plaque',
        '.journey-clock',
        '.header-tools',
        '#objective',
        '#movement-tools',
        '.rail-nav',
        '.tray-toggle',
      ];
      const boxes = selectors.map((selector) => ({
        selector,
        rect: document.querySelector(selector)!.getBoundingClientRect(),
      }));
      const overlaps: string[] = [];
      for (let a = 0; a < boxes.length; a++)
        for (let b = a + 1; b < boxes.length; b++) {
          const x = boxes[a].rect,
            y = boxes[b].rect;
          if (
            x.width &&
            x.height &&
            y.width &&
            y.height &&
            x.left < y.right &&
            x.right > y.left &&
            x.top < y.bottom &&
            x.bottom > y.top
          )
            overlaps.push(boxes[a].selector + ' / ' + boxes[b].selector);
        }
      const toggle = document.querySelector('.tray-toggle')!.getBoundingClientRect();
      const cards = [...document.querySelectorAll('#hand .travel-card')].map(
        (el) => el.getBoundingClientRect().top,
      );
      return {
        overlaps,
        inside: boxes.every(
          ({ rect: r }) => r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        ),
        toggleBottom: toggle.bottom,
        cardTop: Math.min(...cards),
        backing: getComputedStyle(document.querySelector('.party-plaque')!).backgroundColor,
        shadow: getComputedStyle(document.querySelector('.party-plaque')!).boxShadow,
      };
    });
    expect(result.overlaps).toEqual([]);
    expect(result.inside).toBe(true);
    expect(result.toggleBottom + 4).toBeLessThanOrEqual(result.cardTop);
    expect(result.backing).not.toBe('rgba(0, 0, 0, 0)');
    expect(result.shadow).not.toBe('none');
    await page.screenshot({
      path: `artifacts/field-play/readable-hud-${view.width}.png`,
      animations: 'disabled',
    });
  }
});

test('normal plus three fast-forward speeds are visible, selectable, saved and keyboard/controller accessible', async ({
  page,
}) => {
  await page.goto('/');
  const s = newGame('four-clock-rates', 20, 'hider');
  s.phase = 'headstart';
  s.actors.forEach((a) => (a.nextThink = 1e9));
  await page
    .locator('#save-file')
    .setInputFiles({
      name: 'clock-rates.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serialize(s)),
    });
  await expect(page.getByRole('group', { name: 'Game speed' }).getByRole('button')).toHaveCount(4);
  for (const rate of [1, 2, 4, 8] as const) {
    await setSpeed(page, rate);
    await expect(page.locator(`.speed-rates [data-value="${rate}"]`)).toHaveAttribute('aria-pressed', 'true');
  }
  await page.keyboard.press('BracketLeft');
  await expect(page.getByRole('button', { name: 'Fast forward 4×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Fast forward 2×', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Fast forward 2×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await openMenu(page);
  await page.locator('#overlay [data-action=speed]').focus();
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          axes: [0, 0],
          buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0 })),
        },
      ],
    }),
  );
  await expect(page.getByRole('button', { name: 'Fast forward 4×', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }),
  );
  await page.locator('.header-tools [data-action=tools]').click();
  await page.locator('#overlay [data-action=save]').click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!).speed)).toBe(4);
});
