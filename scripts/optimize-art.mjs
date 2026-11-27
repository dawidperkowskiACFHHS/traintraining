import { chromium } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5187');
for (const path of ['title', ...Array.from({ length: 24 }, (_, id) => `cards/${id}`)]) {
  const source =
    'data:image/png;base64,' + (await readFile(`artifacts/source-art/${path}.png`)).toString('base64');
  const data = await page.evaluate(
    async ({ path, source }) => {
      const img = new Image();
      img.src = source;
      await img.decode();
      const scale = Math.min(1, (path === 'title' ? 1920 : 640) / img.width);
      const canvas = document.createElement('canvas');
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/webp', 0.86).split(',')[1];
    },
    { path, source },
  );
  await writeFile(`public/art/${path}.webp`, Buffer.from(data, 'base64'));
}
await browser.close();
console.log('Optimized title and 24 card illustrations.');
