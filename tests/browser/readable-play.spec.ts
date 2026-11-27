import { test, expect, type Page, menuAction, setSpeed } from './fixtures';
import { newGame, startRound, serialize, ask, answer } from '../../src/simulation';
import { answerChallenge } from '../../src/answer-challenge';
import { mkdirSync } from 'node:fs';
import type { State } from '../../src/types';
import { residentActivity, residentLine } from '../../src/residents';
import { walkable, lineOfSight } from '../../src/local';

async function load(page: Page, state: State) {
  await page.goto('/');
  await page.locator('#save-file').setInputFiles({
    name: 'field-play.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect(page.locator('#location h1')).toHaveText(state.world.stations[state.actors[0].station].name);
}
function seeking() {
  const state = newGame('readable-journey', 20, 'seeker');
  state.phase = 'search';
  state.time = state.searchAt = 130;
  state.committed = 3;
  state.actors[1].station = 3;
  state.actors.forEach((a) => (a.nextThink = 1e9));
  state.cardReady = 1e9;
  return state;
}
test.beforeEach(async ({ page }) => {
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
});

test('human chooses a reply, retries safely, and answers with keyboard or controller', async ({ page }) => {
  const state = newGame('field-guide-replies', 20, 'hider');
  state.phase = 'search';
  state.time = state.searchAt = 130;
  state.committed = 3;
  state.actors[0].station = 3;
  state.actors.forEach((a) => (a.nextThink = 1e9));
  state.pending = { id: 'zone', origin: 0, previous: 0, askedBy: 1, changed: false };
  const challenge = answerChallenge(state)!;
  await load(page, state);
  await expect(page.locator('.panel-clock')).toContainText('Clock paused');
  await expect(page.locator('.field-guide')).toContainText(state.world.stations[3].name);
  const wrong = challenge.correct === 'Yes' ? 'No' : 'Yes';
  await page.getByRole('button', { name: wrong, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Nothing has been sent');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!).evidence.length),
  ).toBe(0);
  await page.screenshot({ path: 'artifacts/field-play/answer-retry.png', animations: 'disabled' });
  await page.getByRole('button', { name: challenge.correct, exact: true }).focus();
  await page.evaluate(() => {
    const pad = {
      id: 'Field controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, (_, i) => ({
        pressed: i === 0,
        touched: i === 0,
        value: i === 0 ? 1 : 0,
      })),
      timestamp: performance.now(),
    };
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad] });
  });
  await expect(page.getByRole('dialog', { name: 'Choose your reward' })).toBeVisible();
});

