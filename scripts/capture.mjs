import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (e) => console.log('PAGE ERROR: ' + e.message));
page.on('response', (r) => {
  if (r.status() >= 400) console.log('HTTP ' + r.status() + ' ' + r.url());
});
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE: ' + m.text());
});
await page.goto(process.argv[2] || 'http://127.0.0.1:5187/');
await page.waitForTimeout(1500);
await page.locator('[data-action=close]').click();
await page.waitForTimeout(500);
mkdirSync('artifacts', { recursive: true });
await page.screenshot({ path: 'artifacts/first-render.png', fullPage: true });
console.log((await page.locator('#world canvas').count()) + ' game canvas; ' + (await page.title()));
await browser.close();
