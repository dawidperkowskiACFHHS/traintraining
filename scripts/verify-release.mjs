import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:53621';
async function menuAction(page, action) {
  await page.locator('.header-tools [data-action=tools]').click();
  await page.locator('#overlay [data-action=' + action + ']').click();
}
const occupied = await fetch(origin + '/__desktop', { signal: AbortSignal.timeout(800) })
  .then(() => true)
  .catch(() => false);
assert(!occupied, 'Close the running game before packaged verification.');
const server = spawn(resolve('releases/Last-Stop-Windows/Last Stop.exe'), ['--serve-only'], {
  windowsHide: true,
  stdio: 'ignore',
});
let browser;
const errors = [],
  networkErrors = [];
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(origin + '/__desktop');
      if ((await r.json()).app === 'last-stop') {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  assert(ready, 'Packaged launcher did not start');
  assert.equal((await fetch(origin + '/package.json')).status, 404);
  assert.equal((await fetch(origin + '/__desktop', { method: 'POST' })).status, 405);
  const profile = resolve('artifacts/release/browser-profile');
  const launch = () =>
    chromium.launchPersistentContext(profile, {
      channel: 'msedge',
      headless: true,
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    });
  let context = (browser = await launch());
  await context.route('http://127.0.0.1:11434/**', (route) =>
    route.fulfill({ status: 503, body: 'offline release test' }),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('11434')) networkErrors.push(r.status() + ' ' + r.url());
  });
  await page.goto(origin);
  await page.evaluate(async () => {
    localStorage.clear();
    for (const registration of await navigator.serviceWorker.getRegistrations())
      await registration.unregister();
    for (const name of await caches.keys()) await caches.delete(name);
  });
  await page.reload();
  await page.getByRole('button', { name: 'New journey', exact: true }).waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, {}, { timeout: 30000 });
  await mkdir('artifacts/release', { recursive: true });
  await page.screenshot({ path: 'artifacts/release/packaged-title.png' });
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await page.locator('[data-disclosure=journey-options] > summary').click();
  await page.locator('[name=seed]').fill('release-offline');
  await page.locator('[name=size]').selectOption('40');
  await page.locator('[name=pace]').selectOption('quick');
  await page.locator('[name=difficulty]').selectOption('relaxed');
  await page.getByRole('button', { name: 'Start game', exact: true }).click();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyD');
  await menuAction(page, 'save');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')));
  assert.equal(saved.session.difficulty, 'relaxed');
  assert.equal(saved.rules.targetPoints, 3);
  assert.equal(saved.world.stations.length, 40);
  await page.keyboard.press('Space');
  await page.screenshot({ path: 'artifacts/release/packaged-world.png' });
  await menuAction(page, 'settings');
  await page.locator('[data-disclosure=sound-levels] > summary').click();
  await page.getByRole('slider', { name: 'Music volume', exact: true }).fill('0.1');
  const download = page.waitForEvent('download');
  await page.locator('[data-disclosure=support] > summary').click();
  await page.getByRole('button', { name: 'Export playtest / support report', exact: true }).click();
  await (await download).saveAs('artifacts/release/support-report.json');
  await page.screenshot({ path: 'artifacts/release/packaged-settings.png' });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  assert.equal(
    await page.locator('#location h1').textContent(),
    saved.world.stations[saved.actors[0].station].name,
  );
  await menuAction(page, 'settings');
  await page.locator('[data-disclosure=sound-levels] > summary').click();
  assert.equal(
    await page.getByRole('slider', { name: 'Music volume', exact: true }).inputValue(),
    '.1'.replace(/^\./, '0.'),
  );
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await context.close();
  context = browser = await launch();
  await context.route('http://127.0.0.1:11434/**', (route) =>
    route.fulfill({ status: 503, body: 'offline release test' }),
  );
  const reopened = await context.newPage();
  reopened.setDefaultTimeout(12000);
  reopened.on('pageerror', (e) => errors.push(e.message));
  await reopened.goto(origin);
  await reopened.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  assert.equal(
    await reopened.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')).world.seed),
    'release-offline',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(networkErrors, []);
  await writeFile(
    'artifacts/release/verification.json',
    JSON.stringify(
      {
        packagedExecutable: true,
        readOnlyLoopbackServer: true,
        noDevelopmentRuntimeInLauncher: true,
        cleanAutomatedBrowserContext: true,
        nativeAppWindowLaunch: 'manual verification pending',
        offlineReload: true,
        saveResume: true,
        persistentProfileAcrossBrowserRestart: true,
        persistentAudioPreferences: true,
        standard40StationBuild: true,
        errors,
        networkErrors,
        externalHumanTesting: 'pending',
        physicalController: 'pending',
        secondCleanComputer: 'pending',
      },
      null,
      2,
    ),
  );
  console.log(
    'Packaged Windows launcher, 40-station game, offline reload, preferences, save/resume and support report passed.',
  );
} finally {
  if (browser) await browser.close();
  server.kill();
}
