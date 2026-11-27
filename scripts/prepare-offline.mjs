import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
async function files(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await files(p)));
    else out.push(p);
  }
  return out;
}
const paths = (await files('dist'))
  .map((p) => p.replaceAll('\\', '/').replace(/^dist\//, ''))
  .filter((p) => !p.startsWith('cards/') && p !== 'sw.js');
const hash = createHash('sha256');
for (const p of paths) hash.update(await readFile('dist/' + p));
const cache = `last-stop-${version}-${hash.digest('hex').slice(0, 12)}`;

await writeFile(
  'dist/sw.js',
  `const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(paths.map((p) => './' + p))};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('message',e=>{if(e.data==='activate')self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('last-stop-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==self.location.origin||e.request.method!=='GET'||u.pathname.endsWith('/__desktop')||u.pathname.endsWith('/__alive'))return;e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request);if(cached)return cached;try{return await fetch(e.request);}catch(error){if(e.request.mode==='navigate')return await c.match('./index.html');throw error;}}));});`,
);
let html = await readFile('dist/index.html', 'utf8');
html = html.replace(
  '</head>',
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:11434; object-src 'none'; base-uri 'self'; worker-src 'self'\"/></head>",
);
await writeFile('dist/index.html', html);
console.log(`Prepared offline release ${version}: ${paths.length} cached files.`);
