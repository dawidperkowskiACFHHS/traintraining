import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const master = await readFile('public/brand/last-stop-mark.svg', 'utf8');
const small = await readFile('public/brand/last-stop-small.svg', 'utf8');
const maskable = master
  .replace(/<rect id="surface"[^>]+\/>/, '<rect width="64" height="64" fill="#0b1c2b"/>')
  .replace(/<rect id="edge"[^>]+\/>/, '')
  .replace('<g id="emblem">', '<g id="emblem" transform="translate(8 8) scale(.75)">');

// DIB frames retain alpha and an AND mask, including in classic Windows icon consumers.
function iconFrame(rgba, size) {
  const pixels = size * size * 4,
    stride = Math.ceil(size / 32) * 4;
  const data = Buffer.alloc(40 + pixels + stride * size);
  data.writeUInt32LE(40, 0);
  data.writeInt32LE(size, 4);
  data.writeInt32LE(size * 2, 8);
  data.writeUInt16LE(1, 12);
  data.writeUInt16LE(32, 14);
  data.writeUInt32LE(pixels + stride * size, 20);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4,
        to = 40 + ((size - y - 1) * size + x) * 4;
      data[to] = rgba[from + 2];
      data[to + 1] = rgba[from + 1];
      data[to + 2] = rgba[from];
      data[to + 3] = rgba[from + 3];
      if (!rgba[from + 3]) data[40 + pixels + (size - y - 1) * stride + Math.floor(x / 8)] |= 128 >> x % 8;
    }
  return data;
}
function ico(frames) {
  const directory = Buffer.alloc(6 + frames.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach(({ size, data }, index) => {
    const at = 6 + index * 16;
    directory[at] = directory[at + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(data.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...frames.map((frame) => frame.data)]);
}
await mkdir('artifacts/brand', { recursive: true });
await mkdir('release/windows', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const render = async (source, size) =>
    page.evaluate(
      async ({ source, size }) => {
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const c = canvas.getContext('2d');
        c.imageSmoothingEnabled = false;
        c.drawImage(image, 0, 0, size, size);
        return {
          png: canvas.toDataURL().split(',')[1],
          rgba: size <= 256 ? Array.from(c.getImageData(0, 0, size, size).data) : [],
        };
      },
      { source, size },
    );
  const frames = [];
  for (const size of [16, 24, 32, 48, 64, 128, 180, 192, 256, 512]) {
    const result = await render(size <= 32 ? small : master, size);
    await writeFile(`public/brand/icon-${size}.png`, Buffer.from(result.png, 'base64'));
    if ([16, 24, 32, 48, 64, 128, 256].includes(size))
      frames.push({ size, data: iconFrame(result.rgba, size) });
  }
  for (const size of [192, 512]) {
    const result = await render(maskable, size);
    await writeFile(`public/brand/icon-maskable-${size}.png`, Buffer.from(result.png, 'base64'));
  }
  await writeFile('public/favicon.svg', small);
  await writeFile('public/favicon.ico', ico(frames.filter((frame) => [16, 32, 48].includes(frame.size))));
  await writeFile(
    'public/brand/last-stop.ico',
    ico(frames.filter((frame) => [16, 32, 48].includes(frame.size))),
  );
  await writeFile('release/windows/LastStop.ico', ico(frames));
  const image = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(master);
  const compact = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(small);
  const mask = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maskable);
  await page.setViewportSize({ width: 1000, height: 520 });
  await page.setContent(
    `<style>*{box-sizing:border-box}body{margin:0;background:#0b1c2b;font:16px sans-serif;color:#eff5f5}main{padding:30px;display:flex;gap:40px;align-items:center}h1{font-size:25px;margin:0 0 20px}section{display:flex;align-items:end;gap:24px;padding:25px;border-radius:12px;background:#203d4b}section.light{background:#eff5f5;color:#162c3b}figure{margin:0;text-align:center}figcaption{margin-top:10px;font-size:14px}footer{padding:0 30px;color:#c6dce3}</style><main><img src="${image}" width="256" height="256"/><div><h1>Last Stop</h1>${['', 'light'].map((theme) => `<section class="${theme}">${[16, 24, 32, 48, 64].map((size) => `<figure><img src="${size <= 32 ? compact : image}" width="${size}" height="${size}"/><figcaption>${size}px</figcaption></figure>`).join('')}<figure><img src="${mask}" width="64" height="64" style="border-radius:50%"/><figcaption>Maskable</figcaption></figure></section>`).join('')}</div></main><footer>Browser tab · Game menu · Installed app · Windows launcher</footer>`,
  );
  await page.screenshot({ path: 'artifacts/brand/icon-preview.png' });
  console.log('Exported browser, touch, install and Windows icons from the two SVG masters.');
} finally {
  await browser.close();
}
