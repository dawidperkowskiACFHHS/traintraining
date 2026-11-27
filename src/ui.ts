import { districtRead, nearbyResident } from './residents';
import { serviceNote, serviceStop } from './service-conditions';
import { PLAYBACK_SPEEDS } from './playback';
import { watchCaptures, captureMoment } from './capture-presentation';
import { answerTool } from './answer-tool';
import { FORMATS, DIFFICULTIES } from './session';
import { coachMarkup } from './coach';
import { valueAt } from './questions';
import { answerChallenge } from './answer-challenge';
import { VERSION } from './release';
import { gameShell } from './layout';
import type { State, Category, Card } from './types';
import { CARDS, cardLegal, bonusScore } from './cards';
import { QUESTIONS, CATEGORIES, questionLegal } from './questions';
import { KIND_NAMES, LINE_NAMES, LINE_COLORS, route } from './world';
import { NAMES, visibleEvent, suggestedQuestion } from './simulation';
import { pathfind, coverAt } from './local';
import { canTag, stealthState } from './stealth';
import { landscape, stationLabels, districtMiniature } from './map-art';
import { photoData, avatarArt } from './art';
import { type Appearance } from './appearance';
import { characterEditor } from './character-editor';
import { regionalPosition } from './transit';
import { ollamaSettings, ollamaStatus } from './ollama';
export const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export const clock = (t: number) =>
  `${Math.floor(Math.max(0, t) / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(Math.max(0, t) % 60)
    .toString()
    .padStart(2, '0')}`;
export const icon = (name: string, size = 20) => {
  const paths: Record<string, string> = {
    train: 'M5 3h14v13H5zM8 7h3v4H8zm5 0h3v4h-3zM7 20l2-4m8 4l-2-4M5 13h14',
    map: 'M3 5l6-2l6 2l6-2v16l-6 2l-6-2l-6 2zm6-2v16m6-14v16',
    book: 'M3 4q5-2 9 1q4-3 9-1v15q-5-2-9 1q-4-3-9-1zm9 1v15',
    search: 'M16 16l6 6M19 10a8 8 0 1 1-16 0a8 8 0 0 1 16 0',
    cards: 'M7 5l12-2l3 15l-12 2zm-4 1v15h11',
    team: 'M4 20v-3q0-5 5-5t5 5v3m1-7q6-2 6 5v2M12 6a3 3 0 1 1-6 0a3 3 0 0 1 6 0m8 1a3 3 0 1 1-6 0a3 3 0 0 1 6 0',
    settings:
      'M12 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8m0-6v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3M5 19l3-3M16 8l3-3',
    save: 'M4 3h14l3 3v15H3V3zm3 0v7h10V3M7 21v-8h10v8',
    pause: 'M8 4v16m8-16v16',
    play: 'M7 3l14 9l-14 9z',
    chevron: 'M8 4l8 8l-8 8',
    collapse: 'M5 8l7 7l7-7',
    expand: 'M5 16l7-7l7 7',
    check: 'M4 12l5 5L20 6',
    close: 'M5 5l14 14M19 5L5 19',
    pin: 'M12 22s8-8 8-14a8 8 0 1 0-16 0c0 6 8 14 8 14m0-17a3 3 0 1 1 0 6a3 3 0 0 1 0-6',
    ticket: 'M3 5h18v5q-4 2 0 4v5H3v-5q4-2 0-4zm12 0v14',
    flag: 'M5 22V3m0 0q5-3 10 0t7 0v11q-4 3-8 0t-9 0',
    help: 'M9 7a4 4 0 1 1 6 4q-3 1-3 5m0 3v1M12 2a10 10 0 1 1 0 20a10 10 0 0 1 0-20',
    photo: 'M3 7h5l2-3h5l2 3h4v13H3zm9 3a4 4 0 1 1 0 8a4 4 0 0 1 0-8',
    sound: 'M3 9h4l6-5v16l-6-5H3zm14-2q7 5 0 10',
    trophy: 'M7 3h10v9q-5 8-10 0zm0 2H3q0 8 5 7m9-7h4q0 8-5 7m-4 3v6m-5 0h10',
    leaf: 'M5 20Q0 4 21 3q0 20-16 17m0 0L17 7',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.flag}"/></svg>`;
};
export type Panel =
  | 'new'
  | 'map'
  | 'questions'
  | 'notebook'
  | 'team'
  | 'credits'
  | 'tools'
  | 'settings'
  | 'appearance'
  | 'tutorial'
  | 'cards'
  | 'card'
  | 'reward'
  | 'overflow'
  | 'reaction'
  | 'results'
  | 'replay'
  | 'puzzle'
  | null;
export function panelClockPaused(s: State, panel: Panel) {
  return (
    s.paused ||
    !['headstart', 'search'].includes(s.phase) ||
    (s.hider === 0 && !s.autoHuman && !!(s.pending || s.rewards.length || s.hand.length > s.handLimit)) ||
    (!!panel &&
      panel !== 'puzzle' &&
      (s.settings.panelPause ||
        ['new', 'settings', 'appearance', 'tutorial', 'results', 'replay', 'tools'].includes(panel)))
  );
}
export interface UIState {
  roleIntroKey?: string;
  roleIntroUntil?: number;
  answerPreparedKey?: string;
  panel: Panel;
  selectedStation: number;
  category: Category;
  selectedCard: number;
  extra: number[];
  reward: number[];
  libraryCard: number | null;
  tutorialPage: number;
  replayTime: number;
  toast: string;
  hasSave: boolean;
  remap: string | null;
  notebookOpen: boolean;
  trayOpen: boolean;
  handPreview: boolean;
  handNavigation: boolean;
  appearanceDraft: Appearance | null;
  appearanceReturn: Panel;
  previewAnimated: boolean;
  newGameDraft: { seed: string; size: string; mode: string; pace?: string; difficulty?: string } | null;
  sprintToggle: boolean;
  ollamaExpanded: boolean;
  setupOpen: boolean;
  disclosures: Record<string, boolean>;
}
export const initialUI = (): UIState => ({
  panel: 'new',
  selectedStation: 0,
  category: 'Matching',
  selectedCard: 0,
  extra: [],
  reward: [],
  libraryCard: null,
  tutorialPage: 0,
  replayTime: 0,
  toast: '',
  hasSave: false,
  remap: null,
  notebookOpen: false,
  trayOpen: false,
  handPreview: false,
  handNavigation: false,
  appearanceDraft: null,
  appearanceReturn: null,
  previewAnimated: true,
  newGameDraft: null,
  sprintToggle: false,
  ollamaExpanded: false,
  setupOpen: false,
  disclosures: {},
});
export function shell() {
  return gameShell(icon);
}
const markup = new Map<string, string>();
const set = (id: string, html: string) => {
  if (markup.get(id) === html) return;
  const el = document.getElementById(id)!,
    active = document.activeElement as HTMLElement | null;
  let focus = '';
  if ((id === 'overlay' || id === 'time-tools') && active?.closest('#' + id)) {
    if (active.id) focus = '#' + CSS.escape(active.id);
    else if (active.dataset.action)
      focus = `[data-action="${CSS.escape(active.dataset.action)}"]${active.dataset.index !== undefined ? `[data-index="${active.dataset.index}"]` : ''}${active.dataset.value ? `[data-value="${CSS.escape(active.dataset.value)}"]` : ''}`;
  }
  el.innerHTML = html;
  markup.set(id, html);
  const restore = focus ? el.querySelector<HTMLElement>(focus) : null;
  if (restore) restore.focus({ preventScroll: true });
  else if (id === 'overlay' && html)
    el.querySelector<HTMLElement>('button:not(:disabled),input,select,[role=button]')?.focus({
      preventScroll: true,
    });
};
export const handExpanded = (s: State, u: UIState) =>
  s.hider === 0 &&
  s.hand.length > 0 &&
  !!(u.trayOpen || u.handPreview || (s.coach?.step === 4 && !s.coach.usedCard));