test('head-start skip and compact investigation expose the next action and clock', async ({ page }) => {
  const state = newGame('fast-preparation', 20, 'seeker');
  startRound(state);
  await load(page, state);
  await page.getByRole('button', { name: 'Skip remaining head start' }).click();
  await expect(page.locator('.clock-label')).toContainText('Search');
  await page.keyboard.press('KeyQ');
  await expect(page.locator('.compact-panel')).toBeVisible();
  await expect(page.locator('.panel-clock')).toContainText('Clock paused');
  const rect = (await page.locator('.compact-panel .modal').boundingBox())!;
  expect(rect.width).toBeLessThanOrEqual(440);
  await page.screenshot({ path: 'artifacts/field-play/investigation.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toBeVisible();
});

test('bridge task gives directions, progress and a visible completion without opening a card guide', async ({
  page,
}) => {
  const state = seeking();
  const platform = state.world.stations[0].local.platform;
  state.effects = [
    {
      card: 1,
      slot: 'investigation',
      until: 190,
      target: { station: 0, ...platform },
      progress: 0,
      charges: 0,
      cleared: false,
    },
  ];
  // Put both seekers far enough from the task to inspect the initial directions first.
  state.actors[0].x -= 3;
  state.actors[2].x -= 3;
  await load(page, state);
  await expect(page.locator('#effects')).toContainText('Go to bridge');
  await page.locator('#effects [data-action=effect]').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#effects')).toContainText('Stay', { timeout: 10000 });
  await page.screenshot({ path: 'artifacts/field-play/curse-task.png', animations: 'disabled' });
  await setSpeed(page, 4);
  await expect(page.locator('#effects')).not.toContainText('Bridge Club', { timeout: 10000 });
  await expect(page.locator('#game-notice')).toContainText('Bridge Club: cleared');
  await page.screenshot({ path: 'artifacts/field-play/curse-cleared.png', animations: 'disabled' });
});

test('map explains exclusions, highlights the chosen itinerary and keeps the destination while walking', async ({
  page,
}) => {
  const state = seeking();
  expect(ask(state, 'zone')).toBeNull();
  answer(state);
  await load(page, state);
  await page.keyboard.press('KeyM');
  await expect(page.locator('.map-clue')).toContainText('places crossed off');
  await expect(page.locator('.last-excluded')).not.toHaveCount(0);
  await page.locator('.last-excluded').first().click();
  await expect(page.locator('.map-exclusion-reason')).toContainText('The hider replied');
  await page.locator('[data-action=select-station][data-index="1"]').click();
  await expect(page.locator('.selected-route')).not.toHaveCount(0);
  await expect(page.locator('.station-node > image')).toHaveCount(20);
  await page.screenshot({ path: 'artifacts/field-play/map-route.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Walk to platform & travel' }).click();
  await expect(page.locator('#world-status')).toContainText(state.world.stations[1].name);
  await expect(page.locator('#world-status')).toContainText(
    /Walking to the platform|Waiting on the platform/,
  );
});

test('the real service stops, the party boards visibly, and the view becomes a moving interior', async ({
  page,
}) => {
  const state = seeking();
  const leg = {
    from: 0,
    to: 1,
    depart: state.time + 5,
    arrive: state.time + 35,
    kind: 'local' as const,
    line: 0,
  };
  state.actors[0].journey = [leg];
  state.actors[2].journey = [{ ...leg }];
  await load(page, state);
  await expect(page.locator('#world-status')).toContainText('Waiting on the platform');
  await page.screenshot({ path: 'artifacts/field-play/service-stopping.png', animations: 'disabled' });
  await expect(page.locator('#journey-view')).toHaveAttribute('data-stage', 'boarding', { timeout: 10000 });
  await page.screenshot({ path: 'artifacts/field-play/boarding.png', animations: 'disabled' });
  await expect(page.locator('#journey-view')).toHaveAttribute('data-stage', 'riding');
  await expect(page.locator('#journey-caption')).toContainText(state.world.stations[1].name);
  await page.screenshot({ path: 'artifacts/field-play/train-interior.png', animations: 'disabled' });
});

test('compact task remains usable at 140 percent with a truthful running clock', async ({ page }) => {
  const state = seeking();
  state.settings.textScale = 1.4;
  state.effects = [
    {
      card: 2,
      slot: 'investigation',
      until: state.time + 30,
      progress: 0,
      charges: 0,
      puzzle: [0, 1, 2],
      input: [],
      cleared: false,
    },
  ];
  await page.setViewportSize({ width: 880, height: 700 });
  await load(page, state);
  await page.locator('#effects [data-action=effect]').click();
  await expect(page.locator('.panel-clock')).toContainText('Clock running');
  for (const index of [0, 1, 2]) await page.locator(`[data-action=stamp][data-index="${index}"]`).click();
  await expect(page.locator('.stamped')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/field-play/paperwork-140.png', animations: 'disabled' });
  await expect(page.getByRole('button', { name: 'Submit stamped form' })).toBeInViewport();
});

test('player remains visible under overlapping scenery at ordinary game zoom', async ({ page }) => {
  const state = seeking(),
    town = state.world.stations[0].local,
    building = town.buildings[0];
  Object.assign(state.actors[0], { x: building.x - 0.4, y: building.y + 1.5 });
  await load(page, state);
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 6000 });
  await page.screenshot({ path: 'artifacts/field-play/player-behind-roof.png', animations: 'disabled' });
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyA');
  await page.screenshot({ path: 'artifacts/field-play/player-beside-roof.png', animations: 'disabled' });
});

test('bus, ferry and walking journeys keep their correct visual identity', async ({ page }) => {
  for (const [kind, label] of [
    ['bus', 'Bus'],
    ['ferry', 'Ferry'],
    ['walk', 'On foot'],
  ] as const) {
    const state = seeking();
    state.actors[0].journey = [
      { from: 0, to: 1, depart: state.time + 0.4, arrive: state.time + 30, kind, line: 0 },
    ];
    await load(page, state);
    await expect(page.locator('#journey-caption')).toContainText(label);
    await expect(page.locator('#journey-view')).toHaveAttribute('data-stage', 'riding');
    await page.screenshot({ path: `artifacts/field-play/${kind}-journey.png`, animations: 'disabled' });
  }
});

test('hider and seeker roles have persistent badges, clear jobs and a readable role introduction', async ({
  page,
}) => {
  for (const mode of ['hider', 'seeker'] as const) {
    const state = newGame('role-clarity-' + mode, 20, mode);
    startRound(state);
    state.actors.forEach((a) => (a.nextThink = 1e9));
    await page.setViewportSize({ width: 1280, height: 800 });
    await load(page, state);
    await expect(page.locator('body')).toHaveAttribute('data-role', mode);
    await expect(page.locator('.hud-role strong')).toHaveText(mode.toUpperCase());
    await expect(page.locator('.role-intro-title')).toHaveText('You are the ' + mode.toUpperCase());
    await expect(page.locator('.hud-role')).toBeInViewport();
    await page.screenshot({ path: `artifacts/field-play/${mode}-role.png`, animations: 'disabled' });
    await menuAction(page, 'settings');
    await page.locator('#text-scale').focus();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Close panel', exact: true }).click();
    await page.setViewportSize({ width: 880, height: 700 });
    await expect(page.locator('.hud-role strong')).toBeInViewport();
    const bounds = await page.locator('.hud-role').boundingBox(),
      clock = await page.locator('.journey-clock').boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThan(clock!.x);
    await page.screenshot({ path: `artifacts/field-play/${mode}-role-140.png`, animations: 'disabled' });
  }
});

test('residents speak in anchored readable bubbles, retain full notes, and respect reduced motion', async ({
  page,
}) => {
  for (const reduced of [false, true]) {
    const state = seeking();
    state.settings.reducedMotion = reduced;
    const station = state.world.stations[0],
      person = residentActivity(station, 0, reduced ? 0 : state.time);
    const offset = [
      [-1.3, 0],
      [1.3, 0],
      [0, 1.3],
      [0, 0],
    ].find(
      ([dx, dy]) =>
        walkable(station.local, person.x + dx, person.y + dy) &&
        lineOfSight(station.local, person, { x: person.x + dx, y: person.y + dy }),
    )!;
    Object.assign(state.actors[0], { x: person.x + offset[0], y: person.y + offset[1] });
    await load(page, state);
    await expect(page.getByRole('button', { name: /Talk to/ })).toBeVisible();
    if (reduced) await page.keyboard.press('KeyE');
    else await page.getByRole('button', { name: /Talk to/ }).click();
    const bubble = page.locator('.speech-bubble[data-speaker="3"]');
    await expect(bubble).toBeVisible();
    await expect(bubble).toHaveAttribute('data-motion', reduced ? 'still' : 'talking');
    await expect(bubble.locator('p')).toContainText('Every service here uses the same clock');
    const box = await bubble.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(125);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
    await page.screenshot({
      path: `artifacts/field-play/resident-speech${reduced ? '-reduced' : ''}.png`,
      animations: 'disabled',
    });
    await page.keyboard.press('KeyN');
    await expect(page.locator('.diary')).toContainText(residentLine(state, 0));
  }
});

test('a nearby teammate voices the proposed question without asking it for the player', async ({ page }) => {
  const state = seeking();
  state.actors[2].nextThink = state.time + 2;
  await load(page, state);
  const bubble = page.locator('.speech-bubble[data-speaker="2"]');
  await expect(bubble).toBeVisible({ timeout: 10000 });
  await expect(bubble).toContainText('I suggest');
  await expect(bubble).toContainText('Open Ask to approve');
  await page.screenshot({ path: 'artifacts/field-play/teammate-speech.png', animations: 'disabled' });
  await menuAction(page, 'save');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('last-stop-match-v1')!).events.some(
        (event: { type: string }) => event.type === 'question',
      ),
    ),
  ).toBe(false);
});
