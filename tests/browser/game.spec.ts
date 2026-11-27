import { test, expect, Page, menuAction, openMenu, setSpeed } from './fixtures';
import {
  newGame,
  startRound,
  serialize,
  tick,
  answer,
  playCard,
  nextRound,
  walkTo,
  ask,
} from '../../src/simulation';
import { pathfind } from '../../src/local';
import { route } from '../../src/world';
import { mkdirSync, writeFileSync } from 'node:fs';
const SAVE = 'last-stop-match-v1';
async function seedSave(page: Page, raw: string) {
  await page.goto('/');
  await page
    .locator('#save-file')
    .setInputFiles({ name: 'test-match.json', mimeType: 'application/json', buffer: Buffer.from(raw) });
  await expect
    .poll(async () => JSON.parse(await page.evaluate((key) => localStorage.getItem(key)!, SAVE)).world.seed)
    .toBe(JSON.parse(raw).world.seed);
}
test('a human walks, boards a real timetable service, commits, saves and resumes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await page.locator('[data-disclosure=journey-options] > summary').click();
  await page.locator('[name=seed]').fill('browser-timetable');
  await page.locator('select[name=size]').selectOption('20');
  await page.getByRole('button', { name: 'Start game' }).click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(550);
  await page.keyboard.up('KeyW');
  await menuAction(page, 'save');
  const first = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE));
  expect(first.actors[0].y).toBeLessThan(36.5);
  const target = first.world.stations
    .filter((station: { id: number }) => station.id !== 0)
    .sort(
      (a: { id: number }, b: { id: number }) =>
        (route(first.world, 0, a.id, first.time + 1).at(-1)?.arrive ?? Infinity) -
        (route(first.world, 0, b.id, first.time + 1).at(-1)?.arrive ?? Infinity),
    )[0].id;
  await page.keyboard.press('KeyM');
  await expect(page.getByRole('dialog', { name: 'Region map' })).toBeVisible();
  await page.locator(`[data-action=select-station][data-index="${target}"]`).click();
  await page.getByRole('button', { name: 'Walk to platform & travel' }).click();
  await setSpeed(page, 4);
  await expect
    .poll(
      async () => {
        await menuAction(page, 'save');
        return JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE)).actors[0].station;
      },
      { timeout: 15000 },
    )
    .toBe(target);
  await page.locator('[data-action=commit]').click();
  await menuAction(page, 'save');
  const saved = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE));
  expect(saved.committed).toBe(target);
  expect(saved.world.stations.length).toBe(20);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/hider-town.png', fullPage: true, animations: 'disabled' });
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match' }).click();
  await expect(page.locator('#location h1')).toHaveText(saved.world.stations[target].name);
  await page.keyboard.press('Space');
  await page.screenshot({ path: 'artifacts/resumed-town.png', fullPage: true, animations: 'disabled' });
  expect(errors).toEqual([]);
});
test('human seeker uses all categories, notebook photos, teammate and curse tasks', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = newGame('browser-evidence', 30, 'seeker');
  s.phase = 'search';
  s.time = 130;
  s.searchAt = 130;
  s.committed = 2;
  s.actors[1].station = 2;
  s.actors[0].previous = 1;
  s.actors.forEach((a) => (a.nextThink = 9999));
  s.rules.questionCooldown = 0;
  s.rules.cardCooldown = 0;
  s.hand = [6, 20, 21];
  await seedSave(page, serialize(s));
  for (const category of ['Matching', 'Measuring', 'Radar', 'Thermometer', 'Tentacles', 'Photo']) {
    await menuAction(page, 'questions');
    await page.locator(`[data-action=category][data-value="${category}"]`).click();
    await page.locator('[data-action=ask]:not(:disabled)').first().click();
    await page.waitForTimeout(450);
  }
  await page.keyboard.press('KeyN');
  await expect(page.locator('.evidence')).toHaveCount(6);
  await expect(page.locator('.postcard img')).toBeVisible();
  await page.screenshot({ path: 'artifacts/seeker-evidence.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Close panel' }).click();
  await openMenu(page);
  await page.locator('#overlay [data-action=team]').click();
  await page.getByRole('button', { name: /Search this area/ }).click();
  await expect(page.locator('.radio-copy')).toContainText('courtyards');
  await menuAction(page, 'save');
  const raw = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE));
  expect(raw.teamCommand).toBe('Search this area');
  expect(errors).toEqual([]);
});
test('human hider answers, selects rewards, pays card costs and gets a truthful photo', async ({ page }) => {
  const s = newGame('browser-cards', 20);
  s.phase = 'search';
  s.time = 130;
  s.searchAt = 130;
  s.committed = 2;
  s.actors[0].station = 2;
  s.actors.forEach((a) => (a.nextThink = 9999));
  s.hand = [3, 20, 21];
  s.pending = { id: 'photo-station', origin: 0, previous: 0, askedBy: 1, changed: false };
  await seedSave(page, serialize(s));
  await expect(page.getByRole('dialog', { name: 'Question received' })).toBeVisible();
  await page.locator('[data-action=prepare-answer]').click();
  await page.getByRole('button', { name: 'Send reply', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Choose your reward' })).toBeVisible();
  await page.locator('[data-action=reward-pick]').first().click();
  await page.getByRole('button', { name: 'Keep 1 / 1 selected' }).click();
  await page.keyboard.press('KeyR');
  await page.locator('#hand [data-action=inspect]').first().click();
  await page.locator('[data-action=extra][data-index="1"]').click();
  await page.getByRole('button', { name: 'Play card', exact: true }).click();
  await expect(page.locator('#effects')).toContainText('Wrong Platform');
  await page.screenshot({ path: 'artifacts/hider-card-played.png', fullPage: true, animations: 'disabled' });
  await openMenu(page);
  await page.locator('#overlay [data-action=cards]').click();
  await expect(page.locator('.card-library .travel-card')).toHaveCount(24);
  await page.locator('[data-action=library-card][data-index="19"]').click();
  await expect(page.locator('.card-rules')).toContainText('Once during local search');
  await page.screenshot({ path: 'artifacts/card-guide.png', fullPage: true, animations: 'disabled' });
});
test('desktop viewport, accessible settings, rebinding and simulated gamepad input', async ({ page }) => {
  const s = newGame('controls', 20);
  startRound(s);
  s.actors.forEach((a) => (a.nextThink = 9999));
  await seedSave(page, serialize(s));
  await page.setViewportSize({ width: 1280, height: 800 });
  await menuAction(page, 'settings');
  await page.locator('[data-disclosure=controls] > summary').click();
  await page.locator('[data-action=remap][data-value="up"]').click();
  await page.keyboard.press('KeyI');
  await expect(page.locator('[data-action=remap][data-value="up"] kbd')).toHaveText('I');
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [
        {
          axes: [1, 0],
          buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0, touched: false })),
          connected: true,
          index: 0,
          id: 'test-standard',
          mapping: 'standard',
          timestamp: 1,
        },
      ],
    });
  });
  await page.waitForTimeout(600);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }),
  );
  await menuAction(page, 'save');
  const saved = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE));
  expect(saved.actors[0].x).toBeGreaterThan(31);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const setPadButton = async (button: number | null) => {
    await page.evaluate(
      (button) =>
        Object.defineProperty(navigator, 'getGamepads', {
          configurable: true,
          value: () => [
            {
              axes: [0, 0],
              buttons: Array.from({ length: 16 }, (_, i) => ({
                pressed: i === button,
                value: i === button ? 1 : 0,
                touched: false,
              })),
              connected: true,
              index: 0,
              id: 'test-standard',
              mapping: 'standard',
              timestamp: 1,
            },
          ],
        }),
      button,
    );
    await page.waitForTimeout(180);
  };
  await setPadButton(3);
  await setPadButton(null);
  await expect(page.getByRole('dialog', { name: 'Region map' })).toBeVisible();
  await setPadButton(0);
  await setPadButton(null);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/desktop-1280.png', fullPage: true, animations: 'disabled' });
});