function smallCard(c: Card, index: number, action = 'inspect', selected = false, fanCount = 0) {
  const offset = index - (fanCount - 1) / 2;
  const fanStyle = fanCount
    ? `style="--fan-slot:${offset};--fan-angle:${offset * 5}deg;--fan-arc:${Math.abs(offset) * 8}px;--fan-order:${index}"`
    : '';
  return `<button class="travel-card ${c.type} ${selected ? 'selected' : ''}" data-action="${action}" data-index="${index}" ${fanStyle} aria-label="${esc(c.title)}" ${action === 'reward-pick' ? `aria-pressed="${selected}"` : ''}><div class="card-top"><span>${icon(c.type === 'curse' ? 'flag' : c.type === 'tool' ? 'cards' : 'trophy', 12)} ${c.type}</span>${c.duration || c.reaction ? `<b>${c.type === 'bonus' ? '+' : ''}${c.duration ? c.duration + 's' : 'React'}</b>` : ''}</div><img src="/art/cards/${c.id}.webp" alt=""/><div class="card-copy"><strong>${esc(c.title)}</strong><p>${esc(c.summary)}</p></div><span class="card-cost">${c.cost ? 'Discard ' + c.cost + ' extra' : c.type === 'bonus' ? 'Retain to score' : c.reaction ? 'Question reaction' : 'No extra cost'}</span><span class="card-selection">${icon('check', 16)}</span></button>`;
}
function effectMarkup(s: State, hider: boolean) {
  const curses = s.effects
    .map((e) => {
      const place =
        e.card === 1
          ? 'bridge'
          : e.card === 0
            ? 'attraction'
            : e.card === 9
              ? 'scenic spot'
              : e.card === 8
                ? 'lost birds'
                : 'marked target';
      const required = e.card === 1 ? 15 : [0, 9].includes(e.card) ? 20 : 0;
      const stage = e.target
        ? e.progress > 0
          ? 'Stay ' + Math.floor(e.progress) + ' / ' + required + 's'
          : 'Go to ' + place
        : e.card === 2
          ? 'Match the three stamps'
          : e.card === 5
            ? e.category + ' questions locked'
            : e.card === 10
              ? e.charges + ' questions left'
              : 'Wait for the curse to end';
      return (
        '<button class="effect" data-action="effect" data-index="' +
        e.card +
        '"><span class="effect-icon">!</span><span><b>' +
        CARDS[e.card].title +
        '</b><small>' +
        stage +
        ' · ' +
        Math.ceil(e.until - s.time) +
        's left</small>' +
        (e.target ? '<progress value="' + e.progress + '" max="' + (required || 1) + '"></progress>' : '') +
        '</span>' +
        icon('chevron', 13) +
        '</button>'
      );
    })
    .join('');
  const tools = hider
    ? `${s.doubleDip ? '<div class="effect tool-status"><span class="effect-icon">↗</span><span><b>Double Dip ready</b><small>Next answered question earns two rewards</small></span></div>' : ''}${s.revealUntil > s.time ? `<div class="effect tool-status"><span class="effect-icon">↗</span><span><b>Seekers revealed</b><small>${Math.ceil(s.revealUntil - s.time)}s of live map positions</small></span></div>` : ''}`
    : '';
  return curses || tools ? `${curses}${tools}` : '';
}
const notices = new WeakMap<State, { count: number; text: string; until: number; clue: boolean }>();
export function paint(s: State, u: UIState) {
  watchCaptures(s);
  const capture = captureMoment(s);
  const startingCapture = !!capture && !document.body.classList.contains('capture-active');
  document.body.classList.toggle('capture-active', !!capture);
  set(
    'capture-moment',
    capture
      ? `<div class="capture-banner"><h2>TAG!</h2><p>${capture.hider === 0 ? `${NAMES[capture.tagger]} caught you!` : `${capture.tagger === 0 ? 'You' : NAMES[capture.tagger]} caught ${NAMES[capture.hider]}!`}</p><span>Hidden for ${clock(s.results.at(-1)?.survival ?? 0)}</span><button id="capture-continue" data-action="results">Continue ${icon('chevron', 16)}</button></div>`
      : '',
  );
  if (capture) u.panel = null;
  if (startingCapture) document.getElementById('capture-continue')?.focus({ preventScroll: true });
  document.body.classList.toggle('panel-open', !!u.panel);
  document.body.classList.toggle(
    'compact-tools-open',
    !!u.panel && ['questions', 'notebook', 'team', 'puzzle'].includes(u.panel),
  );
  const notice = notices.get(s) ?? { count: s.events.length, text: '', until: 0, clue: false };
  if (notice.count > s.events.length) notice.count = 0;
  const important = s.events
    .slice(notice.count)
    .filter(
      (event) =>
        visibleEvent(s, event) && ['answer', 'curse', 'arrival', 'observation', 'phase'].includes(event.type),
    );
  const latest =
    [...important].reverse().find((event) => event.type === 'answer' || event.type === 'curse') ??
    important.at(-1);
  if (latest) {
    const clue = s.evidence.at(-1);
    notice.text =
      latest.type === 'answer' && clue
        ? `Reply: ${clue.answer}. ${clue.excluded.length} places crossed off; ${s.candidates.length} remain. Choose your next stop on the map.`
        : latest.text;
    notice.clue = latest.type === 'answer';
    notice.until = performance.now() + 8500;
  }
  notice.count = s.events.length;
  notices.set(s, notice);
  set(
    'game-notice',
    performance.now() < notice.until
      ? `<div class="game-notice"><span>${esc(notice.text)}</span>${notice.clue && s.hider !== 0 ? '<button data-action="map">See clue on map</button>' : ''}</div>`
      : '',
  );
  const hider = s.hider === 0,
    a = s.actors[0],
    st = s.world.stations[a.station],
    search = s.phase === 'search',
    active = ['headstart', 'search'].includes(s.phase),
    head = s.phase === 'headstart',
    time = head
      ? s.rules.headStart - (s.time - s.phaseAt)
      : search
        ? s.time - s.searchAt
        : s.results.at(-1)?.survival || 0;
  document.body.dataset.role = hider ? 'hider' : 'seeker';
  document.body.classList.toggle('travel-planned', !!a.journey.length || a.destination !== null);
  const roleKey = `${s.world.seed}:${s.round}:${s.hider}`;
  if (!u.panel && !s.coach && head && s.time - s.phaseAt < 8 && u.roleIntroKey !== roleKey) {
    u.roleIntroKey = roleKey;
    u.roleIntroUntil = performance.now() + 6500;
  }
  if (u.panel) u.roleIntroUntil = 0;
  const showRole = !u.panel && performance.now() < (u.roleIntroUntil ?? 0);
  document.body.classList.toggle('role-intro-open', showRole);
  set(
    'role-intro',
    showRole
      ? `<div class="role-intro-card ${hider ? 'hider' : 'seeker'}">${icon(hider ? 'leaf' : 'search', 32)}<div><strong class="role-intro-title">You are the ${hider ? 'HIDER' : 'SEEKER'}</strong><p>${hider ? 'Leave town, choose your district, then stay hidden from Mira and Kit.' : `Find ${NAMES[s.hider]}. Ask questions, travel together, then get close to tag.`}</p></div></div>`
      : '',
  );
  document.body.classList.toggle('human-seeker', !hider);
  document.body.classList.toggle('notebook-open', u.notebookOpen);
  if (!hider) u.trayOpen = u.handPreview = u.handNavigation = false;
  const expanded = handExpanded(s, u);
  document.body.classList.toggle('tray-collapsed', !expanded);
  document.body.classList.toggle('hand-open', expanded);
  set(
    'player-avatar',
    `<button class="avatar-button" data-action="appearance" aria-label="Customize character" title="Customize character [V]"><img class="player-portrait" src="${avatarArt(s.appearance).portrait}" alt="Your traveler"/></button>`,
  );
  document.getElementById('live-notebook')!.hidden = !u.notebookOpen;
  const trayToggle = document.querySelector<HTMLButtonElement>('[data-action=toggle-tray]')!;
  trayToggle.disabled = !s.hand.length;
  trayToggle.setAttribute('aria-expanded', String(expanded));
  trayToggle.setAttribute('aria-label', expanded ? 'Collapse card tray' : 'Expand card tray');
  set(
    'role-compact',
    `<span class="hud-role ${hider ? 'hider' : 'seeker'}">${icon(hider ? 'leaf' : 'search', 17)}<strong>${hider ? 'HIDER' : 'SEEKER'}</strong><span class="role-job">${hider ? 'Stay unseen' : `Find ${NAMES[s.hider]}`}</span></span>`,
  );
  for (const button of document.querySelectorAll<HTMLElement>('.rail-nav [data-action]')) {
    const selected = button.dataset.action === u.panel;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
  set(
    'match-status',
    `<span class="match-main">Set ${s.set} <span class="soft-dot">/</span> Turn ${(s.round % 3) + 1} of 3</span><span class="score-mini">${NAMES.map((n, i) => `<span class="player-score p${i}">${n} <b>${s.totals[i]}</b></span>`).join('')}</span>`,
  );
  set(
    'location',
    `<span class="location-icon">${icon('pin', 22)}</span><div><h1>${esc(st.name)}</h1><span>${KIND_NAMES[st.kind]} <i>·</i> ${esc(st.zone)}</span></div>`,
  );
  set(
    'time-tools',
    `<div class="clock-label"><span>${s.paused ? 'Paused' : head ? 'Head start' : search ? 'Search' : s.phase === 'preparation' ? 'Ready' : 'Turn complete'}${s.speed > 1 ? ' · ' + s.speed + '×' : ''}</span><strong class="${head && time < 25 ? 'urgent' : ''}">${s.coach && head ? 'Practice' : clock(time)}</strong></div><div class="speed-tools"><button data-action="pause" aria-label="${s.paused ? 'Resume' : 'Pause'}" title="${s.paused ? 'Resume' : 'Pause'} [Space]">${icon(s.paused ? 'play' : 'pause', 16)}</button><div class="speed-rates" role="group" aria-label="Game speed">${PLAYBACK_SPEEDS.map((rate) => `<button data-action="speed" data-value="${rate}" class="${s.speed === rate ? 'active' : ''}" aria-pressed="${s.speed === rate}" aria-label="${rate === 1 ? 'Normal speed' : 'Fast forward'} ${rate}×" title="${rate}× speed · [ / ]">${rate}×</button>`).join('')}</div></div>`,
  );
  set(
    'role-panel',
    `<div class="role-label ${hider ? 'hiding' : 'seeking'}">${icon(hider ? 'leaf' : 'search', 18)} YOU ARE ${hider ? 'HIDING' : 'SEEKING'}</div><div class="notebook-stat"><strong>${hider ? clock(search ? time : 0) : s.candidates.length}</strong><span>${hider ? 'Survived' : 'Candidate districts'}<small>${hider ? `+${bonusScore(s)}s retained bonuses` : `${s.world.stations.length - s.candidates.length} ruled out of ${s.world.stations.length}`}</small></span></div>`,
  );
  set('effects', effectMarkup(s, hider));
  set('coach', coachMarkup(s));
  const mate = s.actors.find((a) => a.id !== 0 && a.id !== s.hider);
  const command = s.events.filter((e) => e.type === 'command').at(-1);
  const lastTeam =
    command && s.time - command.time < 8
      ? command
      : s.events.filter((e) => ['command', 'teammate', 'observation'].includes(e.type)).at(-1);
  set(
    'companion',
    `<div class="companion-head"><span class="portrait ${hider ? 'kit' : mate?.id === 1 ? 'mira' : 'kit'}">${hider ? '?' : mate?.id === 1 ? 'M' : 'K'}</span><span><b>${hider ? 'Mira & Kit' : NAMES[mate!.id]}</b><small>${hider ? 'Positions unknown' : mate!.id === 1 ? 'The careful planner' : 'The happy improviser'}</small></span>${!hider ? '<span class="status-dot"></span>' : ''}</div><p class="radio-copy">${hider ? 'Question origins and sightings appear on your map.' : esc(lastTeam?.text.split(': ').slice(1).join(': ') || 'I’m right behind you. Let’s narrow it down, then search together.')}</p>${hider ? '' : `<button class="outline-button full" data-action="team">${icon('team', 16)} Talk to ${NAMES[mate!.id]}</button>`}`,
  );
  const events = s.events
    .filter(
      (e) =>
        e.time >= s.phaseAt &&
        visibleEvent(s, e) &&
        ['answer', 'question', 'arrival', 'card', 'observation', 'phase', 'curse', 'speech'].includes(e.type),
    )
    .slice(-4)
    .reverse();
  set(
    'activity',
    `<div class="section-label activity-label"><h3>Recent events</h3><button data-action="notebook" class="text-button">View all</button></div><div class="activity-list">${events.length ? events.map((e) => `<div class="activity-item"><div><time>${clock(e.time)}</time><p>${esc(e.text)}</p></div></div>`).join('') : `<p class="empty-copy">${hider ? 'No questions yet. Seekers can ask after the head start.' : 'No clues yet. Ask a question when the search begins.'}</p>`}</div>`,
  );
  const journey = a.journey[0];
  set('world-label', `<span class="world-locale">${icon('pin', 14)} ${esc(st.landmark)}</span>`);
  set(
    'world-status',
    s.paused
      ? '<div class="floating-status">Paused <kbd>Space</kbd> to resume</div>'
      : journey
        ? `<div class="transit-status">${icon('train', 20)}<div><b>${serviceStop(journey, s.time) ? 'Crew repairing the service' : s.time < journey.depart ? 'Waiting on the platform' : 'On the ' + LINE_NAMES[journey.line]}</b><span>${esc(s.world.stations[journey.to].name)} · ${s.time < journey.depart ? 'departs in ' + Math.ceil(journey.depart - s.time) : 'arrives in ' + Math.ceil(journey.arrive - s.time)}s${serviceNote(journey) ? '<br/>' + esc(serviceNote(journey)) : ''}</span></div></div>`
        : a.destination !== null
          ? `<div class="transit-status">${icon('train', 20)}<div><b>Walking to the platform</b><span>Destination: ${esc(s.world.stations[a.destination].name)} · follow the dotted path</span></div><button data-action="cancel-travel">Cancel</button></div>`
          : s.hider === 0 && s.locked
            ? '<div class="floating-status">Local search · break sightlines and find cover</div>'
            : '',
  );
  const speaker = nearbyResident(s);
  set(
    'context-prompt',
    !journey && active && (canTag(s) || speaker)
      ? '<button class="context-talk" data-action="interact"><kbd>' +
          esc(s.settings.bindings.interact.replace('Key', '')) +
          ' / A</kbd> ' +
          (canTag(s) ? 'Tag' : 'Talk to ' + esc(speaker!.name)) +
          '</button>'
      : '',
  );
  const cover = coverAt(st.local, a);
  const stealth = stealthState(s);
  const tagReady = canTag(s);
  document.getElementById('movement-tools')!.dataset.stealth = stealth;
  document.getElementById('world-wrap')!.dataset.tagReady = String(tagReady);
  set(
    'stealth-announcement',
    !active || journey
      ? ''
      : tagReady
        ? 'Hider in reach. Press interact to tag.'
        : !hider
          ? ''
          : stealth === 'spotted'
            ? 'Spotted. Break the sightline or find cover.'
            : stealth === 'concealed'
              ? 'Concealed. Keep still; close inspection can reveal you.'
              : stealth === 'cover'
                ? 'Usable cover nearby. Press Hide to conceal yourself.'
                : '',
  );
  set(
    'movement-tools',
    `<button class="movement-button ${u.sprintToggle ? 'selected' : ''}" data-action="sprint-toggle" aria-pressed="${u.sprintToggle}" title="Hold Shift / right trigger: faster, visible from farther away">${icon('chevron', 14)} ${a.sprinting ? 'Sprinting' : 'Sprint'} <kbd>${esc((s.settings.bindings.sprint ?? 'ShiftLeft').replace('Left', ''))}</kbd></button>${hider && (cover || a.hiding) ? `<button class="movement-button ${a.hiding ? 'selected' : ''}" data-action="hide" aria-pressed="${a.hiding}" ${!cover && !a.hiding ? 'disabled' : ''} title="Hide beside walls, trees, bushes, stalls or solid objects. Stay still; close inspection reveals you.">${icon('leaf', 14)} ${a.hiding ? (stealthState(s) === 'spotted' ? 'Spotted' : 'Concealed') : 'Hide'} <kbd>${esc((s.settings.bindings.hide ?? 'KeyH').replace('Key', ''))}</kbd></button>` : ''}`,
  );
  const objective =
    s.phase === 'preparation'
      ? '<button data-action="start" class="accent-button">' +
        (hider ? 'Start your escape' : 'Start hiding turn') +
        '</button>'
      : head
        ? hider
          ? s.committed !== null
            ? '<span class="goal-note">Find cover. Seekers start in ' + Math.ceil(time) + 's.</span>'
            : '<button data-action="' +
              (a.station === s.start ? 'map' : 'commit') +
              '" class="accent-button">' +
              (a.station === s.start ? 'Choose a service' : 'Commit to ' + esc(st.name)) +
              '</button>'
          : '<button data-action="skip-headstart" class="accent-button">Skip remaining head start</button>'
        : search
          ? hider
            ? '<span class="goal-note">' +
              (s.locked ? 'Seekers nearby. Stay hidden.' : 'Stay unseen. Use cover.') +
              '</span>'
            : '<button data-action="questions" class="accent-button">' +
              (suggestedQuestion(s) ? 'Review suggested question' : 'Ask a question') +
              '</button><span class="goal-note">' +
              s.candidates.length +
              ' places left</span>'
          : '<button data-action="results" class="accent-button">See results</button>';
  set('objective', objective);
  set('hand-heading', `<strong>${s.hand.length}/${s.handLimit}</strong><kbd>R / LB</kbd>`);
  set(
    'hand',
    hider
      ? s.hand.map((id, i) => smallCard(CARDS[id], i, 'inspect', false, s.hand.length)).join('')
      : `<div class="seeker-kit">${[
          ['questions', 'search', 'Ask a question', 'Compare clues across six categories.'],
          ['map', 'train', 'Plan a journey', 'Check departures and transfers.'],
          ['team', 'team', 'Team commands', 'Stay together and clear a curse.'],
        ]
          .map(
            ([action, i, title, desc]) =>
              `<button data-action="${action}"><span class="kit-icon">${icon(i, 27)}</span><span><strong>${title}</strong><p>${desc}</p></span>${icon('chevron', 16)}</button>`,
          )
          .join('')}</div>`,
  );
  set('toast', u.toast ? `<div class="toast">${esc(u.toast)}</div>` : '');
  document.documentElement.style.setProperty('--text-scale', String(s.settings.textScale));
  document.body.classList.toggle('reduced-motion', s.settings.reducedMotion);
  if (
    s.phase === 'results' &&
    !capture &&
    !['replay', 'results', 'settings', 'appearance', 'notebook', 'new'].includes(u.panel || '')
  )
    u.panel = 'results';
  if (s.hider === 0 && s.pending && !['reaction', 'card', 'cards', 'settings'].includes(u.panel || ''))
    u.panel = 'reaction';
  if (s.hider === 0 && s.rewards.length && u.panel !== 'reward') {
    u.panel = 'reward';
    u.reward = [];
  }
  if (s.hider === 0 && !s.rewards.length && s.hand.length > s.handLimit && u.panel !== 'overflow') {
    u.panel = 'overflow';
    u.extra = [];
  }
  if (s.phase === 'finished' && !capture && !u.panel) u.panel = 'results';
  paintPanel(s, u);
}
function modal(title: string, kicker: string, body: string, wide = false, closable = true) {
  const context = /^(CURSE|TOOL|BONUS)/.test(kicker) ? kicker.toLowerCase() : '';
  return `<div class="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-header"><div><h2>${title}</h2>${context ? `<p class="modal-context">${context}</p>` : ''}</div>${closable ? `<button class="icon-button" data-action="close" aria-label="Close panel">${icon('close', 22)}</button>` : ''}</header>${body}</section></div>`;
}
function ollamaPanel(u: UIState, compact = false) {
  const expanded = !compact || u.ollamaExpanded;
  const detail =
    compact && ollamaStatus.phase === 'offline'
      ? 'Local AI unavailable · classic NPCs active.'
      : ollamaStatus.detail;
  return `<section class="ollama-panel" aria-label="Ollama NPC AI"><div class="ollama-summary"><label><input type="checkbox" data-ollama="enabled" ${ollamaSettings.enabled ? 'checked' : ''}/> Ollama NPC AI</label>${compact ? `<button type="button" class="text-button" data-action="ollama-options" aria-expanded="${expanded}">Model & connection</button>` : ''}</div><p class="ollama-state ${ollamaStatus.phase}" role="status">${esc(ollamaSettings.enabled ? (ollamaStatus.busy ? `Thinking · ${ollamaStatus.model}` : detail) : 'Classic NPCs')}</p>${expanded ? `<div class="ollama-connection"><label for="ollama-model">Local model<select id="ollama-model"><option value="">Auto · smallest installed model</option>${ollamaStatus.models.map((model) => `<option value="${esc(model.name)}" ${ollamaSettings.model === model.name ? 'selected' : ''}>${esc(model.name)}</option>`).join('')}</select></label><button type="button" class="outline-button" data-action="ollama-reconnect" ${!ollamaSettings.enabled ? 'disabled' : ''}>Reconnect</button></div><p class="fine">Local Ollama guides travelers and residents. People keep working, running errands and taking breaks while a model is busy or offline. ${ollamaStatus.plans ? `${ollamaStatus.plans} model plan${ollamaStatus.plans === 1 ? '' : 's'} received.` : ''}</p>` : ''}</section>`;
}
let renderedPanel: Panel = null;
function disclosure(id: string, label: string, body: string) {
  return `<details class="menu-disclosure" data-disclosure="${id}"><summary>${label}${icon('chevron', 16)}</summary><div>${body}</div></details>`;
}
function journeySetup(s: State, u: UIState) {
  const pace = u.newGameDraft?.pace ?? 'quick',
    difficulty = u.newGameDraft?.difficulty ?? 'standard';
  const world = `<label>World seed<input name="seed" value="${esc(u.newGameDraft?.seed ?? s.world.seed)}" maxlength="60" autocomplete="off"/><button type="button" data-action="random-seed" class="text-button">Randomize seed</button></label><label>Region size<select name="size">${[20, 30, 40].map((n) => `<option value="${n}" ${(u.newGameDraft?.size ?? '30') === String(n) ? 'selected' : ''}>${n} stations</option>`).join('')}</select></label><fieldset><legend>Mode</legend>${[
    ['match', 'Full journey'],
    ['hider', 'Practice hiding'],
    ['seeker', 'Practice seeking'],
    ['tutorial', 'Guided introduction'],
  ]
    .map(
      ([value, label]) =>
        `<label class="mode-option"><input type="radio" name="mode" value="${value}" ${(u.newGameDraft?.mode ?? 'match') === value ? 'checked' : ''}/><span><b>${label}</b></span></label>`,
    )
    .join(
      '',
    )}</fieldset><button data-action="import" type="button" class="text-button">Import a saved journey</button>`;
  return `<div class="new-game distilled-setup"><div class="new-traveler"><img class="player-portrait" src="${avatarArt(s.appearance).portrait}" alt="Your traveler"/><button type="button" data-action="appearance" class="text-button">Customize character</button></div><form id="new-form"><label>Match format<select name="pace">${Object.entries(
    FORMATS,
  )
    .map(([key, v]) => `<option value="${key}" ${pace === key ? 'selected' : ''}>${v.title}</option>`)
    .join(
      '',
    )}</select><small id="format-description">${FORMATS[pace as keyof typeof FORMATS].description}</small></label><label>Difficulty<select name="difficulty">${Object.entries(
    DIFFICULTIES,
  )
    .map(([key, v]) => `<option value="${key}" ${difficulty === key ? 'selected' : ''}>${v.title}</option>`)
    .join(
      '',
    )}</select><small id="difficulty-description">${DIFFICULTIES[difficulty as keyof typeof DIFFICULTIES].description}</small></label>${disclosure('journey-options', 'World & practice options', world)}<button class="primary-button full" type="submit" aria-label="Start game">Start journey ${icon('chevron', 17)}</button></form></div>`;
}
function questionSuggestionMarkup(s: State) {
  const proposal = suggestedQuestion(s);
  const question = proposal && QUESTIONS.find((q) => q.id === proposal.id);
  if (!proposal || !question) return '';
  return `<div class="question-suggestion"><div><strong>${esc(NAMES[proposal.actor])} suggests: ${esc(question.title)}</strong><p>Ask from ${esc(s.world.stations[proposal.origin].name)}. Hider draws ${question.draw} and keeps ${question.keep}. You can choose another question below.</p></div><button class="primary-button" data-action="approve-question">Approve question</button></div>`;
}
function settingsBody(s: State, u: UIState) {
  const toggle = (key: string, label: string) =>
    `<label class="toggle-row"><span>${label}</span><input type="checkbox" data-setting="${key}" ${s.settings[key as keyof typeof s.settings] ? 'checked' : ''}/></label>`;
  const mixer = [
    ['musicVolume', 'Music', 0.22],
    ['effectsVolume', 'Effects', 0.7],
    ['ambienceVolume', 'Ambience', 0.4],
  ]
    .map(([key, label, fallback]) => {
      const value = Number(s.settings[key as keyof typeof s.settings] ?? fallback);
      return `<label>${label}<output>${Math.round(value * 100)}%</output><input type="range" min="0" max="1" step=".05" data-volume="${key}" aria-label="${label} volume" value="${value}"/></label>`;
    })
    .join('');
  const bindings = Object.entries(s.settings.bindings)
    .map(
      ([key, value]) =>
        `<button data-action="remap" data-value="${key}"><span>${key}</span><kbd>${u.remap === '' + key ? 'Press a key…' : esc(value.replace('Key', ''))}</kbd></button>`,
    )
    .join('');
  const master = s.settings.masterVolume ?? 0.7;
  return `<div class="settings-body distilled-settings"><div class="settings-essential"><label>Text size<output>${Math.round(s.settings.textScale * 100)}%</output><input id="text-scale" type="range" min="1" max="1.4" step=".1" value="${s.settings.textScale}"/></label>${toggle('reducedMotion', 'Reduce motion')}${toggle('sound', 'Enable audio')}<label>Master volume<output>${Math.round(master * 100)}%</output><input type="range" min="0" max="1" step=".05" data-volume="masterVolume" aria-label="Master volume" value="${master}"/></label></div>${disclosure('sound-levels', 'Music, effects & ambience', `<div class="audio-mixer">${mixer}</div>`)}${disclosure('controls', 'Controls & assistance', `<div class="bindings">${bindings}</div><p class="fine">Controller: stick to walk · A interact · X hide · Y map · right trigger sprint · LB opens your hand · A inspects a card · B stows · Start opens field tools · B back.</p>${toggle('panelPause', 'Pause while reading panels')}${toggle('simplified', 'Simplify paperwork puzzles')}${toggle('autoQuestions', 'Let teammate ask questions automatically')}<p class="fine">Off by default: your teammate suggests questions in Ask; you approve or choose your own. Each answer rewards the hider.</p><p class="fine">${FORMATS[s.session?.pace ?? 'classic'].title} · ${DIFFICULTIES[s.session?.difficulty ?? 'standard'].title}. ${DIFFICULTIES[s.session?.difficulty ?? 'standard'].description}</p>`)}${disclosure('local-ai', 'Local NPC AI', ollamaPanel(u))}${disclosure('save-recovery', 'Saves & recovery', `<p class="fine">Autosave keeps a previous copy. Export the current journey before restoring an older backup if you want to keep both.</p><div class="button-row"><button data-action="save" class="outline-button">Save match</button><button data-action="export" class="outline-button">Export save</button><button data-action="import" class="outline-button">Import save</button><button data-action="restore-backup" class="text-button">Restore previous backup</button></div>`)}${disclosure('support', 'Help & credits', `<div class="settings-links"><button data-action="tutorial">How to play</button><button data-action="credits">Credits · ${VERSION}</button><button data-action="support-report">Export playtest / support report</button></div>`)}<div class="settings-footer"><button data-action="fullscreen" class="outline-button">Fullscreen</button><button data-action="new-menu" class="text-button">Journey menu</button></div></div>`;
}
function paintPanel(s: State, u: UIState) {
  document.getElementById('overlay')!.dataset.panel = u.panel ?? '';
  for (const el of document.querySelectorAll<HTMLElement>('.masthead,.game-layout,.app-footer,#coach'))
    el.inert = !!u.panel;
  if (!u.panel) {
    set('overlay', '');
    renderedPanel = null;
    return;
  }
  const focused = document.activeElement;
  if (
    renderedPanel === u.panel &&
    focused?.closest('#overlay') &&
    focused.matches('textarea,input[type=range],input[name=seed]')
  )
    return;
  let html = '';
  if (u.panel === 'appearance' && u.appearanceDraft) {
    html = modal('Your traveler', '', characterEditor(u.appearanceDraft, u.previewAnimated));
  }
  if (u.panel === 'new' && u.setupOpen) html = modal('New journey', '', journeySetup(s, u));
  if (u.panel === 'new' && !u.setupOpen)
    html = `<div class="title-screen" role="dialog" aria-modal="true" aria-label="New game"><div class="title-art" aria-hidden="true"></div><button class="title-close icon-button" data-action="close" aria-label="Close panel">${icon('close', 22)}</button><div class="title-content"><div class="title-brand"><img class="title-emblem" src="/brand/last-stop-mark.svg" width="88" height="88" alt=""/><div class="title-mark">LAST<span>STOP</span></div></div><p class="title-tagline">Every stop has a secret.</p><div class="title-actions">${u.hasSave ? '<button class="title-button continue-button" data-action="resume" aria-label="Resume saved match">Continue journey</button>' : ''}<button class="title-button ${u.hasSave ? '' : 'primary'}" data-action="setup-journey">New journey ${icon('chevron', 20)}</button><button class="title-button" data-action="start-coach">Learn to play</button></div><div class="title-utilities"><button data-action="fullscreen">Fullscreen</button><button data-action="appearance">Your traveler</button><button data-action="settings">Settings</button></div><p class="title-footnote"><button class="text-button" data-action="credits">Credits · v${VERSION}</button></p></div></div>`;
  if (u.panel === 'map')
    html = modal(
      'Region map',
      'REGIONAL RAILWAY & FIELD MAP',
      `<div class="map-body"><div class="map-paper">${s.hider !== 0 && s.evidence.length ? `<div class="map-clue"><b>${s.evidence.at(-1)!.excluded.length} places crossed off</b> · ${esc(s.evidence.at(-1)!.question)} <strong>${esc(s.evidence.at(-1)!.answer)}</strong></div>` : ''}${regionalMap(s, u)}<div class="map-legend">${LINE_NAMES.slice(
        0,
        4,
      )
        .map((l, i) => `<span><i style="background:${LINE_COLORS[i]}"></i>${l}</span>`)
        .join(
          '',
        )}<span>◇ possible · × excluded · highlighted route = selected journey</span></div>${s.hider === 0 ? `<p class="known-positions">${s.lastKnown.length ? s.lastKnown.map((k) => `${NAMES[k.id]} · last known ${clock(k.time)}`).join(' &nbsp; / &nbsp; ') : 'Seeker positions unknown. Question origins and sightings appear here.'}</p>` : ''}</div><aside class="station-detail">${stationDetail(s, u)}</aside></div>`,
      true,
    );
  if (u.panel === 'questions')
    html = modal(
      'Investigation',
      'TEAM INVESTIGATION',
      `${questionSuggestionMarkup(s)}<div class="question-summary"><span>${s.candidates.length} candidate districts</span><span>Team cooldown: <b>${Math.max(0, Math.ceil(s.questionReady - s.time))}s</b></span></div><div class="category-tabs">${CATEGORIES.map((c) => `<button data-action="category" data-value="${c}" class="${u.category === c ? 'selected' : ''}">${c}</button>`).join('')}</div><div class="question-list">${QUESTIONS.filter(
        (q) => q.category === u.category,
      )
        .sort((a, b) => s.questionOrder.indexOf(a.id) - s.questionOrder.indexOf(b.id))
        .map((q) => {
          const err = questionLegal(s, q.id, 0);
          return `<button data-action="ask" data-id="${q.id}" class="question-row" ${err ? 'disabled' : ''}><span><strong>${q.title}</strong><small>Refers to: ${q.anchor === 'position' ? 'current hiding position' : q.anchor === 'district' ? 'fixed hiding district' : 'fixed hiding station'}${err ? ' · ' + esc(err) : ''}</small></span><span class="question-reward">${q.draw} → ${q.keep}<small>hider reward</small></span>${icon('chevron', 16)}</button>`;
        })
        .join(
          '',
        )}</div><div class="panel-footnote">Distances are straight-line fictional kilometres. Thermometers compare your last completed station journey. Hiders prepare and send truthful replies; verified clues go into your notebook.</div>`,
      true,
    );
  if (u.panel === 'reaction') {
    const challenge = answerChallenge(s),
      q = challenge?.q;
    html = modal(
      'Question received',
      'TACTICAL PAUSE · EVERYONE IS FROZEN',
      `<div class="reaction-body answer-fieldkit"><h3>${esc(q?.title || 'Question waiting')}</h3>${challenge ? answerTool(s, u.answerPreparedKey === challenge.key, esc) : ''}<details class="answer-help" data-disclosure="answer-map"><summary>Check my field map</summary>${regionalMap(s, { ...u, selectedStation: s.committed ?? 0 })}<p>Your portrait marks your current location. This question refers to your committed district.</p></details>${s.hand.some((id) => CARDS[id].reaction) ? '<details><summary>Play a reaction instead</summary><div class="reaction-cards">' + s.hand.map((id, i) => (CARDS[id].reaction ? smallCard(CARDS[id], i) : '')).join('') + '</div></details>' : ''}</div>`,
      false,
      false,
    );
  }
  if (u.panel === 'card') {
    const index = u.selectedCard,
      c = CARDS[s.hand[index]];
    if (!c) {
      u.panel = null;
      set('overlay', '');
      return;
    }
    const err = cardLegal(s, index, u.extra, u.category);
    html = modal(
      c.title,
      `${c.type.toUpperCase()} ${c.slot ? '· ' + c.slot.toUpperCase() : c.reaction ? '· REACTION' : ''}`,
      `<div class="inspect-body"><img class="large-card-art" src="/art/cards/${c.id}.webp" alt="Original illustration for ${esc(c.title)}"/><div class="card-rules"><h3>${c.summary}</h3><p>${c.rules}</p><blockquote>“${c.flavor}”</blockquote>${c.id === 5 ? `<label>Category to disable<select id="fog-category">${CATEGORIES.map((c) => `<option ${c === u.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>` : ''}${c.cost ? `<div class="cost-picker"><b>Discard ${c.cost} additional card${c.cost === 1 ? '' : 's'}</b>${s.hand.map((id, i) => (i === index ? '' : `<button data-action="extra" data-index="${i}" class="${u.extra.includes(i) ? 'selected' : ''}">${u.extra.includes(i) ? '✓' : '○'} ${esc(CARDS[id].title)}</button>`)).join('')}</div>` : ''}<p class="legality">${err ? esc(err) : '✓ Ready to play. Costs are paid only after validation.'}</p><div class="button-row"><button data-action="play-card" class="primary-button" ${err ? 'disabled' : ''}>Play card ${icon('chevron', 15)}</button><button data-action="discard" data-index="${index}" class="text-button">Discard this card</button></div></div></div>`,
    );
  }
  if (u.panel === 'cards') {
    html = modal(
      u.libraryCard === null ? 'Card guide' : CARDS[u.libraryCard].title,
      'THE HIDER’S FIELD GUIDE',
      u.libraryCard === null
        ? `<div class="card-guide-intro">52 cards · 24 designs · 3 starting cards · 5-card hand limit. Keep at most two bonuses for up to +120 seconds. A movement curse and an investigation curse can coexist.</div><div class="card-library">${CARDS.map((c) => smallCard(c, c.id, 'library-card')).join('')}</div>`
        : `<div class="inspect-body"><img class="large-card-art" src="/art/cards/${u.libraryCard}.webp" alt=""/><div class="card-rules"><h3>${CARDS[u.libraryCard].summary}</h3><p>${CARDS[u.libraryCard].rules}</p><p>Additional discard cost: ${CARDS[u.libraryCard].cost}. ${CARDS[u.libraryCard].slot ? 'Uses the ' + CARDS[u.libraryCard].slot + ' slot.' : ''}</p><blockquote>“${CARDS[u.libraryCard].flavor}”</blockquote><button class="outline-button" data-action="library-back">Back to all cards</button></div></div>`,
      true,
    );
  }
  if (u.panel === 'reward') {
    const r = s.rewards[0];
    if (!r) {
      u.panel = null;
      set('overlay', '');
      return;
    }
    html = modal(
      'Choose your reward',
      'QUESTION REWARD · TACTICAL PAUSE',
      `<div class="reward-body"><p>Choose <b>${r.keep}</b> of these ${r.cards.length} cards. The rest go to the discard pile.</p><div class="reward-cards">${r.cards.map((id, i) => smallCard(CARDS[id], i, 'reward-pick', u.reward.includes(i))).join('')}</div><button data-action="keep-reward" class="primary-button" ${u.reward.length !== r.keep ? 'disabled' : ''}>Keep ${u.reward.length} / ${r.keep} selected</button></div>`,
      r.cards.length > 3 || s.settings.textScale > 1.1,
      false,
    );
  }
  if (u.panel === 'overflow')
    html = modal(
      'Hand limit',
      'HAND LIMIT · TACTICAL PAUSE',
      `<div class="reward-body"><p>Discard ${s.hand.length - s.handLimit} card${s.hand.length - s.handLimit === 1 ? '' : 's'} to reach your ${s.handLimit}-card limit.</p><div class="reward-cards">${s.hand.map((id, i) => smallCard(CARDS[id], i, 'overflow-discard')).join('')}</div></div>`,
      true,
      false,
    );
  if (u.panel === 'notebook') html = modal('Notebook', 'FIELD NOTEBOOK', notebook(s), true);
  if (u.panel === 'team') {
    const mate = s.actors.find((a) => a.id !== 0 && a.id !== s.hider);
    html = modal(
      mate ? `${NAMES[mate.id]} — Team commands` : 'Seeker radio',
      'TEAM RADIO',
      `<div class="team-body">${s.hider === 0 ? '<p>You are hiding alone this turn. Use question origins, sightings, and Where Are You Again? to learn about the seekers.</p>' : `<p>${NAMES[mate!.id]} shares verified clues and stays with your party. Current task: <b>${mate!.goal}</b>. Last reported district: <b>${esc(s.world.stations[mate!.station].name)}</b>.</p><div class="command-grid">${['Follow me', 'Search this area', 'Inspect this location', 'Meet at this station', 'Handle this curse', 'Suggest a plan'].map((c, i) => `<button data-action="command" data-value="${c}"><span>0${i + 1}</span><b>${c}</b>${icon('chevron', 16)}</button>`).join('')}</div><p class="muted">Search and inspect use this district. Meet uses the station selected below.</p><label>Meeting station<select id="meeting-station">${s.world.stations.map((st) => `<option value="${st.id}" ${st.id === u.selectedStation ? 'selected' : ''}>${esc(st.name)}</option>`).join('')}</select></label>`}</div>`,
    );
  }
  if (u.panel === 'settings') html = modal('Settings', '', settingsBody(s, u));
  if (u.panel === 'tools')
    html = `<section class="tool-drawer" role="dialog" aria-modal="true" aria-label="Field tools"><header><h2>Field tools</h2><button data-action="close" class="icon-button" aria-label="Close panel">${icon('close')}</button></header><p class="menu-match">Set ${s.set} · Turn ${(s.round % 3) + 1}/3 · ${NAMES.map((name, i) => esc(name) + ' ' + s.totals[i]).join(' / ')}</p><div>${[
      ['map', 'Map', 'M / Y'],
      ...(!s.hider ? [] : [['questions', 'Ask a question', 'Q']]),
      ['toggle-notebook', 'Notebook', 'N'],
      ['team', 'Party', 'T'],
      ['cards', 'Card guide', 'C'],
      ['tutorial', 'How to play', '?'],
      ['settings', 'Settings', ''],
      ['fullscreen', 'Fullscreen', ''],
      ['save', 'Save match', ''],
      ['speed', 'Clock speed · ' + s.speed + '×', ''],
      ['new-menu', 'Journey menu', ''],
    ]
      .map(
        ([action, label, key]) =>
          `<button data-action="${action}" aria-label="${label}"><span>${label}</span>${key ? `<kbd>${key}</kbd>` : ''}</button>`,
      )
      .join('')}</div><p>Paused · Esc / B to return</p></section>`;
  if (u.panel === 'credits')
    html = modal(
      'Made for the journey',
      'CREDITS',
      `<div class="credits-body"><h3>Last Stop · ${VERSION}</h3><p>An original single-player travel deduction adventure. Original town graphics, travelers, card illustrations, synthesized music and sound are provided under the project MIT license.</p><p>Phaser 4.2.1 · Richard Davey, Phaser Studio and contributors · MIT.<br/>EventEmitter3 · Arnout Kazemier and contributors · MIT.</p><p>Atkinson Hyperlegible Next, Pixelify Sans and Barlow Condensed · SIL Open Font License 1.1.</p><div class="button-row"><a href="./licenses/phaser-MIT.txt" target="_blank">Phaser license</a><a href="./fonts/Atkinson-OFL.txt" target="_blank">Atkinson license</a><a href="./fonts/Pixelify-OFL.txt" target="_blank">Pixelify license</a><a href="./fonts/Barlow-OFL.txt" target="_blank">Barlow license</a></div><p>Ollama is optional and runs separately on your computer. The game sends it limited NPC decisions when enabled; the game remains playable without it. No analytics or remote telemetry are sent by the game.</p><button data-action="support-report" class="outline-button">Export playtest / support report</button></div>`,
    );
  if (u.panel === 'puzzle') {
    const e = s.effects.find((e) => e.card === 2),
      symbols = ['△', '○', '◇', '☂'];
    html = modal(
      'Stamp the form',
      'DEPARTMENT OF FORMS · CLOCK CONTINUES',
      e
        ? `<div class="paperwork"><p>Match these stamps in order.</p><div class="stamp-sequence">${(e.puzzle || [0, 1, 2]).map((symbol, i) => `<span class="${(e.input?.length || 0) > i ? 'stamped' : ''}">${symbols[symbol]}</span>`).join('')}</div><div class="stamp-buttons">${symbols.map((symbol, i) => `<button data-action="stamp" data-index="${i}" aria-label="Stamp ${['triangle', 'circle', 'diamond', 'umbrella'][i]}">${symbol}</button>`).join('')}</div><p class="muted">${Math.max(0, Math.ceil(e.until - 20 - s.time))}s until you can submit · ${Math.ceil(e.until - s.time)}s until expiry</p><button data-action="solve-forms" class="primary-button" ${s.time < e.until - 20 || e.input?.length !== 3 ? 'disabled' : ''}>Submit stamped form</button></div>`
        : '<div class="reward-body"><p>Paperwork cleared. Your team can ask questions again.</p><button data-action="close" class="primary-button">Back to the streets</button></div>',
    );
  }
  if (u.panel === 'tutorial') html = modal('How to play', 'HOW TO PLAY', tutorial(u), false);
  if (u.panel === 'results')
    html = modal(
      s.coach?.completed
        ? 'Practice complete'
        : s.winner !== null
          ? `${NAMES[s.winner]} won the match.`
          : s.phase === 'finished'
            ? 'Practice complete'
            : 'Round results',
      s.winner !== null ? 'MATCH COMPLETE' : 'HIDING TURN RESULTS',
      results(s),
      !s.coach?.completed,
      false,
    );
  if (u.panel === 'replay')
    html = modal(
      'Round replay',
      'POST-ROUND REPLAY',
      `<div class="replay-body"><p>All roles are revealed after the turn. Use the timeline to review recorded locations, questions, cards, and journeys.</p>${regionalMap(s, u, true)}<label>Replay time <output>${clock(u.replayTime)}</output><input id="replay-time" type="range" min="${s.results.at(-1)?.events[0]?.time || s.phaseAt}" max="${s.time}" value="${u.replayTime}" step="1"/></label><div class="replay-events">${s.results
        .at(-1)
        ?.events.filter((e) => e.time <= u.replayTime && e.type !== 'position')
        .slice(-3)
        .map((e) => `<p><time>${clock(e.time)}</time> ${esc(e.text)}</p>`)
        .join('')}</div></div>`,
      true,
    );
  const focusedDisclosure =
    focused?.tagName === 'SUMMARY' ? (focused.parentElement as HTMLElement)?.dataset.disclosure : undefined;
  const compact = ['questions', 'notebook', 'team', 'puzzle'].includes(u.panel);
  const clockText = panelClockPaused(s, u.panel)
    ? 'Clock paused · everyone waits'
    : 'Clock running · close to move';
  html = html.replace(
    'class="modal-backdrop"',
    'class="modal-backdrop' + (compact ? ' compact-panel' : '') + '"',
  );
  html = html.replace('</h2>', '</h2><p class="panel-clock">' + clockText + '</p>');
  set('overlay', html);
  document.querySelectorAll<HTMLDetailsElement>('#overlay details[data-disclosure]').forEach((el) => {
    const key = el.dataset.disclosure!;
    if (key in u.disclosures) el.open = u.disclosures[key];
  });
  if (focusedDisclosure)
    document
      .querySelector<HTMLElement>(`[data-disclosure="${focusedDisclosure}"] > summary`)
      ?.focus({ preventScroll: true });
  renderedPanel = u.panel;
}
function regionalMap(s: State, u: UIState, replay = false) {
  const w = s.world,
    px = (x: number) => x * 6 + 16,
    py = (y: number) => y * 5.1 + 24;
  const a = s.actors[0];
  const actors: { id: number; station: number; time: number; x?: number; y?: number }[] = replay
    ? s.actors.map((a) => {
        const e = s.results
          .at(-1)
          ?.events.filter((e) => e.actor === a.id && e.station !== undefined && e.time <= u.replayTime)
          .at(-1);
        return { id: a.id, station: e?.station ?? s.start, time: e?.time || 0 };
      })
    : s.hider === 0
      ? [{ id: 0, station: a.station, time: s.time, ...regionalPosition(w, a, s.time) }, ...s.lastKnown]
      : s.actors
          .filter((a) => a.id !== s.hider)
          .map((a) => ({ id: a.id, station: a.station, time: s.time, ...regionalPosition(w, a, s.time) }));
  const features = w.landmarks
    .map(
      (l) =>
        `<g class="map-feature" transform="translate(${px(l.x)} ${py(l.y)})"><path d="M-4-4L0-10L4-4L0 2Z" fill="#8d9c6f" stroke="#f1edd5"/><text y="-15" text-anchor="middle">${esc(l.name)}</text></g>`,
    )
    .join('');
  const labels = stationLabels(w);
  const itinerary = !replay ? route(w, a.station, u.selectedStation, s.time) : [];
  const highlighted = (x: number, y: number) =>
    itinerary.some((leg) => (leg.from === x && leg.to === y) || (leg.from === y && leg.to === x));
  const lastClue = s.evidence.at(-1);
  return `<svg class="regional-map" viewBox="0 0 650 550" role="img" aria-label="Region map with stations, railway routes, candidates and known positions">${landscape(w)}<text x="39" y="532" class="map-region-title">THE ${esc(w.seed.split('-')[0].toUpperCase().slice(0, 14))} REGION</text>${features}${w.edges
    .map((e) => {
      const a = w.stations[e.a],
        b = w.stations[e.b];
      const bend = e.bend ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return `<path class="railway-route ${highlighted(e.a, e.b) ? 'selected-route' : ''}" d="M${px(a.x)} ${py(a.y)}Q${px(bend.x)} ${py(bend.y)} ${px(b.x)} ${py(b.y)}" fill="none" stroke="${LINE_COLORS[e.line]}" stroke-width="${highlighted(e.a, e.b) ? 5 : e.kind === 'express' ? 3 : 2}" ${e.kind === 'walk' || e.kind === 'ferry' ? 'stroke-dasharray="3 4"' : ''} opacity=".75"/>`;
    })
    .join('')}${w.stations
    .map((st) => {
      const possible = s.hider === 0 || replay || s.candidates.includes(st.id),
        selected = st.id === u.selectedStation;
      return `<g data-action="select-station" data-index="${st.id}" class="station-node ${possible ? '' : 'excluded'} ${lastClue?.excluded.includes(st.id) ? 'last-excluded' : ''}" tabindex="0" role="button" aria-label="${esc(st.name)}${possible ? '' : ', excluded'}"><image href="${districtMiniature(st)}" x="${px(st.x) - 18}" y="${py(st.y) - 27}" width="36" height="26" style="image-rendering:pixelated" aria-hidden="true"/><circle cx="${px(st.x)}" cy="${py(st.y)}" r="${selected ? 11 : 6}" fill="${selected ? '#d4ab64' : possible ? '#f8fbff' : '#ccd5e2'}" stroke="${selected ? '#142b50' : '#6f86a7'}" stroke-width="${selected ? 3 : 2}"/><circle cx="${px(st.x)}" cy="${py(st.y)}" r="18" fill="transparent"/>${!possible ? `<path d="M${px(st.x) - 3} ${py(st.y) - 3}l6 6m-6 0l6-6" stroke="#6b7f6c"/>` : ''}<text x="${labels.get(st.id)!.x}" y="${labels.get(st.id)!.y}" text-anchor="middle">${esc(st.name)}</text>${s.notes[st.id] ? `<text x="${px(st.x) + 9}" y="${py(st.y) - 7}">✎</text>` : ''}</g>`;
    })
    .join('')}${actors
    .map((a) => {
      const st = w.stations[a.station];
      return `<g transform="translate(${px(a.x ?? st.x) + (a.id === 0 ? -12 : 12 + a.id * 18)} ${py(a.y ?? st.y) - 20})"><title>${NAMES[a.id]} · ${clock(a.time)}${!replay && s.hider === 0 && a.id !== 0 ? ' last known' : ''}</title>${a.id === 0 ? `<rect class="player-marker-frame" x="-13" y="-23" width="26" height="34" rx="3" fill="#f8fbff" stroke="#675166" stroke-width="2"/><image class="player-map-marker" href="${avatarArt(s.appearance).portrait}" x="-12" y="-22" width="24" height="32" style="image-rendering:pixelated"/>` : `<circle r="8" fill="${['#c68148', '#528c87', '#a47597'][a.id]}" stroke="#f8f0d9" stroke-width="2"/><text y="3" text-anchor="middle" fill="#fff" style="font-size:8px;stroke:none">${a.id === 0 ? 'Y' : NAMES[a.id][0]}</text>`}</g>`;
    })
    .join(
      '',
    )}<g transform="translate(34 26)" fill="none" stroke="#6a7d63" stroke-width="2"><path d="M0 40V0m-5 9l5-9l5 9"/><text x="0" y="-7" text-anchor="middle" fill="#6a7d63" stroke="none" font-size="11">N</text></g></svg>`;
}
function stationDetail(s: State, u: UIState) {
  const st = s.world.stations[u.selectedStation],
    a = s.actors[0];
  const walk =
    pathfind(s.world.stations[a.station].local, a, s.world.stations[a.station].local.platform).length /
    s.rules.walkSpeed;
  const legs = route(s.world, a.station, st.id, s.time + walk),
    arrival = legs.at(-1)?.arrive;
  const late =
    s.phase === 'headstart' &&
    s.hider === 0 &&
    arrival !== undefined &&
    arrival >= s.phaseAt + s.rules.headStart;
  const exclusion = [...s.evidence].reverse().find((e) => e.excluded.includes(st.id));
  const excludedQuestion = exclusion && QUESTIONS.find((q) => q.title === exclusion.question);
  const reason =
    exclusion && excludedQuestion
      ? '<p class="map-exclusion-reason">Here the reply would be <b>' +
        esc(valueAt(s.world, excludedQuestion, exclusion.origin, exclusion.previous, st.id)) +
        '</b>. The hider replied <b>' +
        esc(exclusion.answer) +
        '</b> to “' +
        esc(exclusion.question) +
        '” from ' +
        esc(s.world.stations[exclusion.origin].name) +
        '.</p>'
      : '';
  return `<h3>${esc(st.name)}</h3><p>${KIND_NAMES[st.kind]}<br/>${esc(st.zone)} · ${LINE_NAMES[st.line]}</p><p class="district-scout">${esc(districtRead(st))}</p><div class="landmark-note">${icon('flag', 19)}<span>${esc(st.landmark)}</span></div>${s.hider !== 0 ? `<div class="candidate-status">${s.candidates.includes(st.id) ? '◇ Still possible' : '× Proven exclusion'}</div>${reason}` : ''}${a.station === st.id ? '<p class="here-note">● You are here. Walk around the district to explore.</p>' : `<div class="journey-preview"><p>Walk to platform: ${Math.ceil(walk)}s</p>${legs.map((l) => `<div class="leg"><i style="background:${LINE_COLORS[l.line]}"></i><span><b>${esc(s.world.stations[l.to].name)}</b><small>${LINE_NAMES[l.line]} · departs ${clock(l.depart)}<br/>arrives ${clock(l.arrive)}${serviceNote(l) ? '<br/>' + esc(serviceNote(l)) : ''}</small></span></div>`).join('')}<p><b>${arrival === undefined ? 'No service' : Math.ceil(arrival - s.time) + 's total · ' + Math.max(0, legs.length - 1) + ' transfers'}</b></p>${late ? '<p class="warning">Arrives after the hiding deadline.</p>' : ''}<button data-action="travel" class="primary-button full" ${late || (s.phase === 'search' && s.hider === 0) || a.journey.length ? 'disabled' : ''}>Walk to platform & travel ${icon('chevron', 15)}</button></div>`}<label class="annotation-label">Personal annotation<textarea id="annotation" placeholder="A hunch, a landmark, a reminder…" maxlength="240">${esc(s.notes[st.id] || '')}</textarea></label><p class="fine muted">Selecting a station plans a route. Travel always uses the platform and scheduled services.</p>`;
}
const photos = new Map<string, string>();
function notebook(s: State) {
  return `<div class="notebook-body"><div class="evidence-summary"><div><b>${s.candidates.length}</b><span>candidate districts</span></div><div><b>${s.world.stations.length - s.candidates.length}</b><span>proven exclusions</span></div><div><b>${s.evidence.length}</b><span>verified answers</span></div></div><h3>Verified observations</h3>${
    s.evidence.length
      ? s.evidence
          .map((e) => {
            let photo = '';
            if (e.photo) {
              const key = s.world.seed + JSON.stringify(e.photo);
              if (!photos.has(key))
                photos.set(
                  key,
                  photoData(s.world.stations[e.photo.station], e.photo.x, e.photo.y, e.photo.subject),
                );
              photo = `<figure class="postcard"><img src="${photos.get(key)}" alt="In-game surroundings supplied as a visual clue"/><figcaption>FIELD POSTCARD · ${clock(e.time)}${e.stale ? ' · POSITION MAY BE STALE' : ''}</figcaption></figure>`;
            }
            return `<article class="evidence"><time>${clock(e.time)} · ${e.category} · ${e.anchor} anchor</time><h4>${esc(e.question)}</h4><p class="clue-anchor">Asked from <b>${esc(s.world.stations[e.origin].name)}</b>${e.category === 'Thermometer' ? ` · Journey: ${esc(s.world.stations[e.previous].name)} → ${esc(s.world.stations[e.origin].name)}` : ''}</p><p><b>${esc(e.answer)}</b> · ${e.excluded.length} inconsistent districts excluded.</p>${
              e.excluded.length
                ? `<details class="clue-explanation"><summary>Why were these districts excluded?</summary>${e.excluded
                    .map((id) => {
                      const q = QUESTIONS.find((q) => q.title === e.question);
                      return `<p><b>${esc(s.world.stations[id].name)}</b>${q ? ` would answer “${esc(valueAt(s.world, q, e.origin, e.previous, id))}”` : ' is inconsistent with the observation'}, which differs from “${esc(e.answer)}”.</p>`;
                    })
                    .join('')}</details>`
                : ''
            }${photo}${e.stale ? '<span class="warning">The hider relocated. This exact-position evidence may be stale.</span>' : ''}</article>`;
          })
          .reverse()
          .join('')
      : '<p class="muted">No measured answers yet. Open Questions when the search begins.</p>'
  }<h3>Proven exclusions</h3><p class="muted">${
    s.world.stations
      .filter((st) => !s.candidates.includes(st.id))
      .map((st) => esc(st.name))
      .join(' · ') || 'None yet. A guess is not a verified observation.'
  }</p><h3>Personal theories & annotations</h3>${
    Object.entries(s.notes)
      .filter(([, v]) => v)
      .map(([id, note]) => `<p><b>${esc(s.world.stations[Number(id)].name)}</b> · ${esc(note)}</p>`)
      .join('') ||
    '<p class="muted">Select a station on the map to write a personal theory. Notes never eliminate candidates automatically.</p>'
  }<h3>Timestamped travel diary</h3><div class="diary">${s.events
    .filter((e) => e.time >= s.phaseAt && visibleEvent(s, e))
    .filter((e) => e.type !== 'position')
    .slice(-35)
    .reverse()
    .map((e) => `<p><time>${clock(e.time)}</time> ${esc(e.text)}</p>`)
    .join('')}</div></div>`;
}
const lessons = [
  [
    'Two roles. One familiar region.',
    'You, Mira, and Kit each take a hiding turn. The two seekers cooperate. The region stays the same, so your wrong turns become useful memories.',
    'After three turns, rank survival plus retained bonuses: 3 points for first, 1 for second. Quick journeys finish after a set with a unique leader. Classic plays to 6 points.',
  ],
  [
    'Make a real getaway.',
    'Start your 120-second head start. Open the map, select a station, and choose Walk to platform & travel. Your character walks to the platform and waits for a scheduled service.',
    'After disembarking beyond the starting station, commit to your district. Arrive and commit before the deadline. Travel previews flag late arrivals.',
  ],
  [
    'Questions buy clues. And trouble.',
    'As a seeker, use six categories of truthful questions to narrow the candidate districts. A thermometer requires a completed journey. Photographs show actual town information.',
    'Every answer rewards the hider with cards. Questions share one team cooldown. Read verified exclusions in the notebook; keep your own theories on the map.',
  ],
  [
    'Pack a small inconvenience.',
    'Orange cards curse the seekers, blue cards offer tools, and purple cards add score only if retained. Some cards cost an additional discard.',
    'Pending questions and reward choices freeze everyone. Select costs before playing. A curse task is marked in the local world and can be completed by either seeker.',
  ],
  [
    'The last street is on foot.',
    'Hold Shift or the right trigger to sprint. In a bush, hedge, or behind a crate, press H / controller X to hide. Moving breaks cover; close inspection reveals you.',
    'Choose cover as seekers approach. You can keep moving within your district, break sightlines and hide again. Seekers can inspect cover and press E to tag within clear reach. Walls and crates block sight; running is easier to spot.',
  ],
];
function tutorial(u: UIState) {
  const l = lessons[u.tutorialPage];
  return `<div class="tutorial-body"><div class="tutorial-route">${lessons.map((_, i) => `<span class="${i <= u.tutorialPage ? 'visited' : ''}">${i + 1}</span>`).join('<i></i>')}</div><h3>${l[0]}</h3><p>${l[1]}</p><p>${l[2]}</p><div class="button-row"><button data-action="tutorial-prev" class="outline-button" ${u.tutorialPage === 0 ? 'disabled' : ''}>Previous</button><button data-action="${u.tutorialPage === 4 ? 'close' : 'tutorial-next'}" class="primary-button">${u.tutorialPage === 4 ? 'Let’s play' : 'Next stop'} →</button></div></div>`;
}
function results(s: State) {
  if (s.coach?.completed)
    return `<div class="results-body"><h3>Your first ticket is stamped.</h3><p>You traveled, committed a district, hid, played a card, interpreted evidence and tagged the hider. In a real journey both seekers stay active, questions reward the hider, and the clock adds pressure.</p><p>${s.coach.assisted ? 'Practice hints helped you learn the route. Normal matches keep the hiding district secret.' : 'You completed the introduction without requesting a practice hint.'}</p><div class="button-row"><button class="primary-button" data-action="new-menu">Start a real journey</button><button class="outline-button" data-action="notebook">Review your clues</button></div></div>`;
  const r = s.results.at(-1);
  if (!r)
    return '<div class="reward-body"><p>No completed turns yet.</p><button data-action="close" class="primary-button">Back to the region</button></div>';
  return `<div class="results-body"><div class="result-ticket">${r.hider === 0 && r.reason.startsWith('Tagged') ? `<img class="result-pose" src="${avatarArt(s.appearance).caught}" alt="Your traveler, caught with hands raised"/>` : ''}<div><h3>${clock(r.survival)} <small>survived · +${r.bonus}s bonus</small></h3><p class="result-location">${NAMES[r.hider]} hid in ${esc(s.world.stations[r.district].name)}</p><p>${esc(r.reason)}${r.forfeit ? ' · Forfeit: zero score and placement points.' : ''}</p></div><div class="total-score"><span>HIDING SCORE</span><strong>${clock(r.score)}</strong></div></div>${r.events.some((e) => e.type === 'capture') ? `<p class="capture-explanation">${esc(r.events.filter((e) => e.type === 'capture').at(-1)!.text)}</p>` : ''}<table class="scoreboard"><thead><tr><th>Traveler</th><th>Survival</th><th>Bonus</th><th>This set</th><th>Match points</th></tr></thead><tbody>${NAMES.map(
    (n, i) => {
      const rr = s.roundScores.find((r) => r.hider === i);
      return `<tr><th>${i === 0 ? `<img class="score-portrait player-portrait" src="${avatarArt(s.appearance).portrait}" alt="Your traveler"/>` : `<span class="player-dot p${i}"></span>`}${n}</th><td>${rr ? clock(rr.survival) : '—'}</td><td>${rr ? '+' + rr.bonus + 's' : '—'}</td><td>${rr ? clock(rr.score) : 'Yet to hide'}</td><td><b>${s.totals[i]}</b> / ${s.rules.targetPoints ?? 6}</td></tr>`;
    },
  ).join(
    '',
  )}</tbody></table>${s.roundScores.length === 3 ? '<p class="set-award">Set complete · placement points awarded.</p>' : ''}<details class="scoring-detail"><summary>How points work</summary><p>After everyone has hidden, first place earns 3 points and second earns 1. Exact score ties use unbonused survival, then share placement points.</p></details><div class="button-row"><button data-action="${s.phase === 'finished' || s.winner !== null ? 'new-menu' : 'next'}" class="primary-button">${s.phase === 'finished' || s.winner !== null ? 'Plan another adventure' : s.mode !== 'match' ? 'Finish practice' : s.round % 3 === 2 ? 'Next set' : 'Next hiding turn'} ${icon('chevron', 16)}</button><button data-action="replay" class="outline-button">Review the journey</button><button data-action="save" class="text-button">Save match</button></div></div>`;
}
