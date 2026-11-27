import { test, expect, menuAction, setSpeed } from './fixtures';
import { newGame, startRound, ask, answer, serialize } from '../../src/simulation';
import { mkdirSync } from 'node:fs';
const KEY = 'last-stop-match-v1';
async function save(page: import('@playwright/test').Page) {
  await menuAction(page, 'save');
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), KEY);
}
async function fast(page: import('@playwright/test').Page) {
  await setSpeed(page, 4);
}
test('playable introduction teaches both roles with real travel, cover, cards, clues and a tag', async ({
  page,
}) => {
  test.setTimeout(150000);
  page.setDefaultTimeout(12000);
  mkdirSync('artifacts/release', { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Learn to play', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Live notebook' })).toBeHidden();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(850);
  await page.keyboard.up('KeyD');
  await expect(page.locator('#coach')).toContainText('Catch your first train');
  await page.screenshot({ path: 'artifacts/release/practice-first-train.png' });
  await page.getByRole('button', { name: 'Show a practice hint', exact: true }).click();
  await page.getByRole('button', { name: 'Walk to platform & travel' }).click();
  await fast(page);
  await expect(page.locator('#coach')).toContainText('Make this district yours', { timeout: 40000 });
  await page.locator('.route-objective [data-action=commit]').click();
  await page.getByRole('button', { name: 'Show a practice hint', exact: true }).click();
  await fast(page);
  await expect
    .poll(
      async () => {
        const s = await save(page);
        return s.actors[0].path.length;
      },
      { timeout: 15000 },
    )
    .toBe(0);
  await page.keyboard.press('KeyH');
  await expect(page.locator('#coach')).toContainText('Buy yourself some time');
  await page.getByRole('button', { name: 'Tourist Trap', exact: true }).click();
  await page.locator('[data-action=play-card]').click();
  await page.getByRole('button', { name: 'Try seeking →', exact: true }).click();
  await expect(page.locator('#coach')).toContainText('Now you are seeking');
  await page.keyboard.press('KeyQ');
  await page.locator('[data-action=ask]:not(:disabled)').first().click();
  await expect(page.locator('#coach')).toContainText('Follow the evidence');
  await page.keyboard.press('KeyN');
  await expect(page.locator('.clue-anchor').first()).toContainText('Asked from');
  await page.screenshot({ path: 'artifacts/release/practice-clue.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Show a practice hint', exact: true }).click();
  await page.getByRole('button', { name: 'Walk to platform & travel' }).click();
  await fast(page);
  await expect(page.locator('#coach')).toContainText('Finish the search on foot', { timeout: 45000 });
  await page.getByRole('button', { name: 'Show a practice hint', exact: true }).click();
  await fast(page);
  await expect
    .poll(
      async () => {
        const s = await save(page);
        return s.actors[0].path.length;
      },
      { timeout: 20000 },
    )
    .toBe(0);
  await page.keyboard.press('KeyE');
  await expect(page.locator('.results-body')).toContainText('Your first ticket is stamped');
  await page.screenshot({ path: 'artifacts/release/practice-completed.png' });
  expect(errors).toEqual([]);
});
test('clues preserve origin and journey anchors; corrupted primary saves recover without losing the game', async ({
  page,
}) => {
  await page.goto('/');
  const s = newGame('anchor-recovery', 20, 'seeker');
  startRound(s);
  s.phase = 'search';
  s.time = 130;
  s.searchAt = 130;
  s.committed = 2;
  s.actors[1].station = 2;
  s.actors[0].previous = 1;
  s.questionReady = 0;
  s.autoHuman = true;
  expect(ask(s, 'warmer', 0)).toBeNull();
  answer(s);
  s.autoHuman = false;
  s.actors.forEach((a) => (a.nextThink = 1e9));
  await page
    .locator('#save-file')
    .setInputFiles({ name: 'anchors.json', mimeType: 'application/json', buffer: Buffer.from(serialize(s)) });
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!).world.seed))
    .toBe('anchor-recovery');
  await page.keyboard.press('KeyN');
  await expect(page.locator('.clue-anchor')).toContainText(s.world.stations[0].name);
  await expect(page.locator('.clue-anchor')).toContainText(s.world.stations[1].name);
  await page.locator('.clue-explanation summary').click();
  await expect(page.locator('.clue-explanation')).toContainText('would answer');
  await page.keyboard.press('Escape');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(100);
  await page.keyboard.up('KeyD');
  await save(page);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('damage-once')) {
      localStorage.setItem('last-stop-match-v1', '{damaged');
      sessionStorage.setItem('damage-once', 'yes');
    }
  });
  await page.reload();
  await page.getByRole('button', { name: 'Resume saved match', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Recovered the previous backup');
  expect((await save(page)).world.seed).toBe(s.world.seed);
});
test('sound produces a signal, master mute works, and mixer settings survive reload', async ({ page }) => {
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    window.AudioContext = class extends Original {
      constructor(...args: ConstructorParameters<typeof AudioContext>) {
        super(...args);
        const create = this.createGain.bind(this);
        let first = true;
        this.createGain = () => {
          const g = create();
          if (first) {
            first = false;
            const meter = this.createAnalyser();
            meter.fftSize = 2048;
            g.connect(meter);
            (window as unknown as { soundMeter: AnalyserNode }).soundMeter = meter;
          }
          return g;
        };
      }
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click();
  await page.waitForTimeout(350);
  const energy = () =>
    page.evaluate(() => {
      const meter = (window as unknown as { soundMeter: AnalyserNode }).soundMeter;
      const data = new Float32Array(meter.fftSize);
      meter.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, n) => sum + n * n, 0) / data.length);
    });
  await expect.poll(energy).toBeGreaterThan(0.00001);
  await page.getByRole('slider', { name: 'Master volume', exact: true }).fill('0');
  await page.waitForTimeout(1000);
  expect(await energy()).toBeLessThan(0.00001);
  await page.locator('[data-disclosure=sound-levels] > summary').click();
  await page.getByRole('slider', { name: 'Music volume', exact: true }).fill('0.1');
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).last().click();
  await expect(page.getByRole('slider', { name: 'Master volume', exact: true })).toHaveValue('0');
  await page.locator('[data-disclosure=sound-levels] > summary').click();
  await expect(page.getByRole('slider', { name: 'Music volume', exact: true })).toHaveValue('0.1');
});