async function advanceHumanRound(page: Page, seconds = 75) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    if (await page.locator('[data-action=replay]').count()) return;
    try {
      if (await page.locator('.capture-banner').isVisible()) {
        await page.locator('#capture-continue').click({ timeout: 750 });
      } else if (await page.locator('[data-action=prepare-answer]').count()) {
        await page.locator('[data-action=prepare-answer]').click({ timeout: 750 });
      } else if (await page.locator('[data-action=answer]').count()) {
        const choices = page.locator('[data-action=answer]');
        const count = await choices.count();
        for (let index = 0; index < count && (await choices.count()); index++)
          await choices.nth(index).click();
      } else if (await page.locator('[data-action=keep-reward]').count()) {
        const text = await page.locator('[data-action=keep-reward]').innerText(),
          keep = Number(text.match(/\/ (\d+)/)?.[1] || 1);
        const cards = page.locator('[data-action=reward-pick]');
        for (let i = 0; i < keep; i++) await cards.nth(i).click();
        await page.locator('[data-action=keep-reward]').click();
      } else if (await page.locator('[data-action=overflow-discard]').count())
        await page.locator('[data-action=overflow-discard]').first().click();
      else if ((await page.locator('.speed-rates [data-value="4"]').getAttribute('aria-pressed')) !== 'true')
        await setSpeed(page, 4, 750);
    } catch (error) {
      if (
        !(await page
          .locator(
            '[data-action=replay],[data-action=prepare-answer],[data-action=answer],[data-action=keep-reward],[data-action=overflow-discard]',
          )
          .count())
      )
        throw error;
    }
    await page.waitForTimeout(120);
  }
  throw new Error('The live browser round did not finish within the test budget.');
}

