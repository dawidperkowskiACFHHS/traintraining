import { test, expect, menuAction, openLocalModelSettings } from './fixtures';
import { newGame, serialize } from '../../src/simulation';
import { QUESTIONS } from '../../src/questions';
import { updateResidents } from '../../src/residents';
import { mkdirSync } from 'node:fs';
const SAVE = 'last-stop-match-v1';
const models = {
  models: [
    { name: 'test-large:8b', size: 5e9 },
    { name: 'test-small:2b', size: 1e9 },
  ],
};
test('Ollama is on by default with discovery, model selection, persistence and an offline fallback', async ({
  page,
}) => {
  await page.route('http://127.0.0.1:11434/api/tags', (route) => route.fulfill({ json: models }));
  await page.goto('/');
  await openLocalModelSettings(page);
  await expect(page.locator('[data-ollama=enabled]')).toBeChecked();
  await expect(page.locator('.ollama-state')).toContainText('test-small:2b');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await page.locator('[data-disclosure=journey-options] > summary').click();
  await page.locator('[name=seed]').fill('keep-my-game-options');
  await page.locator('[name=size]').selectOption('20');
  await page.locator('[name=mode][value=seeker]').check();
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await openLocalModelSettings(page);
  await page.locator('#ollama-model').selectOption('test-large:8b');
  await expect(page.locator('.ollama-state')).toContainText('test-large:8b');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await page.locator('[data-disclosure=journey-options] > summary').click();
  await expect(page.locator('[name=seed]')).toHaveValue('keep-my-game-options');
  await expect(page.locator('[name=size]')).toHaveValue('20');
  await expect(page.locator('[name=mode][value=seeker]')).toBeChecked();
  mkdirSync('artifacts', { recursive: true });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: 'artifacts/ollama-main-menu.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await openLocalModelSettings(page);
  await page.locator('[data-ollama=enabled]').uncheck();
  await page.reload();
  await openLocalModelSettings(page);
  await expect(page.locator('[data-ollama=enabled]')).not.toBeChecked();
  await page.locator('[data-ollama=enabled]').check();
  await expect(page.locator('.ollama-state')).toContainText('test-large:8b');
  await page.route('http://127.0.0.1:11434/api/tags', (route) => route.abort());
  await openLocalModelSettings(page);
  await page.locator('[data-action=ollama-reconnect]').click();
  await expect(page.locator('.ollama-state')).toContainText('unavailable');
  await page.getByRole('button', { name: 'Close panel', exact: true }).click();
  await page.getByRole('button', { name: 'New journey', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start game', exact: true })).toBeEnabled();
});
test('a model decision becomes a validated NPC action and dialogue, without secret hider context', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const prompts: Record<string, unknown>[] = [];
  let selected = '';
  await page.route('http://127.0.0.1:11434/api/tags', (route) => route.fulfill({ json: models }));
  await page.route('http://127.0.0.1:11434/api/chat', async (route) => {
    const body = route.request().postDataJSON();
    const prompt = JSON.parse(body.messages[1].content);
    if (prompt.role === 'resident') {
      await route.fulfill({
        json: {
          message: { content: JSON.stringify({ choice: 0, line: 'I have parcels to sort before lunch.' }) },
        },
      });
      return;
    }
    prompts.push(prompt);
    const choice =
      prompt.choices.find(
        (choice: { choice: number; action: string }) =>
          choice.choice > 1 && QUESTIONS.some((question) => question.title === choice.action),
      ) ?? prompt.choices[0];
    selected = QUESTIONS.find((question) => question.title === choice.action)?.id ?? '';
    await route.fulfill({
      json: {
        message: {
          content: JSON.stringify({ choice: choice.choice, line: 'I will compare the railway clues.' }),
        },
        done: true,
      },
    });
  });
  await page.goto('/');
  await openLocalModelSettings(page);
  await expect(page.locator('.ollama-state')).toContainText('Connected');
  const state = newGame('model-browser-plan', 20);
  state.phase = 'search';
  state.time = 130;
  state.searchAt = 130;
  state.localAt = 130;
  state.committed = 3;
  state.actors[0].station = 3;
  state.actors.forEach((actor) => (actor.nextThink = 9999));
  state.actors[1].nextThink = 132;
  await page.locator('#save-file').setInputFiles({
    name: 'model-plan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect
    .poll(
      async () =>
        page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem(key)!).events.some((event: { text: string }) =>
              event.text.includes('Plan · I will compare'),
            ),
          SAVE,
        ),
      { timeout: 15000 },
    )
    .toBe(true);
  expect(prompts.length).toBeGreaterThan(0);
  expect(prompts[0].role).toBe('seeker');
  expect(JSON.stringify(prompts[0])).not.toMatch(/hideSpot|committed|correctAnswer/);
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), SAVE);
  expect(saved.pending.id).toBe(selected);
  expect(errors).toEqual([]);
});
test('live local Ollama returns a plan to the actual game', async ({ page }) => {
  test.skip(process.env.RUN_OLLAMA_SMOKE !== '1', 'Opt in to exercise an installed local model.');
  test.setTimeout(70000);
  await page.unroute('http://127.0.0.1:11434/**');
  await page.goto('/');
  await openLocalModelSettings(page);
  await expect(page.locator('.ollama-state')).toContainText('Connected', { timeout: 10000 });
  const state = newGame('live-local-model', 20);
  state.phase = 'search';
  state.time = 130;
  state.searchAt = 130;
  state.localAt = 130;
  state.committed = 3;
  state.actors[0].station = 3;
  state.questionReady = 9999;
  state.actors.forEach((actor) => (actor.nextThink = 9999));
  state.actors[1].nextThink = state.time + 35;
  await page.locator('#save-file').setInputFiles({
    name: 'live-model.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serialize(state)),
  });
  await expect
    .poll(
      async () => {
        await menuAction(page, 'save');
        return page.evaluate(
          (key) =>
            JSON.parse(localStorage.getItem(key)!).events.some((event: { text: string }) =>
              event.text.includes('Plan ·'),
            ),
          SAVE,
        );
      },
      { timeout: 60000, intervals: [1000] },
    )
    .toBe(true);
  await menuAction(page, 'settings');
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/ollama-live-connected.png', animations: 'disabled' });
});

