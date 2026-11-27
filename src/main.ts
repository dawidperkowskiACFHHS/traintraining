import Phaser from 'phaser';
import './adventure.css';
import './cartridge.css';
import { TownScene } from './scene';
import {
  newGame,
  startRound,
  tick,
  walkTo,
  travel,
  commit,
  ask,
  approveQuestion,
  submitHumanAnswer,
  skipHeadStart,
  cancelTravel,
  playCard,
  chooseReward,
  discardCard,
  nextRound,
  teammate,
  interact,
  handleCurse,
  solveForms,
  stampForm,
  serialize,
  deserialize,
  toggleHide,
} from './simulation';
import { shell, paint, initialUI, handExpanded, panelClockPaused, type Panel } from './ui';
import { setPlaybackSpeed, PLAYBACK_SPEEDS } from './playback';
import { captureMoment, dismissCapture } from './capture-presentation';
import type { State, Category } from './types';
import { CARDS } from './cards';
import { freshSeed } from './run';
import { renderJourney } from './journey-scene';
import { pathfind } from './local';
import { configureSession, DIFFICULTIES, FORMATS } from './session';
import { createCoach, advanceCoach } from './coach';
import { GameAudio } from './audio';
import { storeMatch, recoverMatch, readPreferences, PREFERENCES_KEY } from './storage';
import { installRelease, exportReport, recordFrame } from './release';
import { OllamaNpcs, ollamaSettings } from './ollama';
import {
  APPEARANCE_KEY,
  APPEARANCE_OPTIONS,
  normalizeAppearance,
  randomAppearance,
  type Appearance,
} from './appearance';
const SAVE_KEY = 'last-stop-match-v1';
let state = newGame(freshSeed()),
  ui = initialUI(),
  toastUntil = 0,
  lastPaint = 0,
  lastSave = 0,
  lastFrame = 0,
  gamepadLatch = false,
  padRepeat = 0,
  storageAvailable = true,
  hasActiveMatch = false,
  hasAppearanceProfile = false;