test('live human hider faces autonomous seekers, reaches results, replays and rotates role', async ({
  page,
}) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const s = newGame('live-opponents', 20);
  s.autoHuman = true;
  startRound(s);
  tick(s, 115);
  s.autoHuman = false;
  s.rules.searchCap = 90;
  await seedSave(page, serialize(s));
  await advanceHumanRound(page);
  await page.locator('.modal [data-action=save]').click();
  const done = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE));
  expect(done.results[0].forfeit).toBe(false);
  expect(done.results[0].survival).toBeGreaterThan(0);
  expect(done.evidence.length).toBeGreaterThan(0);
  expect(done.events.some((e: { type: string; actor: number }) => e.type === 'board' && e.actor !== 0)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/round-results.png', fullPage: true, animations: 'disabled' });
  await page.locator('[data-action=replay]').click();
  await expect(page.locator('#replay-time')).toBeVisible();
  await page.screenshot({ path: 'artifacts/round-replay.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Close panel' }).click();
  await page.locator('[data-action=next]').click();
  await expect(page.locator('.role-label')).toContainText('SEEKING');
  await expect(page.locator('.hud-role strong')).toHaveText('SEEKER');
  expect(errors).toEqual([]);
});

test('a coordinated seeker party physically clears a curse and investigates together', async ({ page }) => {
  test.setTimeout(100000);
  const s = newGame('live-companion', 20, 'seeker');
  startRound(s);
  tick(s, 120.2);
  s.rules.searchCap = 90;
  s.autoHuman = true;
  // Give the NPC a legal, predictable opening hand while conserving every deck copy.
  s.deck.push(...s.hand);
  s.hand = [];
  for (const id of [0, 20, 21]) {
    const index = s.deck.indexOf(id);
    s.hand.push(...s.deck.splice(index, 1));
  }
  expect(playCard(s, 0)).toBeNull();
  await seedSave(page, serialize(s));
  await menuAction(page, 'questions');
  const available = page.locator('[data-action=ask]:not(:disabled)');
  if (await available.count()) await available.first().click();
  else await page.getByRole('button', { name: 'Close panel' }).click();
  await advanceHumanRound(page);
  await page.locator('.modal [data-action=save]').click();
  const done = JSON.parse(await page.evaluate((k) => localStorage.getItem(k)!, SAVE));
  writeFileSync('artifacts/party-round-state.json', JSON.stringify(done, null, 2));
  expect(done.cleared).toContain(0);
  expect(done.events.some((e: { type: string }) => e.type === 'teammate')).toBe(true);
  expect(done.actors[2].station).toBe(done.actors[0].station);
  expect(Math.hypot(done.actors[2].x - done.actors[0].x, done.actors[2].y - done.actors[0].y)).toBeLessThan(
    6,
  );
  await page.screenshot({ path: 'artifacts/teammate-results.png', fullPage: true, animations: 'disabled' });
});

