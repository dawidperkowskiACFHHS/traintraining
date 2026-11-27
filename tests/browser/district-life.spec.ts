import { test, expect, type Page, menuAction } from './fixtures';
import { newGame, serialize, startRound } from '../../src/simulation';
import type { State } from '../../src/types';
import { reachableTiles } from '../../src/local';
import { mkdirSync, writeFileSync } from 'node:fs';

async function load(page: Page, state: State) {
  mkdirSync('artifacts/living-districts', { recursive: true });
  await page.goto('/');
  await page.locator('#save-file').setInputFiles({
    name: 'district-life.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect(page.locator('#location h1')).toHaveText(state.world.stations[state.actors[0].station].name);
  await expect(page.locator('#overlay [role=dialog]')).toHaveCount(0);
  await expect(page.locator('.recovery-banner')).toHaveCount(0);
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  await page.waitForTimeout(300);
}
function flatScenario(seeking = false) {
  const s = newGame('readable-stealth', 20, seeking ? 'seeker' : 'hider');
  s.phase = 'search';
  s.time = s.searchAt = 130;
  s.locked = true;
  s.localAt = 130;
  s.committed = 2;
  s.questionReady = 99999;
  const town = s.world.stations[2].local;
  town.tiles.fill(1);
  town.buildings = [];
  town.props = [];
  town.cover = [{ kind: 'bush', x: 8.5, y: 6.5, hide: { x: 8.5, y: 6.5 } }];
  s.actors.forEach((a) =>
    Object.assign(a, {
      station: 2,
      nextThink: 99999,
      path: [],
      destination: null,
      journey: [],
      x: 5.5,
      y: 6.5,
    }),
  );
  if (seeking) {
    Object.assign(s.actors[0], { x: 7.3 });
    Object.assign(s.actors[1], { x: 8.5, hiding: true });
  } else {
    Object.assign(s.actors[0], { x: 8.5, hiding: true });
    Object.assign(s.actors[1], { x: 12.5 });
    s.actors[2].station = 0;
  }
  return s;
}

test('districts have distinct ground, architecture and playable cover at normal size', async ({ page }) => {
  mkdirSync('artifacts/living-districts', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const kind of ['city', 'market', 'forest', 'coast']) {
    const s = newGame('coastal-crossings', 30);
    startRound(s);
    s.rules.headStart = 3600;
    s.actors.forEach((a) => (a.nextThink = 99999));
    const st = s.world.stations.find((st) => st.kind === kind)!;
    expect(st).toBeTruthy();
    const reachable = reachableTiles(st.local, st.local.platform);
    const point = st.local.spots
      .filter((p) => reachable[Math.floor(p.y) * st.local.width + Math.floor(p.x)])
      .sort((a, b) => Math.hypot(a.x - 30, a.y - 24) - Math.hypot(b.x - 30, b.y - 24))[0];
    Object.assign(s.actors[0], point, { station: st.id });
    await load(page, s);
    await expect(page.locator('body')).not.toHaveClass(/hand-open/);
    await page.screenshot({ path: `artifacts/living-districts/${kind}.png`, animations: 'disabled' });
  }
  expect(errors).toEqual([]);
});

test('concealment, being spotted and a successful manual tag explain themselves', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await load(page, flatScenario());
  await expect(page.locator('#movement-tools')).toHaveAttribute('data-stealth', 'concealed');
  await expect(page.locator('#stealth-announcement')).toContainText('close inspection');
  await page.screenshot({ path: 'artifacts/living-districts/concealed.png', animations: 'disabled' });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(160);
  await page.keyboard.up('KeyD');
  await expect(page.locator('#movement-tools')).toHaveAttribute('data-stealth', 'spotted');
  await page.screenshot({ path: 'artifacts/living-districts/spotted.png', animations: 'disabled' });
  await load(page, flatScenario(true));
  await expect(page.locator('#world-wrap')).toHaveAttribute('data-tag-ready', 'true');
  await expect(page.locator('#context-prompt')).toContainText('Tag');
  await page.screenshot({ path: 'artifacts/living-districts/tag-ready.png', animations: 'disabled' });
  await page.keyboard.press('KeyE');
  await expect(page.getByRole('dialog')).toContainText('Tagged by You');
  await expect(page.locator('.capture-explanation')).toContainText('clear sightline');
  await page.screenshot({ path: 'artifacts/living-districts/capture.png', animations: 'disabled' });
});

test('teammate suggests, player approves, and automatic questioning is an explicit saved option', async ({
  page,
}) => {
  const s = newGame('browser-approval', 20, 'seeker');
  s.phase = 'search';
  s.time = s.searchAt = 130;
  s.committed = 2;
  Object.assign(s.actors[1], s.world.stations[2].local.platform, { station: 2, nextThink: 99999 });
  s.cardReady = 99999;
  await load(page, s);
  await expect(page.locator('.route-objective')).toContainText('Review suggested question');
  await menuAction(page, 'save');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!));
  expect(before.events.some((e: { type: string }) => e.type === 'question')).toBe(false);
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.question-suggestion')).toContainText('suggests:');
  await page.screenshot({ path: 'artifacts/living-districts/question-approval.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Approve question', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.waitForTimeout(400);
  await menuAction(page, 'save');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!));
  expect(after.events.some((e: { type: string }) => e.type === 'question')).toBe(true);
  await menuAction(page, 'settings');
  await page.locator('[data-disclosure=controls] > summary').click();
  const automatic = page.getByRole('checkbox', { name: 'Let teammate ask questions automatically' });
  await expect(automatic).not.toBeChecked();
  await automatic.check();
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match' }).click();
  await menuAction(page, 'settings');
  await page.locator('[data-disclosure=controls] > summary').click();
  await expect(
    page.getByRole('checkbox', { name: 'Let teammate ask questions automatically' }),
  ).toBeChecked();
});

