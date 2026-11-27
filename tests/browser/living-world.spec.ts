import { test, expect, menuAction } from './fixtures';
import { newGame, serialize, startRound } from '../../src/simulation';
import { updateResidents } from '../../src/residents';
import { mkdirSync } from 'node:fs';

test('a civilian uses local Ollama dialogue, remembers it and continues an ordinary routine', async ({
  page,
}) => {
  const prompts: Record<string, unknown>[] = [];
  await page.route('http://127.0.0.1:11434/api/tags', (route) =>
    route.fulfill({ json: { models: [{ name: 'resident-test:2b', size: 1e9 }] } }),
  );
  await page.route('http://127.0.0.1:11434/api/chat', async (route) => {
    const prompt = JSON.parse(route.request().postDataJSON().messages[1].content);
    prompts.push(prompt);
    await route.fulfill({
      json: {
        message: {
          content: JSON.stringify({
            choice: 2,
            line: 'The morning parcels are sorted. I could use a quiet moment on the bench.',
          }),
        },
      },
    });
  });
  const s = newGame('residents-with-lives', 20, 'hider');
  startRound(s);
  updateResidents(s, 0.1);
  const resident = s.residents![0];
  Object.assign(s.actors[0], { x: resident.x, y: resident.y });
  s.actors.forEach((a) => (a.nextThink = 1e9));
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('#save-file').setInputFiles({
    name: 'resident.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(s)),
  });
  await page.locator('.context-talk').click();
  await expect(page.locator('.speech-bubble')).toContainText('quiet moment on the bench', { timeout: 15000 });
  expect(prompts[0].role).toBe('resident');
  expect(JSON.stringify(prompts[0])).not.toMatch(/committed|hideSpot|candidates|correctAnswer/);
  await menuAction(page, 'save');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!));
  expect(saved.residents[0].memory[0]).toContain('quiet moment');
  expect(saved.residents[0].advice.activity).toBe('break');
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.screenshot({ path: 'artifacts/field-play/resident-ollama.png', animations: 'disabled' });
});

test('a repair visibly stops the journey and both seekers arrive together afterwards', async ({ page }) => {
  const s = newGame('visible-repair', 20, 'seeker');
  s.phase = 'search';
  s.time = 29;
  s.searchAt = 20;
  s.committed = 3;
  s.actors[1].station = 3;
  s.actors.forEach((a) => (a.nextThink = 1e9));
  s.questionReady = 1e9;
  const leg = {
    from: 0,
    to: 2,
    depart: 10,
    arrive: 60,
    kind: 'local' as const,
    line: 0,
    service: { mode: 'repair' as const, seconds: 10, scheduled: 10 },
  };
  s.actors[0].journey = [structuredClone(leg)];
  s.actors[2].journey = [structuredClone(leg)];
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page
    .locator('#save-file')
    .setInputFiles({ name: 'repair.json', mimeType: 'application/json', buffer: Buffer.from(serialize(s)) });
  await expect(page.locator('#journey-view')).toHaveAttribute('data-service', 'repair');
  await expect(page.locator('#journey-caption')).toContainText('Brief repair');
  const width = await page.locator('.trip-progress i').evaluate((el) => el.getAttribute('style'));
  await page.waitForTimeout(1200);
  expect(await page.locator('.trip-progress i').evaluate((el) => el.getAttribute('style'))).toBe(width);
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.screenshot({ path: 'artifacts/field-play/repair-stop.png', animations: 'disabled' });
  await page.locator('.speed-rates [data-value="4"]').click();
  await expect(page.locator('#journey-view')).toBeHidden({ timeout: 15000 });
  await menuAction(page, 'save');
  const actors = await page.evaluate(() => JSON.parse(localStorage.getItem('last-stop-match-v1')!).actors);
  expect(actors[0].station).toBe(2);
  expect(actors[2].station).toBe(2);
  expect(actors[0].journey).toHaveLength(0);
  expect(actors[2].journey).toHaveLength(0);
});
