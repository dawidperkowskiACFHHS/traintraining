import { test, expect } from './fixtures';
import { mkdirSync } from 'node:fs';

test('browser and install icons load at their declared sizes with safe maskable artwork', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Last Stop');
  await expect(page.locator('.title-emblem')).toBeVisible();
  const result = await page.evaluate(async () => {
    const manifestUrl = new URL(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href);
    const manifest = await (await fetch(manifestUrl)).json();
    const rows = [];
    for (const icon of manifest.icons) {
      const img = new Image();
      img.src = new URL(icon.src, manifestUrl).href;
      await img.decode();
      let opaque = true,
        safe = true;
      if (icon.purpose === 'maskable') {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = img.width;
        const c = canvas.getContext('2d')!;
        c.drawImage(img, 0, 0);
        const rgba = c.getImageData(0, 0, img.width, img.height).data;
        for (let y = 0; y < img.height; y++)
          for (let x = 0; x < img.width; x++) {
            const i = (y * img.width + x) * 4;
            if (rgba[i + 3] !== 255) opaque = false;
            if (
              Math.hypot(x + 0.5 - img.width / 2, y + 0.5 - img.height / 2) > img.width * 0.4 &&
              (rgba[i] !== 11 || rgba[i + 1] !== 28 || rgba[i + 2] !== 43)
            )
              safe = false;
          }
      }
      rows.push({ expected: icon.sizes, actual: `${img.width}x${img.height}`, opaque, safe });
    }
    const apple = new Image();
    apple.src = document.querySelector<HTMLLinkElement>('link[rel=apple-touch-icon]')!.href;
    await apple.decode();
    const ico = await fetch(document.querySelector<HTMLLinkElement>('link[rel=icon][sizes=any]')!.href);
    return { rows, apple: apple.width, ico: ico.status, background: manifest.background_color };
  });
  expect(result.rows).toHaveLength(4);
  expect(result.rows.every((icon) => icon.expected === icon.actual && icon.opaque && icon.safe)).toBe(true);
  expect(result.apple).toBe(180);
  expect(result.ico).toBe(200);
  expect(result.background).toBe('#0b1c2b');
});

test('the title branding stays readable at normal and large text sizes', async ({ page }) => {
  mkdirSync('artifacts/brand', { recursive: true });
  await page.addInitScript(() =>
    localStorage.setItem('last-stop-preferences-v1', JSON.stringify({ textScale: 1.4 })),
  );
  for (const width of [1280, 880]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    const start = page.getByRole('button', { name: 'New journey', exact: true });
    await expect(start).toBeVisible();
    const mark = (await page.locator('.title-emblem').boundingBox())!;
    const lettering = (await page.locator('.title-mark').boundingBox())!;
    expect(mark.x + mark.width).toBeLessThanOrEqual(lettering.x);
    expect(lettering.x + lettering.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `artifacts/brand/title-${width}.png`, animations: 'disabled' });
  }
});