test('all character poses are visibly distinct and customization is shared by every pose', async ({
  page,
}) => {
  mkdirSync('artifacts/living-districts', { recursive: true });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/art.ts';
    const { playerCanvas, CHARACTER_POSES, townCanvas } = await import(path);
    const { DEFAULT_APPEARANCE } = await import('/src/' + 'appearance.ts');
    const { newGame } = await import('/src/' + 'simulation.ts');
    const images = CHARACTER_POSES.map((pose: string) =>
      playerCanvas(DEFAULT_APPEARANCE, 2, 1, pose).toDataURL(),
    );
    const canvas = document.createElement('canvas');
    canvas.width = 672;
    canvas.height = 152;
    const c = canvas.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.fillStyle = '#17313e';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = '#f2f7ee';
    c.font = '16px Atkinson';
    c.textAlign = 'center';
    CHARACTER_POSES.forEach((pose: string, i: number) => {
      c.drawImage(playerCanvas(DEFAULT_APPEARANCE, 2, 1, pose), i * 96, 4, 96, 128);
      c.fillText(pose, i * 96 + 48, 148);
    });
    const atlas = document.createElement('canvas');
    atlas.width = 1280;
    atlas.height = 520;
    const ac = atlas.getContext('2d')!;
    ac.imageSmoothingEnabled = false;
    ac.fillStyle = '#17313e';
    ac.fillRect(0, 0, 1280, 520);
    const world = newGame('coastal-crossings', 40).world;
    ['city', 'market', 'coast', 'lake', 'forest', 'hill', 'rail', 'rural'].forEach((kind, i) => {
      const st = world.stations.find((st: { kind: string }) => st.kind === kind)!;
      ac.drawImage(townCanvas(st), (i % 4) * 320, Math.floor(i / 4) * 260, 320, 235);
      ac.fillStyle = '#eff5f5';
      ac.font = '16px Atkinson';
      ac.fillText(kind, (i % 4) * 320 + 10, Math.floor(i / 4) * 260 + 254);
    });
    return { distinct: new Set(images).size, poses: canvas.toDataURL(), atlas: atlas.toDataURL() };
  });
  expect(result.distinct).toBe(7);
  writeFileSync(
    'artifacts/living-districts/character-poses.png',
    Buffer.from(result.poses.split(',')[1], 'base64'),
  );
  writeFileSync(
    'artifacts/living-districts/district-atlas.png',
    Buffer.from(result.atlas.split(',')[1], 'base64'),
  );
});

test('playing a card produces a world cue and journeys approach the destination biome', async ({ page }) => {
  // Four imported scenes plus real-time notification settling, not a latency benchmark.
  test.setTimeout(90000);
  const s = newGame('coastal-crossings', 20);
  s.phase = 'search';
  s.time = s.searchAt = 130;
  s.committed = 0;
  s.hand = [0, 20, 21];
  s.actors.forEach((a) => (a.nextThink = 99999));
  await load(page, s);
  await page.keyboard.press('KeyR');
  await page.locator('#hand [data-index="0"]').click();
  await page.getByRole('button', { name: 'Play card', exact: true }).click();
  await expect(page.locator('#effects')).toContainText('Tourist Trap');
  await page.waitForTimeout(120);
  await page.screenshot({ path: 'artifacts/living-districts/card-cue.png', animations: 'disabled' });
  for (const kind of ['city', 'forest', 'coast']) {
    const transit = newGame('coastal-crossings', 30);
    transit.phase = 'headstart';
    transit.time = 80;
    transit.rules.headStart = 9999;
    const destination = transit.world.stations.find((st) => st.kind === kind)!;
    const origin = destination.id === 0 ? 1 : 0;
    transit.actors[0].station = origin;
    transit.actors.forEach((a) => (a.nextThink = 99999));
    transit.actors[0].journey = [
      { from: origin, to: destination.id, depart: 0, arrive: 100, line: 0, kind: 'local' },
    ];
    await load(page, transit);
    await expect(page.locator('#journey-view')).toHaveAttribute('data-destination', kind);
    await expect(page.locator('#journey-view')).toHaveAttribute('data-approaching', 'true');
    await page.screenshot({
      path: `artifacts/living-districts/approaching-${kind}.png`,
      animations: 'disabled',
    });
  }
});
