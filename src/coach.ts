import type { State } from './types';
import { newGame, startRound, tick } from './simulation';
import { route } from './world';
import { configureSession } from './session';
export function createCoach(seed = 'first-ticket', seeking = false): State {
  const s = newGame(seed, 20, seeking ? 'seeker' : 'tutorial');
  configureSession(s, 'quick', 'relaxed');
  s.rules.searchCap = 900;
  startRound(s);
  if (seeking) {
    s.cardReady = 1e9;
    s.actors[0].nextThink = s.actors[2].nextThink = 1e9;
    s.rules.questionCooldown = 2;
    tick(s, 120.05);
    s.mode = 'tutorial';
  } else {
    s.rules.headStart = 3600;
    s.deck.push(...s.hand);
    s.hand = [];
    for (const id of [0, 20, 21]) s.hand.push(...s.deck.splice(s.deck.indexOf(id), 1));
  }
  s.actors.forEach((a) => (a.nextThink = 1e9));
  s.cardReady = seeking ? 1e9 : 0;
  const target = seeking
    ? s.committed!
    : [...s.world.stations]
        .filter((st) => st.id !== s.start)
        .sort(
          (a, b) =>
            (route(s.world, s.start, a.id, s.time).at(-1)?.arrive ?? 1e9) -
            (route(s.world, s.start, b.id, s.time).at(-1)?.arrive ?? 1e9),
        )[0].id;
  s.coach = {
    step: seeking ? 5 : 0,
    origin: { x: s.actors[0].x, y: s.actors[0].y },
    target,
    completed: false,
  };
  return s;
}
export function advanceCoach(s: State) {
  const c = s.coach;
  if (!c || c.completed) return;
  const a = s.actors[0];
  if (c.step === 0 && Math.hypot(a.x - c.origin.x, a.y - c.origin.y) >= 2) c.step = 1;
  if (c.step === 1 && a.station !== s.start && !a.journey.length) c.step = 2;
  if (c.step === 2 && s.committed !== null) c.step = 3;
  if (c.step === 3 && a.hiding) {
    c.step = 4;
    s.phase = 'search';
    s.searchAt = s.time;
    s.rules.headStart = 120;
  }
  if (c.step === 4 && s.events.some((e) => e.type === 'card')) c.usedCard = true;
  if (c.step === 5 && s.evidence.length) c.step = 6;
  if (c.step === 7 && a.station !== s.start && !a.journey.length) c.step = 8;
  if (c.step >= 5 && s.phase === 'results' && s.results.at(-1)?.reason === 'Tagged by You') {
    c.step = 9;
    c.completed = true;
  }
}
export function coachMarkup(s: State) {
  const c = s.coach;
  if (!c || c.completed) return '';
  const steps = [
    ['Your first steps', 'Walk a few paces with WASD, arrows, the stick, or a click on the ground.'],
    [
      'Catch your first train',
      'Open Map, choose another district, then Walk to platform & travel. There is no hurry in practice.',
    ],
    [
      'Make this district yours',
      'Choose Commit here. This fixes your district for this hiding turn; you can still move around it.',
    ],
    [
      'Disappear into the scenery',
      'Walk beside a bush, tree, wall or solid object. Press H / controller X, or the Hide button.',
    ],
    [
      'Buy yourself some time',
      'Open Tourist Trap in your hand and play it. Curses give the seekers an errand. Bonuses stay in your hand to score.',
    ],
    [
      'Now you are seeking',
      'Your companion follows you. Open Ask and send one available question. Answers are truthful and reward the hider with cards.',
    ],
    [
      'Follow the evidence',
      'Open Notes. Read the answer, the station it was asked from, and the list of excluded districts. A personal guess never excludes a district.',
    ],
    [
      'Put a theory to the test',
      'Use the clues to choose a remaining district on Map and travel there together. Ask more questions whenever you need them.',
    ],
    [
      'Finish the search on foot',
      'Explore the district and inspect cover. Press E / controller A close to the hider to tag. If this district is empty, compare more clues.',
    ],
    [
      'You know the route',
      'You traveled, hid, used a card, interpreted a clue and completed a search. A normal journey adds time pressure and active opponents.',
    ],
  ];
  const [title, copy] = steps[c.step];
  return `<section class="coach-panel" aria-label="Playable introduction"><h3>${title}</h3><p>${copy}</p><small class="coach-progress">Practice · ${Math.min(9, c.step + 1)} of 9</small><div class="button-row">${c.step === 4 ? `<button class="primary-button" data-action="coach-seek" ${c.usedCard ? '' : 'disabled'}>Try seeking →</button>` : ''}${c.step === 6 ? '<button class="outline-button" data-action="notebook">Read the clue</button>' : ''}${c.step === 1 || c.step === 3 || c.step === 7 || c.step === 8 ? '<button class="outline-button" data-action="coach-hint">Show a practice hint</button>' : ''}${c.completed ? '<button class="primary-button" data-action="new-menu">Start a real journey</button>' : '<button class="text-button" data-action="new-menu">Leave practice</button>'}</div></section>`;
}