test('explicit human tag, completed-match winner and replay controls', async ({ page }) => {
  const s = newGame('human-tag', 20, 'seeker');
  s.phase = 'search';
  s.time = 140;
  s.searchAt = 120;
  s.localAt = 130;
  s.locked = true;
  s.committed = 2;
  s.actors.forEach((a) => (a.nextThink = 9999));
  const t = s.world.stations[2].local,
    spot = t.spots[0],
    neighbor = pathfind(t, spot, t.platform)[0];
  s.actors[0].station = 2;
  Object.assign(s.actors[0], neighbor);
  s.actors[1].station = 2;
  Object.assign(s.actors[1], spot);
  await seedSave(page, serialize(s));
  await page.keyboard.press('KeyE');
  await expect(page.locator('.results-body')).toContainText('Tagged by You');
  const match = newGame('winner-screen', 20);
  match.autoHuman = true;
  let steps = 0;
  while (match.phase !== 'finished' && steps++ < 20000) {
    if (match.phase === 'preparation') startRound(match);
    else if (match.phase === 'results') nextRound(match);
    else tick(match, 3);
  }
  expect(match.phase).toBe('finished');
  await page.locator('#save-file').setInputFiles({
    name: 'completed-match.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(match)),
  });
  await expect(page.locator('.modal-header')).toContainText('won the match');
  await page.screenshot({ path: 'artifacts/match-winner.png', fullPage: true, animations: 'disabled' });
});

test('stamp puzzle keeps time, interiors cut away, photos match the room, and coastal streets render', async ({
  page,
}) => {
  test.setTimeout(60000);
  const s = newGame('paperwork', 20, 'seeker');
  s.phase = 'search';
  s.time = 130;
  s.searchAt = 130;
  s.committed = 2;
  s.actors[1].station = 2;
  s.actors.forEach((a) => (a.nextThink = 9999));
  s.hand = [2];
  playCard(s, 0);
  s.effects[0].resolveAt = s.time + 29;
  const stamps = [...s.effects[0].puzzle!];
  await seedSave(page, serialize(s));
  await page.locator('#effects [data-action=effect][data-index="2"]').click();
  for (const symbol of stamps) await page.locator(`[data-action=stamp][data-index="${symbol}"]`).click();
  await page.screenshot({ path: 'artifacts/paperwork-puzzle.png', fullPage: true, animations: 'disabled' });
  await expect(page.locator('[data-action=solve-forms]')).toBeEnabled({ timeout: 12000 });
  await page.locator('[data-action=solve-forms]').click();
  await expect(page.locator('#effects')).not.toContainText('Department of Forms');
  const inside = newGame('visual-tour', 30);
  startRound(inside);
  inside.actors[0].station = 1;
  inside.committed = 1;
  Object.assign(inside.actors[0], inside.world.stations[1].local.platform);
  walkTo(inside, 0, inside.world.stations[1].local.buildings[0].interior);
  tick(inside, 25);
  expect(inside.actors[0].inside).toBe(0);
  inside.phase = 'search';
  inside.searchAt = inside.time;
  inside.autoHuman = true;
  ask(inside, 'photo-position', 1);
  answer(inside);
  inside.autoHuman = false;
  inside.actors.forEach((a) => (a.nextThink = 9999));
  await page.locator('#save-file').setInputFiles({
    name: 'interior.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(inside)),
  });
  await expect(page.locator('#location h1')).toHaveText(inside.world.stations[1].name);
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'artifacts/interior-cutaway.png', fullPage: true, animations: 'disabled' });
  await page.keyboard.press('KeyN');
  await expect(page.locator('.postcard img')).toBeVisible();
  await page.screenshot({ path: 'artifacts/interior-photo.png', fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Close panel' }).click();
  const coast = newGame('visual-tour', 30);
  startRound(coast);
  const coastIndex = coast.world.stations.findIndex((station) => station.kind === 'coast');
  expect(coastIndex).toBeGreaterThanOrEqual(0);
  coast.actors[0].station = coastIndex;
  coast.committed = coastIndex;
  Object.assign(coast.actors[0], coast.world.stations[coastIndex].local.platform);
  walkTo(coast, 0, { x: 49.5, y: 17.5 });
  tick(coast, 20);
  await page.locator('#save-file').setInputFiles({
    name: 'coast.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(coast)),
  });
  await expect(page.locator('#location h1')).toHaveText(coast.world.stations[coastIndex].name);
  await page.waitForTimeout(650);
  await page.screenshot({ path: 'artifacts/coastal-town.png', fullPage: true, animations: 'disabled' });
  const style = await page.addStyleTag({ content: '#world-wrap{filter:grayscale(1)}' });
  await page.screenshot({ path: 'artifacts/value-read.png', fullPage: true, animations: 'disabled' });
  await style.evaluate((el) => el.parentNode?.removeChild(el));
});