test('live local Ollama supplies a civilian conversation and saved memory', async ({ page }) => {
  test.skip(process.env.RUN_OLLAMA_SMOKE !== '1', 'Opt in to exercise an installed local model.');
  test.setTimeout(70000);
  await page.unroute('http://127.0.0.1:11434/**');
  await page.goto('/');
  await openLocalModelSettings(page);
  await expect(page.locator('.ollama-state')).toContainText('Connected', { timeout: 10000 });
  const state = newGame('live-resident-day', 20, 'hider');
  state.phase = 'headstart';
  updateResidents(state, 0.1);
  const person = state.residents![0];
  Object.assign(state.actors[0], { x: person.x, y: person.y });
  state.actors.forEach((a) => (a.nextThink = 1e9));
  await page
    .locator('#save-file')
    .setInputFiles({
      name: 'live-resident.json',
      mimeType: 'application/json',
      buffer: Buffer.from(serialize(state)),
    });
  await page.locator('.context-talk').click();
  await expect
    .poll(
      async () => {
        await menuAction(page, 'save');
        return page.evaluate(
          () => JSON.parse(localStorage.getItem('last-stop-match-v1')!).residents[0].memory?.length ?? 0,
        );
      },
      { timeout: 45000, intervals: [1000] },
    )
    .toBeGreaterThan(0);
  const memory = await page.evaluate(
    () => JSON.parse(localStorage.getItem('last-stop-match-v1')!).residents[0].memory[0],
  );
  expect(typeof memory).toBe('string');
  expect(memory.length).toBeGreaterThan(5);
  mkdirSync('artifacts/field-play', { recursive: true });
  await page.screenshot({ path: 'artifacts/field-play/resident-live-model.png', animations: 'disabled' });
});