const keys = new Set<string>();
const soundscape = new GameAudio();
let padEdit = false;
let returnToTitle = false;
document.getElementById('app')!.innerHTML = shell();
const hudSizing = new ResizeObserver((entries) => {
  for (const entry of entries)
    document.documentElement.style.setProperty(
      entry.target.id === 'objective' ? '--objective-height' : '--context-height',
      `${entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height}px`,
    );
});
hudSizing.observe(document.getElementById('objective')!);
hudSizing.observe(document.getElementById('context-prompt')!);
const handSurface = document.querySelector<HTMLElement>('.hand-section')!;
function stowHand() {
  ui.trayOpen = ui.handPreview = ui.handNavigation = false;
  if (document.activeElement?.closest('#hand')) (document.activeElement as HTMLElement).blur();
}
function focusHand(direction = 0) {
  const cards = [...document.querySelectorAll<HTMLElement>('#hand .travel-card')];
  const index = cards.indexOf(document.activeElement as HTMLElement);
  cards[(Math.max(0, index) + direction + cards.length) % cards.length]?.focus({ preventScroll: true });
}
handSurface.addEventListener('pointerenter', (event) => {
  if (event.pointerType === 'touch' || ui.panel || state.hider !== 0 || !state.hand.length) return;
  ui.handPreview = true;
  paint(state, ui);
});
handSurface.addEventListener('pointerleave', () => {
  ui.handPreview = !!document.activeElement?.closest('#hand');
  paint(state, ui);
});
handSurface.addEventListener('focusin', (event) => {
  if (!(event.target as HTMLElement).closest('#hand')) return;
  ui.handPreview = true;
  paint(state, ui);
});
handSurface.addEventListener('focusout', () => {
  queueMicrotask(() => {
    if (!document.activeElement?.closest('#hand') && !handSurface.matches(':hover')) {
      ui.handPreview = false;
      paint(state, ui);
    }
  });
});
installRelease(
  () => save(),
  () => state,
);
try {
  state.settings = readPreferences(localStorage, state.settings);
} catch {
  /* Defaults work without storage. */
}
try {
  ui.hasSave = !!localStorage.getItem(SAVE_KEY);
} catch {
  storageAvailable = false;
}
try {
  const profile = localStorage.getItem(APPEARANCE_KEY);
  if (profile) {
    state.appearance = normalizeAppearance(JSON.parse(profile));
    hasAppearanceProfile = true;
  }
} catch {
  /* An unreadable profile falls back to the original traveler. */
}
const scene = new TownScene(
  () => state,
  (x, y) => {
    if (!ui.panel && !state.paused) {
      stowHand();
      walkTo(state, 0, { x, y });
    }
  },
);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'world',
  width: 768,
  height: 512,
  pixelArt: true,
  backgroundColor: '#a5c67c',
  scene: [scene],
  scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
  audio: { noAudio: true },
  banner: false,
});
const npcAi = new OllamaNpcs(
  () => state,
  () => paint(state, ui),
);
void npcAi.connect();
function notify(text: string) {
  ui.toast = text;
  toastUntil = performance.now() + 4200;
  paint(state, ui);
}
function save(manual = false) {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.settings));
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(state.appearance));
    hasAppearanceProfile = true;
    // The startup menu has a fresh preview world, not the stored match.
    if (hasActiveMatch) {
      storeMatch(localStorage, serialize(state));
      ui.hasSave = true;
    }
    storageAvailable = true;
    const label = document.getElementById('save-state')!;
    label.textContent = 'SAVED ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (manual) notify('Match saved on this browser.');
  } catch {
    storageAvailable = false;
    document.getElementById('save-state')!.textContent = 'EXPORT SAVE NEEDED';
    notify('Browser storage is unavailable or full. Export a save file from Settings.');
  }
}
function load(backupOnly = false) {
  try {
    const appearance = state.appearance;
    const recovered = recoverMatch(localStorage, (raw) => deserialize(raw, appearance), backupOnly);
    state = recovered.state;
    state.settings = readPreferences(localStorage, state.settings);
    if (hasAppearanceProfile) state.appearance = { ...appearance };
    hasActiveMatch = true;
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify(state.appearance));
    hasAppearanceProfile = true;
    state.paused = false;
    state.speed = 1;
    ui.panel = null;
    keys.clear();
    notify(
      recovered.backup
        ? 'Recovered the previous backup. Your damaged save was not used.'
        : 'Welcome back. Your world and match are exactly where you left them.',
    );
  } catch (e) {
    notify(e instanceof Error ? e.message : 'Could not read the save.');
  }
}
function open(panel: Panel) {
  if (ui.panel === 'new' && (panel === 'settings' || panel === 'tutorial')) returnToTitle = true;
  padEdit = false;
  ui.panel = ui.panel === panel ? null : panel;
  if (panel === 'tools') stowHand();
  keys.clear();
  if (panel === 'cards') ui.libraryCard = null;
  paint(state, ui);
}
function close() {
  if (returnToTitle && (ui.panel === 'settings' || ui.panel === 'tutorial')) {
    returnToTitle = false;
    ui.panel = 'new';
    ui.setupOpen = false;
    keys.clear();
    paint(state, ui);
    return;
  }
  if (ui.panel === 'new' && ui.setupOpen) {
    ui.setupOpen = false;
    paint(state, ui);
    return;
  }
  if (ui.panel === 'appearance') {
    ui.panel = ui.appearanceReturn;
    ui.appearanceDraft = null;
    padEdit = false;
    keys.clear();
    paint(state, ui);
    return;
  }
  if (state.hider === 0 && (state.pending || state.rewards.length || state.hand.length > state.handLimit)) {
    ui.panel = state.pending ? 'reaction' : state.rewards.length ? 'reward' : 'overflow';
  } else ui.panel = null;
  ui.libraryCard = null;
  ui.extra = [];
  keys.clear();
  paint(state, ui);
  if (!ui.panel && ui.handNavigation) focusHand();
}
function rememberNewGameForm() {
  const form = document.querySelector<HTMLFormElement>('#new-form');
  if (!form) return;
  const data = new FormData(form);
  ui.newGameDraft = {
    seed: String(data.get('seed') ?? ''),
    size: String(data.get('size') ?? '30'),
    mode: String(data.get('mode') ?? 'match'),
    pace: String(data.get('pace') ?? 'quick'),
    difficulty: String(data.get('difficulty') ?? 'standard'),
  };
}
function act(action: string, el?: HTMLElement) {
  if (action === 'results') dismissCapture(state);
  rememberNewGameForm();
  if (action === 'interact') {
    interactNow();
    return;
  }
  if (action === 'fullscreen') {
    if (document.fullscreenElement) void document.exitFullscreen();
    else
      void document.documentElement
        .requestFullscreen()
        .catch(() => notify('Fullscreen is unavailable in this window.'));
    return;
  }
  if (action === 'restore-backup') {
    load(true);
    return;
  }
  if (action === 'support-report') {
    exportReport(state);
    notify('Saved a local support report. Nothing was uploaded.');
    return;
  }
  if (action === 'start-coach' || action === 'coach-seek') {
    const settings = state.settings,
      appearance = state.appearance;
    state = createCoach(action === 'coach-seek' ? state.world.seed : 'first-ticket', action === 'coach-seek');
    state.settings = settings;
    state.appearance = appearance;
    hasActiveMatch = true;
    ui = initialUI();
    ui.panel = null;
    keys.clear();
    save();
    return;
  }
  if (action === 'coach-hint' && state.coach) {
    state.coach.assisted = true;
    if (state.coach.step === 3) {
      const actor = state.actors[0],
        town = state.world.stations[actor.station].local;
      const cover = [...(town.cover ?? [])].sort(
        (a, b) => pathfind(town, actor, a.hide).length - pathfind(town, actor, b.hide).length,
      )[0];
      if (cover) {
        walkTo(state, 0, cover.hide);
        ui.panel = null;
        notify('Follow the practice trail, then press H / X to hide.');
      }
      return;
    }
    if (state.coach.step === 8 && state.actors[0].station === state.coach.target) {
      walkTo(state, 0, state.actors[state.hider]);
      ui.panel = null;
      notify('Follow the practice trail, then press E / A close to the hider.');
      return;
    }
    ui.selectedStation = state.coach.target;
    ui.panel = 'map';
    notify(
      'Practice hint: try ' +
        state.world.stations[state.coach.target].name +
        '. Normal matches keep the hider’s district secret.',
    );
    return;
  }
  if (action === 'notebook' && state.coach?.step === 6) state.coach.step = 7;
  const index = Number(el?.dataset.index),
    value = el?.dataset.value;
  if (action === 'setup-journey') {
    ui.setupOpen = true;
    return;
  }
  if (action === 'ollama-options') {
    ui.ollamaExpanded = !ui.ollamaExpanded;
    return;
  }
  if (action === 'ollama-reconnect') {
    void npcAi.connect();
    return;
  }
  if (action === 'sprint-toggle') {
    ui.sprintToggle = !ui.sprintToggle;
    return;
  }
  if (action === 'hide') {
    const error = toggleHide(state);
    if (error) notify(error);
    return;
  }
  if (action === 'appearance') {
    if (ui.panel === 'appearance') return;
    if (state.hider === 0 && (state.pending || state.rewards.length || state.hand.length > state.handLimit)) {
      notify('Finish your card choice before changing your traveler.');
      return;
    }
    ui.appearanceReturn = ui.panel;
    rememberNewGameForm();
    ui.appearanceDraft = { ...state.appearance };
    ui.previewAnimated = !state.settings.reducedMotion;
    ui.panel = 'appearance';
    padEdit = false;
    keys.clear();
    return;
  }
  if (action === 'random-appearance' && ui.appearanceDraft) {
    ui.appearanceDraft = randomAppearance();
    return;
  }
  if (action === 'preview-motion') {
    ui.previewAnimated = !ui.previewAnimated;
    return;
  }
  if (action === 'save-appearance' && ui.appearanceDraft) {
    state.appearance = normalizeAppearance(ui.appearanceDraft);
    save();
    close();
    return;
  }
  if (action === 'cancel-appearance') {
    close();
    return;
  }
  if (action === 'toggle-notebook') {
    ui.notebookOpen = !ui.notebookOpen;
    if (ui.panel === 'tools') ui.panel = null;
    keys.clear();
    return;
  }
  if (action === 'toggle-tray') {
    if (handExpanded(state, ui)) stowHand();
    else ui.trayOpen = true;
    keys.clear();
    return;
  }
  if (
    [
      'map',
      'questions',
      'notebook',
      'team',
      'settings',
      'tutorial',
      'cards',
      'results',
      'credits',
      'tools',
    ].includes(action)
  ) {
    if (action === 'questions' && state.hider === 0) {
      notify('You are hiding. The seekers will send you questions.');
      return;
    }
    if (action === 'map')
      ui.selectedStation =
        state.actors[0].destination ?? state.actors[0].journey.at(-1)?.to ?? state.actors[0].station;
    open(action as Panel);
    return;
  }
  if (action === 'close') {
    close();
    return;
  }
  if (action === 'new-menu') {
    ui.setupOpen = false;
    if (ui.panel !== 'new')
      ui.newGameDraft = {
        seed: freshSeed(),
        size: String(state.world.stations.length),
        mode: state.coach ? 'match' : state.mode,
        pace: state.session?.pace ?? 'quick',
        difficulty: state.session?.difficulty ?? 'standard',
      };
    open('new');
    return;
  }
  if (action === 'resume') {
    load();
    return;
  }
  if (action === 'start') {
    hasActiveMatch = true;
    startRound(state);
    ui.panel = null;
    save();
    return;
  }
  if (action === 'random-seed') {
    const adjectives = ['mossy', 'sleepy', 'golden', 'wandering', 'little', 'bramble', 'saffron', 'sunny'],
      nouns = ['suitcase', 'detour', 'sparrow', 'platform', 'pigeon', 'teacup', 'compass', 'getaway'];
    const input = document.querySelector<HTMLInputElement>('[name=seed]');
    if (input)
      input.value =
        adjectives[crypto.getRandomValues(new Uint32Array(1))[0] % 8] +
        '-' +
        nouns[crypto.getRandomValues(new Uint32Array(1))[0] % 8] +
        '-' +
        (crypto.getRandomValues(new Uint32Array(1))[0] % 100);
    rememberNewGameForm();
    return;
  }
  if (action === 'save') {
    if (!hasActiveMatch) {
      notify('Start or continue a journey before saving.');
      return;
    }
    save(true);
    if (ui.panel === 'tools') ui.panel = null;
    return;
  }
  if (action === 'export') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([serialize(state)], { type: 'application/json' }));
    a.download = `last-stop-${state.world.seed.replace(/[^a-z0-9-]/gi, '').slice(0, 40)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    notify('Exported a complete match save.');
    return;
  }
  if (action === 'import') {
    document.getElementById('save-file')!.click();
    return;
  }
  if (action === 'pause') {
    state.paused = !state.paused;
    keys.clear();
    return;
  }
  if (action === 'speed') {
    setPlaybackSpeed(state, el?.dataset.value ? Number(el.dataset.value) : undefined);
    if (ui.panel === 'tools') ui.panel = null;
    return;
  }
  if (action === 'skip-headstart') {
    const err = skipHeadStart(state);
    if (err) notify(err);
    return;
  }
  if (action === 'cancel-travel') {
    const err = cancelTravel(state);
    notify(err || 'Journey canceled. Choose your next move.');
    return;
  }
  if (action === 'select-station') {
    ui.selectedStation = index;
    return;
  }
  if (action === 'travel') {
    const err = travel(state, 0, ui.selectedStation);
    if (err) notify(err);
    else {
      ui.panel = null;
      notify('Heading to the platform. Your route follows the timetable.');
    }
    return;
  }
  if (action === 'commit') {
    const err = commit(state);
    notify(err || 'District committed. Find a hiding corner before the seekers arrive.');
    return;
  }
  if (action === 'category') {
    ui.category = value as Category;
    return;
  }
  if (action === 'ask') {
    const err = ask(state, el!.dataset.id!);
    if (err) notify(err);
    else ui.panel = null;
    return;
  }
  if (action === 'approve-question') {
    const err = approveQuestion(state);
    if (err) notify(err);
    else ui.panel = null;
    return;
  }
  if (action === 'answer') {
    const err = submitHumanAnswer(state, value ?? '');
    ui.answerFeedback = err ?? '';
    if (!err) {
      ui.panel = null;
      notify('Truthful answer sent. Choose your card reward.');
    }
    return;
  }
  if (action === 'inspect') {
    ui.selectedCard = index;
    ui.extra = [];
    ui.panel = 'card';
    return;
  }
  if (action === 'extra') {
    ui.extra = ui.extra.includes(index) ? ui.extra.filter((i) => i !== index) : [...ui.extra, index];
    return;
  }
  if (action === 'play-card') {
    if (state.hider !== 0) return;
    const title = CARDS[state.hand[ui.selectedCard]].title,
      err = playCard(state, ui.selectedCard, ui.extra, ui.category);
    if (err) notify(err);
    else {
      ui.panel = null;
      ui.extra = [];
      stowHand();
      notify('Played ' + title + '.');
    }
    return;
  }
  if (action === 'discard' || action === 'overflow-discard') {
    discardCard(state, index);
    ui.panel = state.hand.length > state.handLimit ? 'overflow' : null;
    return;
  }
  if (action === 'reward-pick') {
    const r = state.rewards[0];
    if (!r) return;
    ui.reward = ui.reward.includes(index)
      ? ui.reward.filter((i) => i !== index)
      : ui.reward.length < r.keep
        ? [...ui.reward, index]
        : [...ui.reward.slice(1), index];
    return;
  }
  if (action === 'keep-reward') {
    if (chooseReward(state, ui.reward)) {
      ui.reward = [];
      ui.panel = null;
    }
    return;
  }
  if (action === 'effect') {
    if (state.hider === 0) notify(CARDS[index].summary);
    else if (index === 2) ui.panel = 'puzzle';
    else {
      const err = handleCurse(state, 0, index);
      notify(err || 'Follow the marked path, then stay at the target until the task clears.');
    }
    return;
  }
  if (action === 'library-card') {
    ui.libraryCard = index;
    ui.panel = 'cards';
    return;
  }
  if (action === 'library-back') {
    ui.libraryCard = null;
    return;
  }
  if (action === 'command') {
    const meeting = document.querySelector<HTMLSelectElement>('#meeting-station');
    teammate(
      state,
      value!,
      value === 'Meet at this station'
        ? Number(meeting?.value ?? ui.selectedStation)
        : state.actors[0].station,
    );
    ui.panel = null;
    return;
  }
  if (action === 'handle-curse') {
    if (state.effects.some((e) => e.card === 2)) ui.panel = 'puzzle';
    else {
      const err = handleCurse(state);
      if (err) notify(err);
      else {
        ui.panel = null;
        notify('Walking to the marked curse task. Stay at the target to complete it.');
      }
    }
    return;
  }
  if (action === 'stamp') {
    stampForm(state, index);
    return;
  }
  if (action === 'solve-forms') {
    const err = solveForms(state);
    if (err) notify(err);
    else {
      notify('Paperwork stamped and cleared.');
      ui.panel = null;
    }
    return;
  }
  if (action === 'tutorial-next') {
    ui.tutorialPage = Math.min(4, ui.tutorialPage + 1);
    return;
  }
  if (action === 'tutorial-prev') {
    ui.tutorialPage = Math.max(0, ui.tutorialPage - 1);
    return;
  }
  if (action === 'next') {
    nextRound(state);
    ui.panel = state.phase === 'finished' ? 'results' : null;
    save();
    return;
  }
  if (action === 'replay') {
    ui.panel = 'replay';
    ui.replayTime = state.phaseAt;
    return;
  }
  if (action === 'remap') {
    ui.remap = value!;
    notify('Press the new key for ' + value + '. Escape cancels.');
    return;
  }
}
document.addEventListener('click', (e) => {
  const summary = (e.target as Element).closest('summary');
  const disclosure = summary?.parentElement;
  if (disclosure instanceof HTMLDetailsElement && disclosure.dataset.disclosure)
    ui.disclosures[disclosure.dataset.disclosure] = !disclosure.open;
  const el = (e.target as Element).closest<HTMLElement>('[data-action]');
  if (!el || el.matches(':disabled')) return;
  const action = el.dataset.action!;
  act(action, el);
  paint(state, ui);
  soundscape.unlock();
  soundscape.cue('ui');
});
document.addEventListener('submit', (e) => {
  if ((e.target as HTMLElement).id !== 'new-form') return;
  e.preventDefault();
  const f = new FormData(e.target as HTMLFormElement),
    settings = state.settings,
    appearance = state.appearance;
  state = newGame(
    String(f.get('seed') || freshSeed()),
    Number(f.get('size')),
    f.get('mode') as State['mode'],
  );
  if (state.mode === 'tutorial') state = createCoach(String(f.get('seed') || 'first-ticket'));
  else {
    configureSession(state, String(f.get('pace')), String(f.get('difficulty')));
    startRound(state);
  }
  state.settings = settings;
  state.appearance = { ...appearance };
  hasActiveMatch = true;
  ui = initialUI();
  ui.panel = null;
  keys.clear();
  save();
  paint(state, ui);
});
document.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.closest('#new-form')) rememberNewGameForm();
  if (el.dataset.volume) {
    (state.settings as unknown as Record<string, unknown>)[el.dataset.volume] = Number(el.value);
    const output = el.closest('label')?.querySelector('output');
    if (output) output.textContent = Math.round(Number(el.value) * 100) + '%';
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(state.settings));
    } catch {}
    return;
  }
  if (el.id === 'annotation') {
    state.notes[ui.selectedStation] = el.value;
    return;
  }
  if (el.id === 'replay-time') {
    ui.replayTime = Number(el.value);
    return;
  }
  if (el.id === 'text-scale') {
    try {
      localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify({ ...state.settings, textScale: Number(el.value) }),
      );
    } catch {}
    state.settings.textScale = Number(el.value);
    document.documentElement.style.setProperty('--text-scale', el.value);
    return;
  }
});
document.addEventListener('change', async (e) => {
  const el = e.target as HTMLInputElement;
  if (el.closest('#new-form')) {
    rememberNewGameForm();
    if (el.name === 'difficulty') {
      const text = document.getElementById('difficulty-description');
      if (text) text.textContent = DIFFICULTIES[el.value as keyof typeof DIFFICULTIES].description;
    }
    if (el.name === 'pace') {
      const text = document.getElementById('format-description');
      if (text) text.textContent = FORMATS[el.value as keyof typeof FORMATS].description;
    }
  }
  if (el.dataset.ollama === 'enabled') {
    npcAi.configure(el.checked);
    paint(state, ui);
    return;
  }
  if (el.id === 'ollama-model') {
    npcAi.configure(ollamaSettings.enabled, el.value);
    paint(state, ui);
    return;
  }
  if (el.dataset.appearance && ui.appearanceDraft) {
    const key = el.dataset.appearance as keyof Appearance;
    if (key in APPEARANCE_OPTIONS) {
      ui.appearanceDraft = normalizeAppearance({ ...ui.appearanceDraft, [key]: Number(el.value) });
      paint(state, ui);
    }
    return;
  }
  if (el.dataset.setting) {
    (state.settings as unknown as Record<string, unknown>)[el.dataset.setting] = el.checked;
    if (el.dataset.setting === 'autoQuestions') state.questionSuggestion = null;
    paint(state, ui);
    save();
  }
  if (el.id === 'fog-category') {
    ui.category = el.value as Category;
    paint(state, ui);
  }
  if (el.id === 'save-file' && el.files?.[0]) {
    try {
      const loaded = deserialize(await el.files[0].text(), state.appearance);
      state = loaded;
      hasActiveMatch = true;
      state.paused = false;
      state.speed = 1;
      ui.panel = null;
      save();
      notify('Imported the saved region and match.');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Could not import that save.');
    }
    el.value = '';
  }
});
document.addEventListener(
  'toggle',
  (e) => {
    const el = e.target;
    if (el instanceof HTMLDetailsElement && el.dataset.disclosure)
      ui.disclosures[el.dataset.disclosure] = el.open;
  },
  true,
);
document.addEventListener('focusout', () => {
  setTimeout(() => paint(state, ui), 0);
});
function interactNow() {
  if (captureMoment(state)) {
    dismissCapture(state);
    open('results');
    return;
  }
  if (state.paused) {
    notify('Resume the game before interacting.');
    return;
  }
  if (state.phase === 'preparation') {
    act('start');
    paint(state, ui);
    return;
  }
  const result = interact(state);
  if (result === 'station') open('map');
  else if (result && state.events.at(-1)?.type !== 'speech') notify(result);
}
window.addEventListener('keydown', (e) => {
  soundscape.unlock();
  if (
    captureMoment(state) &&
    !e.repeat &&
    ['Enter', 'Space', 'Escape', state.settings.bindings.interact].includes(e.code)
  ) {
    e.preventDefault();
    dismissCapture(state);
    open('results');
    return;
  }
  if (e.code === 'Escape' && e.repeat) return;
  if (ui.remap) {
    e.preventDefault();
    if (e.code !== 'Escape') {
      const other = Object.entries(state.settings.bindings).find(([k, v]) => v === e.code && k !== ui.remap);
      if (other) {
        notify('That key already controls ' + other[0] + '. Choose another.');
        return;
      }
      state.settings.bindings[ui.remap] = e.code;
      save();
    }
    ui.remap = null;
    paint(state, ui);
    return;
  }
  if (e.code === 'Escape' && ui.panel === 'appearance') {
    e.preventDefault();
    close();
    return;
  }
  if ((e.target as HTMLElement).matches('input,textarea,select')) return;
  if (ui.panel && e.code === 'Space' && (e.target as HTMLElement).matches('button,summary')) {
    e.preventDefault();
    if (!e.repeat) (e.target as HTMLElement).click();
    return;
  }
  if (e.code === 'Tab' && ui.panel) {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#overlay button:not(:disabled),#overlay summary,#overlay input,#overlay select,#overlay textarea,#overlay [role=button]',
      ),
    ).filter((n) => n.getBoundingClientRect().width > 0);
    if (e.shiftKey && document.activeElement === nodes[0]) {
      e.preventDefault();
      nodes.at(-1)?.focus();
    } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
      e.preventDefault();
      nodes[0]?.focus();
    }
  }
  if (e.code === 'Escape') {
    if (!ui.panel) {
      if (ui.trayOpen || ui.handPreview) {
        stowHand();
        paint(state, ui);
        return;
      }
      open('tools');
      return;
    }
    close();
    return;
  }
  if (e.code === 'Enter' && (e.target as HTMLElement).getAttribute('role') === 'button') {
    (e.target as HTMLElement).click();
    return;
  }
  const b = state.settings.bindings;
  if (!ui.panel && document.activeElement?.closest('#hand')) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
      focusHand(e.code === 'ArrowLeft' || e.code === 'ArrowUp' ? -1 : 1);
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) (document.activeElement as HTMLElement).click();
      return;
    }
  }
  if (
    !ui.panel &&
    state.hider === 0 &&
    state.hand.length &&
    e.code === 'KeyR' &&
    !Object.values(b).includes('KeyR')
  ) {
    e.preventDefault();
    if (!e.repeat) {
      if (ui.trayOpen) stowHand();
      else {
        ui.trayOpen = true;
        ui.handNavigation = true;
        paint(state, ui);
        focusHand();
      }
      paint(state, ui);
    }
    return;
  }
  if (
    [b.up, b.down, b.left, b.right, 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', b.pause].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (!e.repeat) {
    if (!ui.panel && ['BracketLeft', 'BracketRight'].includes(e.code)) {
      const index = PLAYBACK_SPEEDS.indexOf(state.speed as 1 | 2 | 4 | 8);
      setPlaybackSpeed(
        state,
        PLAYBACK_SPEEDS[Math.max(0, Math.min(3, index + (e.code === 'BracketRight' ? 1 : -1)))],
      );
      e.preventDefault();
      paint(state, ui);
      return;
    }
    if (e.code === b.hide && !ui.panel) {
      e.preventDefault();
      act('hide');
      paint(state, ui);
      return;
    }
    if (e.code === 'KeyV') {
      act('appearance');
      paint(state, ui);
      return;
    }
    if (e.code === b.map) {
      act('map');
      paint(state, ui);
      return;
    }
    if (e.code === b.pause) {
      act('pause');
      paint(state, ui);
      return;
    }
    if (e.code === 'KeyQ') {
      act('questions');
      paint(state, ui);
      return;
    }
    if (e.code === 'KeyN') {
      act('notebook');
      paint(state, ui);
      return;
    }
    if (e.code === 'KeyT') {
      act('team');
      paint(state, ui);
      return;
    }
    if (e.code === 'KeyC') {
      act('cards');
      paint(state, ui);
      return;
    }
    if (e.code === b.interact && !ui.panel) {
      interactNow();
      paint(state, ui);
      return;
    }
  }
  if (ui.panel === 'puzzle' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    stampForm(state, Number(e.code.slice(-1)) - 1);
    paint(state, ui);
  }
  if (!ui.panel) keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => {
  keys.clear();
  state.paused = true;
  save();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    keys.clear();
    state.paused = true;
    save();
  }
});
window.addEventListener('beforeunload', () => save());
function padInput(now: number) {
  const pad = navigator.getGamepads?.().find(Boolean);
  if (!pad) return { dx: 0, dy: 0, sprint: false };
  const press = (i: number) => pad.buttons[i]?.pressed;
  const any = press(0) || press(1) || press(2) || press(3) || press(4) || press(8) || press(9);
  if (!gamepadLatch) {
    if (press(4) && !ui.panel && state.hider === 0 && state.hand.length) {
      if (ui.handNavigation) stowHand();
      else {
        ui.trayOpen = ui.handNavigation = true;
        keys.clear();
        paint(state, ui);
        focusHand();
      }
      paint(state, ui);
    } else if (press(2) && !ui.panel) {
      act('hide');
      paint(state, ui);
    } else if (press(8)) {
      act('appearance');
      paint(state, ui);
    } else if (press(9)) {
      act('tools');
      paint(state, ui);
    } else if (press(1)) {
      if (!ui.panel && (ui.trayOpen || ui.handPreview)) {
        stowHand();
        paint(state, ui);
      } else if (ui.panel === 'appearance') close();
      else if (padEdit) padEdit = false;
      else close();
    } else if (press(3)) {
      act('map');
      paint(state, ui);
    } else if (press(0)) {
      if (ui.panel) {
        const active = document.activeElement as HTMLElement;
        if (active?.matches('select,input[type=range]')) padEdit = !padEdit;
        else if (
          active?.closest('#overlay') &&
          active.matches('button,summary,[role=button],input[type=radio],input[type=checkbox]')
        )
          active.click();
        else document.querySelector<HTMLElement>('#overlay button:not(:disabled)')?.focus();
      } else if (ui.handNavigation) {
        if (document.activeElement?.closest('#hand')) (document.activeElement as HTMLElement).click();
        else focusHand();
      } else interactNow();
    }
  }
  gamepadLatch = !!any;
  const dx = (Math.abs(pad.axes[0]) > 0.25 ? pad.axes[0] : 0) + (press(15) ? 1 : 0) - (press(14) ? 1 : 0),
    dy = (Math.abs(pad.axes[1]) > 0.25 ? pad.axes[1] : 0) + (press(13) ? 1 : 0) - (press(12) ? 1 : 0);
  if (!ui.panel && ui.handNavigation) {
    if ((dx || dy) && now > padRepeat) {
      focusHand(dx < 0 || dy < 0 ? -1 : 1);
      padRepeat = now + 220;
    }
    return { dx: 0, dy: 0, sprint: false };
  }
  if (ui.panel && (dx || dy) && now > padRepeat) {
    const active = document.activeElement as HTMLInputElement | HTMLSelectElement;
    if (padEdit && active?.matches('select,input[type=range]')) {
      const direction = dy < 0 || dx < 0 ? -1 : 1;
      if (active instanceof HTMLSelectElement) {
        active.selectedIndex = Math.max(
          0,
          Math.min(active.options.length - 1, active.selectedIndex + direction),
        );
        active.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        active.value = String(
          Math.max(
            Number(active.min),
            Math.min(Number(active.max), Number(active.value) + Number(active.step || 1) * direction),
          ),
        );
        active.dispatchEvent(new Event('input', { bubbles: true }));
      }
      padRepeat = now + 220;
      return { dx: 0, dy: 0, sprint: false };
    }
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#overlay button:not(:disabled),#overlay input:not([type=hidden]),#overlay select,#overlay textarea,#overlay [role=button]',
      ),
    ).filter((n) => n.getBoundingClientRect().width > 0);
    const current = nodes.indexOf(document.activeElement as HTMLElement),
      next = (current + (dy < 0 || dx < 0 ? -1 : 1) + nodes.length) % nodes.length;
    nodes[next]?.focus();
    nodes[next]?.scrollIntoView({ block: 'nearest' });
    padRepeat = now + 220;
  }
  return ui.panel ? { dx: 0, dy: 0, sprint: false } : { dx, dy, sprint: !!press(7) };
}
function frame(now: number) {
  recordFrame(now);
  const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
  lastFrame = now;
  npcAi.tick(now, !state.coach && !ui.panel && !state.paused && !document.hidden);
  const pad = padInput(now),
    b = state.settings.bindings;
  const panelPaused = panelClockPaused(state, ui.panel);
  const dx =
      (keys.has(b.right) || keys.has('ArrowRight') ? 1 : 0) -
      (keys.has(b.left) || keys.has('ArrowLeft') ? 1 : 0) +
      pad.dx,
    dy =
      (keys.has(b.down) || keys.has('ArrowDown') ? 1 : 0) -
      (keys.has(b.up) || keys.has('ArrowUp') ? 1 : 0) +
      pad.dy;
  if (!ui.panel && (dx || dy) && (ui.trayOpen || ui.handPreview)) stowHand();
  if (!panelPaused && !state.paused) {
    // Input is integrated inside the authoritative steps, including an interrupted fast-forward.
    tick(state, dt * state.speed, {
      x: dx,
      y: dy,
      sprint:
        ui.sprintToggle ||
        pad.sprint ||
        keys.has(b.sprint) ||
        (b.sprint === 'ShiftLeft' && keys.has('ShiftRight')),
    });
  }
  if (ui.toast && now > toastUntil) ui.toast = '';

  if (now - lastPaint > 160) {
    paint(state, ui);
    lastPaint = now;
  }
  if (now - lastSave > 7000 && state.phase !== 'preparation' && storageAvailable) {
    save();
    lastSave = now;
  }
  advanceCoach(state);
  soundscape.update(state, !ui.panel);
  renderJourney(state);
  requestAnimationFrame(frame);
}
paint(state, ui);
requestAnimationFrame(frame);
