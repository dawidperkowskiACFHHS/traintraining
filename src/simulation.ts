import type { State, Rules, Actor, Point, Category, Event, RoundResult, Effect } from './types';
import { hash, pick, random, shuffle, distance } from './random';
import { generateWorld, route } from './world';
import {
  pathfind,
  walkable,
  lineOfSight,
  insideBuilding,
  coverAt,
  canSeeActor,
  inspectionPoints,
  SPRINT_MULTIPLIER,
} from './local';
import { canTag, stealthState } from './stealth';
import { CARDS, DECK, cardLegal, curseTarget, bonusScore } from './cards';
import { QUESTIONS, questionLegal, resolveEvidence, questionKey } from './questions';
import { seekerPlan, SeekerView } from './ai';
import { inTransit, regionalPosition } from './transit';
import balance from './content/balance.json' with { type: 'json' };
import { DEFAULT_APPEARANCE, normalizeAppearance, type Appearance } from './appearance';
import { takeNpcAdvice } from './npc-advice';
import { nearbyResident, residentLine, updateResidents } from './residents';
import { validateSave } from './save-validation';
import { answerChallenge } from './answer-challenge';
import { serviceStop } from './service-conditions';
import { publishGameEvent } from './game-events';
export const RULES: Rules = balance.rules;
export const NAMES = balance.personalities.map((p) => p.name);
const sightAlerts = new WeakMap<State, { seen: boolean; at: number }>();
export function newGame(seed = 'little-detour', size = 30, mode: State['mode'] = 'match'): State {
  const world = generateWorld(seed, size),
    s: State = {
      questionOrder: [],
      appearance: { ...DEFAULT_APPEARANCE },
      version: 1,
      world,
      rng: hash(seed + ':match'),
      rules: { ...RULES },
      mode,
      phase: 'preparation',
      time: 0,
      phaseAt: 0,
      searchAt: 0,
      localAt: null,
      hider: mode === 'seeker' ? 1 : 0,
      round: 0,
      set: 1,
      start: 0,
      order: mode === 'seeker' ? [1, 2, 0] : [0, 1, 2],
      actors: [],
      committed: null,
      hideSpot: null,
      locked: false,
      relocating: false,
      escapeUsed: false,
      hand: [],
      deck: [],
      discard: [],
      handLimit: 5,
      effects: [],
      cleared: [],
      cardReady: 0,
      questionReady: 0,
      pending: null,
      rewards: [],
      doubleDip: false,
      activeTools: [],
      revealUntil: 0,
      lastKnown: [],
      candidates: world.stations.map((s) => s.id),
      evidence: [],
      blocked: {},
      usedQuestions: [],
      teamCommand: 'Suggest a plan',
      teamTarget: 0,
      teamPoint: null,
      totals: [0, 0, 0],
      results: [],
      roundScores: [],
      events: [],
      notes: {},
      paused: false,
      speed: 1,
      message: '',
      winner: null,
      autoHuman: false,
      settings: {
        autoQuestions: false,
        textScale: 1,
        reducedMotion: false,
        panelPause: true,
        simplified: false,
        sound: true,
        bindings: {
          up: 'KeyW',
          down: 'KeyS',
          left: 'KeyA',
          right: 'KeyD',
          interact: 'KeyE',
          map: 'KeyM',
          pause: 'Space',
          sprint: 'ShiftLeft',
          hide: 'KeyH',
        },
      },
    };
  setupRound(s);
  return s;
}
function setupRound(s: State) {
  sightAlerts.delete(s);
  s.questionSuggestion = null;
  s.questionOrder = shuffle(
    { rng: hash(`${s.world.seed}:${s.round}:questions`) },
    QUESTIONS.map((question) => question.id),
  );
  s.events = [];
  s.hider = s.order[s.round % 3];
  s.phase = 'preparation';
  s.phaseAt = s.time;
  s.searchAt = 0;
  s.localAt = null;
  s.committed = null;
  s.hideSpot = null;
  s.locked = false;
  s.relocating = false;
  s.escapeUsed = false;
  s.actors = [0, 1, 2].map((id) => ({
    smokeUntil: 0,
    followAt: 0,
    hiding: false,
    sprinting: false,
    id,
    station: s.start,
    previous: s.start,
    ...s.world.stations[s.start].local.platform,
    x: s.world.stations[s.start].local.platform.x + (id === 0 ? 0 : id === 1 ? -1.5 : 1.5),
    dir: 2,
    path: [],
    destination: null,
    journey: [],
    goal: 'ready',
    target: null,
    spot: 0,
    visited: [],
    searched: [],
    nextThink: s.time,
    inside: null,
    memory: s.actors[id]?.memory || [],
  }));
  s.deck = shuffle(s, DECK);
  s.discard = [];
  s.hand = [];
  s.handLimit = 5;
  s.effects = [];
  s.cleared = [];
  s.cardReady = s.time;
  s.questionReady = s.time;
  s.pending = null;
  s.rewards = [];
  s.doubleDip = false;
  s.activeTools = [];
  s.revealUntil = 0;
  s.lastKnown = [];
  s.candidates = s.world.stations.map((s) => s.id);
  s.evidence = [];
  s.blocked = {};
  s.usedQuestions = [];
  s.teamCommand = 'Suggest a plan';
  s.teamTarget = s.start;
  s.teamPoint = null;
  s.speed = 1;
  s.paused = false;
  draw(s, 3);
  s.message =
    s.hider === 0
      ? 'Walk to the station sign, choose a service, and commit to a district before the head start ends.'
      : `${NAMES[s.hider]} hides next. Your teammate is ${NAMES[3 - s.hider]}. Use questions, travel, and search together.`;
}
export function visibleEvent(s: State, e: Event) {
  if (e.type === 'position' || e.type === 'local') return false;
  if (e.actor === undefined || e.actor === 0 || s.phase === 'results' || s.phase === 'finished') return true;
  if (e.visibleToHuman !== undefined) return e.visibleToHuman;
  if (e.actor === s.hider) return false;
  if (s.hider !== 0) return true;
  if (s.time - e.time > 0.15) return false;
  const a = s.actors[e.actor],
    h = s.actors[0];
  return (
    s.revealUntil > s.time ||
    (a.station === h.station && distance(a, h) < 7 && lineOfSight(s.world.stations[h.station].local, a, h))
  );
}
export function log(s: State, type: string, text: string, actor?: number) {
  const e: Event = { time: s.time, type, text, actor };
  if (actor !== undefined) {
    const a = s.actors[actor];
    e.station = a.station;
    e.x = a.x;
    e.y = a.y;
  }
  e.visibleToHuman = visibleEvent(s, e);
  s.events.push(e);
  if (visibleEvent(s, e)) s.message = text;
  publishGameEvent(s, e);
  return e;
}
export function startRound(s: State) {
  if (s.phase !== 'preparation') return;
  s.phase = 'headstart';
  s.phaseAt = s.time;
  log(s, 'phase', `${NAMES[s.hider]} has ${s.rules.headStart} seconds to find a district.`);
  if (s.hider !== 0 || s.autoHuman) planHiding(s);
}
function planHiding(s: State) {
  const a = s.actors[s.hider],
    now = s.time;
  const options = s.world.stations
    .filter((st) => st.id !== s.start)
    .map((st) => ({
      id: st.id,
      arrival: route(s.world, s.start, st.id, now + 1).at(-1)?.arrive || Infinity,
      quality:
        st.local.spots.length +
        s.world.stations.filter((other) => other.kind === st.kind).length *
          balance.personalities[a.id].ambiguity +
        ((route(s.world, s.start, st.id, now + 1).at(-1)?.arrive || now) - now) *
          balance.personalities[a.id].travelAppetite +
        random(s) * balance.personalities[a.id].variation -
        (s.results
          .filter((r) => r.hider === a.id)
          .slice(-2)
          .some((r) => r.district === st.id)
          ? 3
          : 0),
    }))
    .filter((o) => o.arrival < now + s.rules.headStart - 20);
  options.sort((a, b) => b.quality - a.quality);
  const advice = takeNpcAdvice(s, a.id);
  const proposed = advice?.plan;
  const advisedTarget =
    proposed?.kind === 'travel' && options.some((option) => option.id === proposed.target)
      ? proposed.target
      : undefined;
  a.target = advisedTarget ?? options[0]?.id ?? (s.start + 1) % s.world.stations.length;
  a.goal = 'hiding';
  travel(s, a.id, a.target);
}
export function canMove(s: State, id: number) {
  return (
    (s.phase === 'search' || s.phase === 'headstart') &&
    !inTransit(s.actors[id], s.time) &&
    !(id !== s.hider && s.effects.some((e) => e.card === 7))
  );
}
export function walkTo(s: State, id: number, p: Point): boolean {
  if (id === s.hider && s.relocating) return false;
  if (!canMove(s, id)) return false;
  const a = s.actors[id],
    t = s.world.stations[a.station].local;
  const path = pathfind(t, a, p);
  if (!path.length) return false;
  if (id === 0 && (a.journey.length || a.destination !== null)) cancelTravel(s);
  a.hiding = false;
  a.journey = [];
  a.path = path;
  if (id === 0) a.destination = null;
  return true;
}
export function move(s: State, id: number, dx: number, dy: number, dt: number, sprint = false) {
  if (id === s.hider && s.relocating) return;
  if (!canMove(s, id) || s.paused || (s.pending && s.hider === 0) || (s.rewards.length && s.hider === 0))
    return;
  const a = s.actors[id];
  if (id === 0 && (a.journey.length || a.destination !== null)) cancelTravel(s);
  a.sprinting = sprint;
  a.path = [];
  a.journey = [];
  a.destination = null;
  moveActor(s, a, dx, dy, dt, Math.min(1, Math.hypot(dx, dy)));
}
function turnLegal(s: State, a: Actor, dir: number): boolean {
  if (a.id === s.hider || !s.effects.some((e) => e.card === 4) || dir === a.dir) return true;
  const t = s.world.stations[a.station].local;
  const turns = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ],
    center = { x: Math.floor(a.x) + 0.5, y: Math.floor(a.y) + 0.5 };
  const options = turns
    .map(([x, y], d) => ({ d, ok: walkable(t, center.x + x, center.y + y) }))
    .filter((o) => o.ok);
  const junction = options.length >= 3;
  if (!junction) return true;
  const delta = (dir - a.dir + 4) % 4;
  if (delta === 1 || delta === 0) return true;
  return options.every((o) => o.d === (a.dir + 2) % 4);
}
function moveActor(s: State, a: Actor, dx: number, dy: number, dt: number, strength = 1) {
  const len = Math.hypot(dx, dy);
  if (!len) return;
  dx /= len;
  dy /= len;
  const t = s.world.stations[a.station].local,
    dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : dy > 0 ? 2 : 0;
  if (!turnLegal(s, a, dir)) return;
  a.dir = dir;
  const speed =
      (a.id === s.hider ? 1 : (s.rules.seekerSpeed ?? 1)) *
      s.rules.walkSpeed *
      (a.sprinting ? SPRINT_MULTIPLIER : 1) *
      (a.smokeUntil > s.time ? 1.25 : 1) *
      strength *
      dt,
    nx = a.x + dx * speed,
    ny = a.y + dy * speed,
    r = 0.19;
  const allowed = (x: number, y: number) =>
    [
      [x - r, y - r],
      [x + r, y - r],
      [x - r, y + r],
      [x + r, y + r],
    ].every(([px, py]) => walkable(t, px, py));
  const before = { x: a.x, y: a.y };
  if (allowed(nx, a.y)) a.x = nx;
  if (allowed(a.x, ny)) a.y = ny;
  if (distance(before, a) > 0.00001) a.hiding = false;
  if (a.id === 0 && distance(before, a) > 0.00001) {
    const key = `${s.autoHuman ? 'auto' : 'human'}-${s.phase}-${s.hider === 0 ? 'hider' : 'seeker'}`;
    const metrics = (s.movementMetrics ??= {});
    const sample = (metrics[key] ??= { movingSeconds: 0, sprintSeconds: 0, distance: 0 });
    sample.movingSeconds += dt;
    sample.sprintSeconds += a.sprinting ? dt : 0;
    sample.distance += distance(before, a);
  }
  a.inside = insideBuilding(t, a);
}
export function travel(s: State, id: number, target: number, withParty = true): string | null {
  const a = s.actors[id];
  if (!['headstart', 'search'].includes(s.phase)) return 'Start the turn first.';
  if (s.phase === 'headstart' && id !== s.hider) return 'Seekers wait during the head start.';
  if (id === s.hider && s.phase === 'search') return 'Your hiding district is fixed.';
  if (a.journey.length) return 'Finish your current journey first.';
  if (target === a.station) return 'You are already here.';
  if (id !== s.hider && s.effects.some((e) => [7, 8, 9, 11].includes(e.card)))
    return 'Clear the movement restriction before boarding.';
  const path = route(
    s.world,
    a.station,
    target,
    s.time +
      pathfind(s.world.stations[a.station].local, a, s.world.stations[a.station].local.platform).length /
        s.rules.walkSpeed,
  );
  if (!path.length) return 'No service reaches that station.';
  if (id !== s.hider && s.effects.some((e) => e.card === 3) && ['local', 'express'].includes(path[0].kind))
    return 'Wrong Platform blocks train boarding.';
  if (id === s.hider && s.phase === 'headstart' && path.at(-1)!.arrive >= s.phaseAt + s.rules.headStart)
    return 'That journey leaves no time to commit before the hiding deadline.';
  a.destination = target;
  a.hiding = false;
  a.sprinting = false;
  a.path = pathfind(s.world.stations[a.station].local, a, s.world.stations[a.station].local.platform);
  a.goal = 'boarding';
  if (id === s.hider) s.committed = null;
  if (id === 0) log(s, 'route', `Walking to the platform for ${s.world.stations[target].name}.`, id);
  if (withParty && id !== s.hider) {
    const mate = s.actors.find((actor) => actor.id !== id && actor.id !== s.hider)!;
    if (mate.station === a.station && !mate.journey.length) travel(s, mate.id, target, false);
  }
  return null;
}
export function commit(s: State, id = 0): string | null {
  const a = s.actors[id];
  if (id !== s.hider || s.phase !== 'headstart') return 'Commit during your head start.';
  if (a.journey.length || a.destination !== null) return 'Disembark before committing.';
  if (a.station === s.start) return 'Choose a district beyond the starting station.';
  s.committed = a.station;
  a.goal = 'conceal';
  log(
    s,
    'commit',
    id === 0
      ? `${s.world.stations[a.station].name} is your hiding district. Explore before search begins.`
      : 'The hider has committed to a district.',
    id === 0 ? id : undefined,
  );
  return null;
}
function board(s: State, a: Actor) {
  if (a.destination === null || a.path.length || a.journey.length) return;
  const platform = s.world.stations[a.station].local.platform;
  if (distance(a, platform) > 0.7) {
    a.path = pathfind(s.world.stations[a.station].local, a, platform);
    return;
  }
  const target = a.destination;
  const mate =
    a.id !== s.hider ? s.actors.find((actor) => actor.id !== a.id && actor.id !== s.hider) : undefined;
  // Imported older matches may start with the seekers in different districts.
  const regroup = mate && a.id > mate.id && mate.station !== a.station && target === mate.station;
  if (mate && !regroup) {
    const leader = s.actors.find((actor) => actor.id !== s.hider)!;
    if (a.id !== leader.id) return;
    if (
      mate.station !== a.station ||
      mate.journey.length ||
      mate.destination !== target ||
      mate.path.length ||
      distance(mate, platform) > 0.7
    )
      return;
  }
  const legs = route(s.world, a.station, target, s.time);
  if (!legs.length) {
    a.destination = null;
    return;
  }
  if (travelRestriction(s, a, legs[0].kind)) return;
  a.journey = legs;
  a.goal = 'transit';
  a.destination = null;
  log(s, 'board', `${NAMES[a.id]} joined a ${legs[0].kind} service.`, a.id);
  if (mate && !regroup) {
    mate.path = [];
    mate.journey = structuredClone(legs);
    mate.goal = 'transit';
    mate.destination = null;
    spreadCompanion(s, mate);
    log(s, 'board', `${NAMES[mate.id]} boarded with ${NAMES[a.id]}.`, mate.id);
  }
}
function spreadCompanion(s: State, a: Actor) {
  if (a.id === s.hider || a.id === s.actors.find((actor) => actor.id !== s.hider)!.id) return;
  const town = s.world.stations[a.station].local;
  const offset = [
    [1.7, 1],
    [-1.7, 1],
    [0, 1.7],
    [0, -1.7],
  ].find(([dx, dy]) => {
    const point = { x: a.x + dx, y: a.y + dy };
    return walkable(town, point.x, point.y) && lineOfSight(town, a, point);
  });
  if (offset) {
    a.x += offset[0];
    a.y += offset[1];
  }
}
function travelRestriction(s: State, a: Actor, kind: string) {
  return (
    a.id !== s.hider &&
    s.effects.some(
      (e) => [7, 8, 9, 11].includes(e.card) || (e.card === 3 && ['local', 'express'].includes(kind)),
    )
  );
}
export function ask(s: State, id: string, actor = 0): string | null {
  const error = questionLegal(s, id, actor);
  if (error) return error;
  const a = s.actors[actor];
  s.questionSuggestion = null;
  s.pending = { id, origin: a.station, previous: a.previous, askedBy: actor, changed: false };
  s.lastKnown = s.lastKnown.filter((k) => k.id !== actor);
  s.lastKnown.push({ id: actor, station: a.station, time: s.time });
  s.speed = 1;
  log(s, 'question', `${NAMES[actor]} asks: ${QUESTIONS.find((q) => q.id === id)!.title}`);
  return null;
}
function draw(s: State, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!s.deck.length) {
      s.deck = shuffle(s, s.discard);
      s.discard = [];
    }
    const c = s.deck.pop();
    if (c !== undefined) out.push(c);
  }
  s.hand.push(...out);
  return out;
}
function reward(s: State, n: number, keep: number) {
  const before = s.hand.length;
  const cards = draw(s, n);
  s.hand.splice(before);
  if (!cards.length) return;
  s.rewards.push({ cards, keep: Math.min(keep, cards.length) });
}
export function chooseReward(s: State, indices: number[]): boolean {
  const r = s.rewards[0];
  if (
    !r ||
    indices.length !== r.keep ||
    new Set(indices).size !== r.keep ||
    indices.some((i) => i < 0 || i >= r.cards.length)
  )
    return false;
  r.cards.forEach((c, i) => (indices.includes(i) ? s.hand : s.discard).push(c));
  s.rewards.shift();
  return true;
}
export function discardCard(s: State, index: number) {
  if (index < 0 || index >= s.hand.length) return;
  s.discard.push(...s.hand.splice(index, 1));
}
function automaticHand(s: State) {
  while (s.rewards.length) {
    const r = s.rewards[0];
    const indices = r.cards
      .map((id, i) => ({ i, value: CARDS[id].type === 'bonus' ? 4 : CARDS[id].cost === 0 ? 3 : 2 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, r.keep)
      .map((x) => x.i);
    chooseReward(s, indices);
  }
  while (s.hand.length > s.handLimit) {
    const i = s.hand.findIndex((id) => CARDS[id].type !== 'bonus');
    discardCard(s, i < 0 ? 0 : i);
  }
}
export function answer(s: State) {
  if (!s.pending) return;
  const p = s.pending,
    q = QUESTIONS.find((q) => q.id === p.id)!;
  const e = resolveEvidence(s, q.id, p.origin, p.previous);
  s.evidence.push(e);
  s.candidates = s.candidates.filter((c) => !e.excluded.includes(c));
  s.usedQuestions.push(questionKey(q.id, p.origin, p.previous));
  s.pending = null;
  s.questionReady = s.time + s.rules.questionCooldown;
  const crossword = s.effects.find((e) => e.card === 10);
  if (crossword) {
    s.questionReady += 10;
    if (--crossword.charges <= 0) clearEffect(s, crossword, true);
  }
  const fog = s.effects.find((e) => e.card === 5);
  if (fog && q.category !== fog.category && --fog.charges <= 0) clearEffect(s, fog, true);
  reward(s, q.draw, q.keep);
  if (s.doubleDip) {
    reward(s, q.draw, q.keep);
    s.doubleDip = false;
  }
  log(s, 'answer', `${q.category}: ${e.answer}. ${s.candidates.length} candidate districts remain.`);
  if (s.hider !== 0 || s.autoHuman) automaticHand(s);
  if (s.hider !== 0) {
    const mate = s.actors.find((a) => a.id !== 0 && a.id !== s.hider)!,
      lead = [...s.candidates].sort(
        (a, b) =>
          distance(s.world.stations[mate.station], s.world.stations[a]) -
          distance(s.world.stations[mate.station], s.world.stations[b]),
      )[0];
    if (lead !== undefined)
      log(
        s,
        'teammate',
        `${NAMES[mate.id]}: The answer leaves ${s.candidates.length} possible districts. ${s.world.stations[lead].name} is a practical next stop. Confidence: ${Math.round(100 / Math.max(1, s.candidates.length))}%.`,
      );
  }
}
export function submitHumanAnswer(s: State, choice: string): string | null {
  const challenge = answerChallenge(s);
  if (s.hider !== 0 || !challenge) return 'There is no incoming question to answer.';
  if (!challenge.choices.includes(choice)) return 'Choose one of the answers shown.';
  if (choice !== challenge.correct)
    return 'Check your field guide and try again. Nothing has been sent; everyone is still paused.';
  answer(s);
  return null;
}
export function skipHeadStart(s: State): string | null {
  if (s.phase !== 'headstart' || s.hider === 0 || s.coach)
    return 'Skip is available while an NPC is preparing to hide.';
  s.paused = false;
  tick(s, Math.max(0, s.rules.headStart - (s.time - s.phaseAt)) + 0.1);
  s.speed = 1;
  return null;
}
export function playCard(
  s: State,
  index: number,
  extra: number[] = [],
  category: Category = 'Radar',
): string | null {
  const error = cardLegal(s, index, extra, category);
  if (error) return error;
  const id = s.hand[index],
    c = CARDS[id],
    target = [0, 1, 8, 9, 11].includes(id) ? curseTarget(s, id) : null;
  const removed = [index, ...extra].sort((a, b) => b - a);
  for (const i of removed) {
    const gone = s.hand.splice(i, 1)[0];
    if (i !== index) s.discard.push(gone);
  }
  if (!c.reaction) s.cardReady = s.time + s.rules.cardCooldown;
  if (c.slot)
    s.effects.push({
      card: id,
      slot: c.slot,
      until: s.time + c.duration,
      target: target || undefined,
      progress: 0,
      charges: 2,
      category: id === 5 ? category : undefined,
      cleared: false,
    });
  if (id === 2) {
    const e = s.effects.at(-1)!;
    e.puzzle = shuffle(s, [0, 1, 2, 3]).slice(0, 3);
    e.input = [];
    e.resolveAt = s.time + 10 + random(s) * 20;
  }
  if (id === 7)
    for (const a of s.actors.filter((a) => a.id !== s.hider && a.journey.length)) {
      a.destination = a.journey.at(-1)!.to;
      a.journey = [];
      a.path = [];
      a.goal = 'boarding';
    }
  if (id === 12) {
    const p = s.pending!;
    s.blocked[questionKey(p.id, p.origin, p.previous)] = s.time + 60;
    s.pending = null;
    s.questionReady = s.time + s.rules.questionCooldown;
  }
  if (id === 13) {
    const p = s.pending!,
      q = QUESTIONS.find((q) => q.id === p.id)!;
    const alternatives = QUESTIONS.filter(
      (a) =>
        a.category === q.category &&
        a.id !== q.id &&
        !s.usedQuestions.includes(questionKey(a.id, p.origin, p.previous)) &&
        (s.blocked[questionKey(a.id, p.origin, p.previous)] || 0) <= s.time &&
        !(a.category === 'Thermometer' && p.origin === p.previous),
    );
    p.id = pick(s, alternatives).id;
    p.changed = true;
  }
  if (id === 14) draw(s, 3);
  if (id === 15) s.handLimit++;
  if (id === 16) s.doubleDip = true;
  if (id === 17) {
    s.revealUntil = s.time + 10;
    s.lastKnown = s.actors
      .filter((a) => a.id !== s.hider)
      .map((a) => ({ id: a.id, station: a.station, time: s.time, ...regionalPosition(s.world, a, s.time) }));
  }
  if (id === 18) {
    clearEffect(s, s.effects[0], false);
    draw(s, 2);
  }
  if (id === 19) {
    const h = s.actors[s.hider],
      t = s.world.stations[h.station].local,
      options = t.spots.filter(
        (p) => distance(p, h) > 2 && pathfind(t, h, p).length / s.rules.walkSpeed <= 15,
      );
    const p = pick(s, options);
    s.hideSpot = p;
    s.relocating = true;
    s.escapeUsed = true;
    h.smokeUntil = s.time + 6;
    h.path = pathfind(t, h, p);
    s.actors
      .filter((a) => a.id !== s.hider && a.station === h.station)
      .forEach((a) => {
        a.searched = [];
      });
    for (const e of s.evidence) if (e.anchor === 'position') e.stale = true;
    log(
      s,
      'relocation',
      'The hider is relocating within the same district. Older position photos may be stale.',
    );
  }
  if (!c.slot) {
    if ([12, 13, 15, 16, 17, 19].includes(id))
      s.activeTools.push({ card: id, until: id === 12 ? s.time + 60 : id === 17 ? s.time + 10 : 1e15 });
    else s.discard.push(id);
  }
  const cardEvent = log(s, 'card', `${NAMES[s.hider]} played ${c.title}.`);
  Object.assign(cardEvent, { card: c.id, actor: s.hider });
  s.speed = 1;
  return null;
}
function clearEffect(s: State, e: Effect, active: boolean) {
  s.effects = s.effects.filter((x) => x !== e);
  s.discard.push(e.card);
  if (active && !s.cleared.includes(e.card)) s.cleared.push(e.card);
  log(s, 'curse', `${CARDS[e.card].title}: ${active ? 'cleared by the seekers' : 'ended'}.`);
}
export function stampForm(s: State, symbol: number) {
  const e = s.effects.find((e) => e.card === 2);
  if (!e) return;
  e.input ??= [];
  e.puzzle ??= [0, 1, 2];
  if (symbol !== e.puzzle[e.input.length]) {
    e.input = [];
    return;
  }
  e.input.push(symbol);
}
export function solveForms(s: State) {
  const e = s.effects.find((e) => e.card === 2);
  if (!e) return 'There is no paperwork to clear.';
  if (s.time < e.until - 20) return 'The minimum processing time is 10 seconds.';
  if (!e.puzzle?.every((symbol, i) => e.input?.[i] === symbol))
    return 'Match the three stamps in the printed order.';
  clearEffect(s, e, true);
  return null;
}
export function handleCurse(s: State, id = 0, card?: number): string | null {
  const e = s.effects.find((e) => e.target && (card === undefined || e.card === card));
  if (!e) {
    if (s.effects.some((e) => e.card === 2)) return 'Match the stamps in the active curse panel.';
    return 'This curse expires on the shared clock.';
  }
  const a = s.actors[id];
  if (a.station !== e.target!.station) return travel(s, id, e.target!.station);
  if (!walkTo(s, id, e.target!)) return 'The target cannot be reached.';
  a.goal = 'errand';
  return null;
}
export function cancelTravel(s: State): string | null {
  const player = s.actors[0];
  if (inTransit(player, s.time)) return 'Wait until the next stop to change your journey.';
  const party = s.hider === 0 ? [player] : s.actors.filter((actor) => actor.id !== s.hider);
  for (const actor of party) {
    if (inTransit(actor, s.time)) continue;
    actor.destination = null;
    actor.journey = [];
    actor.path = [];
    actor.goal = 'investigating';
  }
  return null;
}
function updateEffects(s: State, dt: number) {
  for (const tool of [...s.activeTools]) {
    if (
      s.time >= tool.until ||
      (tool.card === 13 && !s.pending) ||
      (tool.card === 16 && !s.doubleDip) ||
      (tool.card === 19 && !s.relocating)
    ) {
      s.activeTools.splice(s.activeTools.indexOf(tool), 1);
      s.discard.push(tool.card);
    }
  }
  for (const e of [...s.effects]) {
    if (e.target && !s.effects.some((x) => x.card === 7)) {
      const worker = s.actors.find(
        (a) =>
          a.id !== s.hider &&
          !inTransit(a, s.time) &&
          a.station === e.target!.station &&
          distance(a, e.target!) < 0.7,
      );
      if (worker) {
        if (e.worker === undefined || e.worker === worker.id) e.progress += dt;
        else e.progress = dt;
        e.worker = worker.id;
        const required = e.card === 0 ? 20 : e.card === 1 ? 15 : e.card === 9 ? 20 : 0;
        if (e.progress >= required) {
          clearEffect(s, e, true);
          continue;
        }
      } else {
        e.progress = 0;
        e.worker = undefined;
      }
    }
    if (e.card === 2 && s.time >= (s.settings.simplified ? e.until - 20 : (e.resolveAt ?? e.until))) {
      clearEffect(s, e, true);
      continue;
    }
    if (s.time >= e.until) clearEffect(s, e, false);
  }
}
export function tag(s: State, id = 0): string | null {
  if (s.phase !== 'search' || id === s.hider) return 'Tag a hider during the search.';
  if (!canTag(s, id)) return 'No hider within clear tagging reach.';
  const h = s.actors[s.hider];
  log(
    s,
    'capture',
    `${NAMES[id]} tagged ${NAMES[s.hider]} at close range with a clear sightline${h.hiding ? '; close inspection revealed the cover' : ''}.`,
    id,
  );
  finishRound(s, 'Tagged by ' + NAMES[id], false);
  return null;
}
function settle(s: State) {
  const h = s.actors[s.hider],
    t = s.world.stations[h.station].local;
  s.localAt = s.time;
  s.locked = true;
  const p =
    h.hiding && coverAt(t, h)
      ? { x: h.x, y: h.y }
      : [...t.spots].sort((a, b) => pathfind(t, h, a).length - pathfind(t, h, b).length)[0];
  s.hideSpot = p;
  h.path = s.hider === 0 || (h.hiding && coverAt(t, h)) ? [] : pathfind(t, h, p);
  s.relocating = h.path.length > 0;
  if (s.hider === 0) {
    s.speed = 1;
    log(s, 'warning', 'Seekers have reached your district. Break sightlines, hide, or play a card.');
  } else s.events.push({ time: s.time, type: 'local', text: 'Local endgame began.' });
}
export function seekerView(s: State, id: number): SeekerView {
  const a = s.actors[id],
    h = s.actors[s.hider],
    partner = s.actors.find((p) => p.id !== id && p.id !== s.hider)!;
  const seen =
    !inTransit(h, s.time) &&
    !inTransit(a, s.time) &&
    a.station === h.station &&
    canSeeActor(s.world.stations[a.station].local, a, h, s.rules.sightRange ?? 7);
  return {
    world: s.world,
    time: s.time,
    self: structuredClone(a),
    partner: structuredClone(partner),
    candidates: [...s.candidates],
    visibleHider: seen ? { x: h.x, y: h.y } : null,
    legalQuestions: QUESTIONS.filter((q) => !questionLegal(s, q.id, id)).map((q) => q.id),
    questionOrder: s.questionOrder,
    command: s.hider === 0 ? 'Suggest a plan' : s.teamCommand,
    commandTarget: s.teamTarget,
    commandPoint: s.teamPoint,
    errand: s.effects.find((e) => e.target)?.target || null,
  };
}
function offerQuestion(s: State, id: string, actor: number) {
  if (s.hider === 0 || s.autoHuman || s.settings.autoQuestions) {
    ask(s, id, actor);
    return;
  }
  const a = s.actors[actor];
  const previous = s.questionSuggestion;
  if (
    previous &&
    !questionLegal(s, previous.id, previous.actor) &&
    s.actors[previous.actor].station === previous.origin &&
    s.actors[previous.actor].previous === previous.previous
  )
    return;
  s.questionSuggestion = { id, actor, origin: a.station, previous: a.previous };
  const question = QUESTIONS.find((q) => q.id === id)!;
  log(s, 'teammate', `${NAMES[actor]}: I suggest “${question.title}” Open Ask to approve it.`, actor);
}
export function approveQuestion(s: State): string | null {
  const proposal = s.questionSuggestion;
  if (!proposal) return 'No teammate question is waiting.';
  const actor = s.actors[proposal.actor];
  if (s.hider === 0 || actor.station !== proposal.origin || actor.previous !== proposal.previous) {
    s.questionSuggestion = null;
    return 'The team moved. Choose a question from your new location.';
  }
  return ask(s, proposal.id, proposal.actor);
}
export function suggestedQuestion(s: State) {
  const p = s.questionSuggestion;
  if (!p || s.hider === 0 || s.settings.autoQuestions) return null;
  const actor = s.actors[p.actor];
  return actor &&
    actor.station === p.origin &&
    actor.previous === p.previous &&
    !questionLegal(s, p.id, p.actor)
    ? p
    : null;
}
function thinkSeeker(s: State, a: Actor) {
  const v = seekerView(s, a.id);
  if (a.journey.length || s.phase !== 'search') return;
  const leader = s.actors.find((actor) => actor.id !== s.hider)!;
  if (a.id !== leader.id) {
    if (v.visibleHider && distance(a, v.visibleHider) <= 1.3 && distance(a, leader) < 5) {
      tag(s, a.id);
      return;
    }
    const advice = takeNpcAdvice(s, a.id),
      plan = advice?.plan ?? seekerPlan(v);
    if (plan?.kind === 'question' && plan.question && !questionLegal(s, plan.question, a.id)) {
      offerQuestion(s, plan.question, a.id);
      if (advice?.line) log(s, 'teammate', `${NAMES[a.id]}: Plan · ${advice.line}`, a.id);
    }
    return;
  }
  if (v.visibleHider) {
    a.sprinting = distance(a, v.visibleHider) > 2;
    const p = seekerPlan(v);
    if (p.kind === 'tag') tag(s, a.id);
    else if (p.point) walkTo(s, a.id, p.point);
    return;
  }
  if (a.path.length) return;
  const t = s.world.stations[a.station].local;
  if (a.goal === 'checking') {
    if (a.target !== null) {
      for (const seeker of s.actors.filter((p) => p.id !== s.hider && p.station === a.station))
        if (!seeker.searched.includes(a.target)) seeker.searched.push(a.target);
    }
    a.target = null;
    a.goal = 'investigating';
  }
  // A partial street sweep cannot prove that arbitrary environmental cover is empty.
  if (a.searched.length >= inspectionPoints(t).length && !s.candidates.includes(a.station))
    a.visited.push(a.station);
  if (
    a.searched.length >= inspectionPoints(t).length &&
    s.candidates.includes(a.station) &&
    !a.visited.includes(a.station)
  ) {
    a.visited.push(a.station);
    log(
      s,
      'observation',
      `${NAMES[a.id]}: We checked the main hiding corners in ${s.world.stations[a.station].name}. Keep it on the list until a clue rules it out.`,
    );
  }
  const advice = takeNpcAdvice(s, a.id),
    proposed = advice?.plan;
  const permitted =
    proposed &&
    ((proposed.kind === 'question' && proposed.question && !questionLegal(s, proposed.question, a.id)) ||
      (proposed.kind === 'travel' &&
        proposed.target !== undefined &&
        v.command === 'Suggest a plan' &&
        v.candidates.includes(proposed.target) &&
        proposed.target !== a.station) ||
      (proposed.kind === 'walk' &&
        proposed.point &&
        pathfind(t, a, proposed.point).length > 0 &&
        ['Suggest a plan', 'Search this area'].includes(v.command)) ||
      proposed.kind === 'report');
  const plan = permitted ? (proposed as import('./ai').Plan) : seekerPlan(v);
  if (permitted && advice.line) log(s, 'teammate', `${NAMES[a.id]}: Plan · ${advice.line}`, a.id);
  if (plan.kind === 'question' && plan.question) offerQuestion(s, plan.question, a.id);
  else if (plan.kind === 'travel' && plan.target !== undefined) travel(s, a.id, plan.target);
  else if (plan.kind === 'walk' && plan.point) {
    if (walkTo(s, a.id, plan.point)) {
      a.goal = plan.target === undefined ? 'errand' : 'checking';
      a.target = plan.target ?? null;
    }
  } else if (plan.kind === 'report' && a.memory.at(-1) !== plan.text) {
    a.memory.push(plan.text!);
    log(s, 'teammate', `${NAMES[a.id]}: ${plan.text}`);
  }
}
function thinkHider(s: State) {
  const a = s.actors[s.hider];
  if (
    s.phase === 'headstart' &&
    !a.journey.length &&
    !a.path.length &&
    a.destination === null &&
    a.station === a.target
  ) {
    if (s.committed === null) commit(s, a.id);
    const t = s.world.stations[a.station].local;
    const advice = a.goal !== 'hidden' ? takeNpcAdvice(s, a.id) : null;
    const proposal = advice?.plan;
    const p =
      proposal?.kind === 'hide-at' &&
      proposal.target === a.station &&
      t.spots.some((spot) => spot.x === proposal.point.x && spot.y === proposal.point.y)
        ? proposal.point
        : t.spots[Math.floor(random(s) * t.spots.length)];
    if (a.goal !== 'hidden') {
      walkTo(s, a.id, p);
      a.goal = 'hidden';
    }
  }
  // React only to opponents this hider can actually see. Two short escapes per turn
  // give the search a readable chase without an endlessly fleeing target.
  if (
    s.phase === 'search' &&
    !a.journey.length &&
    !a.path.length &&
    (a.evades ?? 0) < 2 &&
    s.time >= (a.evadeAt ?? 0)
  ) {
    const t = s.world.stations[a.station].local;
    const threats = s.actors.filter(
      (other) =>
        other.id !== a.id &&
        other.station === a.station &&
        !inTransit(other, s.time) &&
        canSeeActor(t, a, other, 6),
    );
    if (threats.length && Math.min(...threats.map((other) => distance(a, other))) > 2.5) {
      a.evadeAt = s.time + 2;
      const options = t.spots
        .filter((point) => distance(a, point) >= 3 && distance(a, point) <= 15)
        .map((point) => ({
          point,
          score: Math.min(
            ...threats.map((other) => distance(point, other) + (!lineOfSight(t, other, point) ? 5 : 0)),
          ),
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 6)
        .map((option) => ({ ...option, path: pathfind(t, a, option.point) }))
        .filter((option) => option.path.length >= 3 && option.path.length <= 18)
        .map((option) => ({ ...option, score: option.score - option.path.length * 0.12 }))
        .sort((left, right) => right.score - left.score);
      const escape = options[0];
      if (escape && escape.score > Math.min(...threats.map((other) => distance(a, other))) + 2) {
        const human = s.actors[0];
        const visible = human.station === a.station && canSeeActor(t, human, a, s.rules.sightRange ?? 7);
        walkTo(s, a.id, escape.point);
        a.goal = 'escaping';
        a.sprinting = true;
        a.evades = (a.evades ?? 0) + 1;
        a.evadeAt = s.time + 18;
        if (visible) {
          const cue = log(s, 'observation', `${NAMES[a.id]} saw the seekers and dashed for new cover!`, a.id);
          cue.visibleToHuman = true;
          s.message = cue.text;
        }
      }
    }
  }
  if (s.phase === 'search' && s.time >= s.cardReady) {
    const advice = takeNpcAdvice(s, a.id),
      plan = advice?.plan;
    if (plan?.kind === 'hold') {
      automaticHand(s);
      return;
    }
    if (
      plan?.kind === 'card' &&
      s.hand[plan.index] === plan.cardId &&
      !cardLegal(s, plan.index, plan.extra)
    ) {
      playCard(s, plan.index, plan.extra);
      automaticHand(s);
      return;
    }
  }
  if (s.phase === 'search' && s.time >= s.cardReady && random(s) < 0.6) {
    for (let i = 0; i < s.hand.length; i++) {
      const c = CARDS[s.hand[i]];
      if (c.type === 'bonus' || c.reaction) continue;
      const extra = s.hand
        .map((_, j) => j)
        .filter((j) => j !== i)
        .sort((a, b) => Number(CARDS[s.hand[a]].type === 'bonus') - Number(CARDS[s.hand[b]].type === 'bonus'))
        .slice(0, c.cost);
      if (!cardLegal(s, i, extra)) {
        playCard(s, i, extra);
        break;
      }
    }
  }
  automaticHand(s);
}
function coordinateSeekers(s: State) {
  const seekers = s.actors.filter((actor) => actor.id !== s.hider),
    leader = seekers[0],
    follower = seekers[1];
  if (follower.journey.length || leader.journey.length) return;
  if (follower.station !== leader.station) {
    if (follower.destination !== leader.station) travel(s, follower.id, leader.station, false);
    return;
  }
  if (leader.destination !== null) {
    if (follower.destination !== leader.destination) travel(s, follower.id, leader.destination, false);
    return;
  }
  if (follower.destination !== null) {
    follower.destination = null;
    follower.path = [];
  }
  const separation = distance(leader, follower);
  follower.sprinting = leader.sprinting || separation > 3.5;
  if (separation > 2.2 && s.time >= follower.followAt) {
    follower.followAt = s.time + 0.55;
    const town = s.world.stations[leader.station].local;
    const dx = (follower.x - leader.x) / separation,
      dy = (follower.y - leader.y) / separation;
    const point = { x: leader.x + dx * 1.7, y: leader.y + dy * 1.7 };
    follower.path = pathfind(town, follower, walkable(town, point.x, point.y) ? point : leader);
    follower.goal = 'following';
  }
}
function followPath(s: State, a: Actor, dt: number) {
  if (!a.path.length || !canMove(s, a.id)) return;
  const seekers = s.actors.filter((actor) => actor.id !== s.hider);
  if (
    a.id === seekers[0].id &&
    (a.id !== 0 || s.autoHuman) &&
    (seekers[1].station !== a.station || distance(a, seekers[1]) > 5)
  )
    return;
  const speed =
    (a.id === s.hider ? 1 : (s.rules.seekerSpeed ?? 1)) *
    s.rules.walkSpeed *
    (a.sprinting ? SPRINT_MULTIPLIER : 1) *
    (a.smokeUntil > s.time ? 1.25 : 1);
  let budget = speed * dt;
  while (a.path.length && budget > 0.00001) {
    const target = a.path[0],
      d = distance(a, target);
    if (d < 0.00001) {
      a.path.shift();
      continue;
    }
    const step = Math.min(budget, d),
      before = { x: a.x, y: a.y };
    moveActor(s, a, target.x - a.x, target.y - a.y, step / speed);
    if (distance(before, a) < step - 0.001) {
      if (a.id !== s.hider && s.effects.some((e) => e.card === 4)) {
        const dirs = [
          [0, -1],
          [1, 0],
          [0, 1],
          [-1, 0],
        ];
        const [dx, dy] = dirs[(a.dir + 1) % 4];
        moveActor(s, a, dx, dy, dt);
        a.path = [];
      }
      break;
    }
    budget -= step;
    if (d <= step + 0.00001) {
      a.x = target.x;
      a.y = target.y;
      a.path.shift();
      a.inside = insideBuilding(s.world.stations[a.station].local, a);
    }
  }
  if (!a.path.length && a.id === s.hider && s.relocating) s.relocating = false;
  if (!a.path.length && a.goal === 'escaping') {
    a.sprinting = false;
    a.goal = 'hidden';
  }
  if (!a.path.length && a.id === 0 && a.id !== s.hider && a.goal === 'checking' && a.target !== null) {
    if (!a.searched.includes(a.target)) a.searched.push(a.target);
    a.target = null;
    a.goal = 'investigating';
  }
  if (
    !a.path.length &&
    a.id === s.hider &&
    (a.id !== 0 || s.autoHuman) &&
    coverAt(s.world.stations[a.station].local, a)
  )
    a.hiding = true;
}
function updateTransit(s: State, a: Actor) {
  if (a.journey.length) {
    const leg = a.journey[0];
    if (s.time >= leg.arrive) {
      a.previous = leg.from;
      a.station = leg.to;
      Object.assign(a, s.world.stations[a.station].local.platform);
      a.inside = null;
      a.searched = [];
      a.journey.shift();
      if (a.journey.length && travelRestriction(s, a, a.journey[0].kind)) {
        a.destination = a.journey.at(-1)!.to;
        a.journey = [];
        a.goal = 'boarding';
      }
      if (!a.journey.length) {
        // Stagger disembarking teammates onto safe ground instead of stacking bodies.
        spreadCompanion(s, a);
        a.goal = a.id === s.hider ? 'conceal' : 'investigating';
        log(s, 'arrival', `${NAMES[a.id]} arrived in ${s.world.stations[a.station].name}.`, a.id);
        if (a.id === 0) s.speed = 1;
      }
    }
  } else board(s, a);
}
export function tick(s: State, seconds: number, playerInput?: Point & { sprint?: boolean }) {
  if (s.paused || !['headstart', 'search'].includes(s.phase)) return;
  if (s.hider === 0 && !s.autoHuman && (s.pending || s.rewards.length || s.hand.length > s.handLimit)) return;
  const n = Math.ceil(seconds / 0.1),
    dt = seconds / n;
  for (let step = 0; step < n; step++) {
    if (s.phase === 'results' || s.phase === 'finished' || s.paused) break;
    if (s.hider === 0 && !s.autoHuman && (s.pending || s.rewards.length || s.hand.length > s.handLimit))
      break;
    s.time += dt;
    coordinateSeekers(s);
    s.actors[0].sprinting = !!(
      playerInput?.sprint &&
      (playerInput.x || playerInput.y || s.actors[0].path.length) &&
      canMove(s, 0)
    );
    updateEffects(s, dt);
    if (playerInput && (playerInput.x || playerInput.y))
      move(s, 0, playerInput.x, playerInput.y, dt, playerInput.sprint);
    for (const a of s.actors) {
      followPath(s, a, dt);
      updateTransit(s, a);
    }
    updateResidents(s, dt);
    const humanLeg = s.actors[0].journey[0];
    if (humanLeg && serviceStop(humanLeg, s.time) && !serviceStop(humanLeg, s.time - dt))
      log(
        s,
        'service',
        `Brief repair stop. The crew will have us moving again in ${humanLeg.service!.seconds} seconds. Arrival time already includes this stop.`,
        0,
      );
    if (s.revealUntil > s.time)
      s.lastKnown = s.actors
        .filter((a) => a.id !== s.hider)
        .map((a) => ({
          id: a.id,
          station: a.station,
          time: s.time,
          ...regionalPosition(s.world, a, s.time),
        }));
    if (s.hider === 0) {
      const human = s.actors[0];
      for (const seeker of s.actors.filter((a) => a.id !== 0))
        if (
          !inTransit(seeker, s.time) &&
          seeker.station === human.station &&
          distance(seeker, human) < 7 &&
          lineOfSight(s.world.stations[human.station].local, human, seeker)
        ) {
          s.lastKnown = s.lastKnown.filter((k) => k.id !== seeker.id);
          s.lastKnown.push({
            id: seeker.id,
            station: seeker.station,
            time: s.time,
            ...regionalPosition(s.world, seeker, s.time),
          });
        }
    }
    if (s.phase === 'headstart' && s.time - s.phaseAt >= s.rules.headStart) {
      const h = s.actors[s.hider];
      if (s.committed === null || h.station !== s.committed || h.journey.length) {
        finishRound(s, 'No eligible district was reached and committed before the deadline.', true);
        continue;
      }
      s.phase = 'search';
      s.searchAt = s.time;
      s.questionReady = s.time;
      s.speed = 1;
      log(
        s,
        'phase',
        s.hider === 0
          ? 'The seekers are on their way. Break sightlines, hide beside cover, or play a card.'
          : 'Search started. Ask a question to narrow down the hiding district, then plan your journey.',
      );
    }
    if (s.phase === 'search') {
      if (
        s.localAt === null &&
        s.actors.some((a) => a.id !== s.hider && a.station === s.committed && !inTransit(a, s.time))
      )
        settle(s);
      if (s.pending && (s.hider !== 0 || s.autoHuman)) {
        const c = s.coach?.step === 5 ? -1 : s.hand.findIndex((id) => id === 12 || id === 13);
        if (c >= 0 && random(s) < 0.25 && !cardLegal(s, c, [])) playCard(s, c, []);
        else answer(s);
      }
      if (s.time - s.searchAt >= s.rules.searchCap) {
        finishRound(s, 'Search time limit reached', false);
        continue;
      }
    }
    for (const a of s.actors)
      if ((a.id !== 0 || s.autoHuman) && s.time >= a.nextThink) {
        a.nextThink = s.time + balance.personalities[a.id].cadence;
        if (a.id === s.hider) thinkHider(s);
        else thinkSeeker(s, a);
      }
    if (s.hider === 0 && s.phase === 'search') {
      const seen = stealthState(s) === 'spotted',
        previous = sightAlerts.get(s);
      let at = previous?.at ?? -10;
      if (seen && !previous?.seen && s.time - at > 1.5) {
        log(s, 'spotted', 'Spotted. Break the sightline; close inspection can reveal cover.', 0);
        at = s.time;
      }
      sightAlerts.set(s, { seen, at });
    }
    if (Math.floor((s.time - dt) / 2) !== Math.floor(s.time / 2))
      for (const a of s.actors)
        if (a.path.length || a.journey.length)
          s.events.push({
            time: s.time,
            type: 'position',
            text: '',
            actor: a.id,
            station: a.station,
            x: a.x,
            y: a.y,
          });
  }
}
export function finishRound(s: State, reason: string, forfeit = false) {
  if (s.phase === 'results' || s.phase === 'finished') return;
  const survival = forfeit ? 0 : Math.max(0, s.time - s.searchAt),
    bonus = forfeit ? 0 : bonusScore(s);
  const result: RoundResult = {
    hider: s.hider,
    survival,
    bonus,
    score: survival + bonus,
    forfeit,
    reason,
    district: s.committed ?? s.actors[s.hider].station,
    events: s.events.filter((e) => e.time >= s.phaseAt),
    evidence: structuredClone(s.evidence),
  };
  s.results.push(result);
  s.roundScores.push(result);
  s.phase = 'results';
  s.speed = 1;
  s.pending = null;
  s.rewards = [];
  log(s, 'result', `${NAMES[s.hider]}: ${Math.floor(survival)}s survived + ${bonus}s bonus. ${reason}`);
  if (s.roundScores.length === 3) {
    awardSet(s, s.roundScores);
    const high = Math.max(...s.totals);
    if (high >= (s.rules.targetPoints ?? 6) && s.totals.filter((t) => t === high).length === 1)
      s.winner = s.totals.indexOf(high);
  }
  s.actors.forEach((a) =>
    a.memory.push(
      `${NAMES[s.hider]} hid in ${s.world.stations[result.district].name} for ${Math.floor(survival)} seconds.`,
    ),
  );
}
export function awardSet(s: Pick<State, 'totals'>, results: RoundResult[]) {
  for (const r of results) {
    if (r.forfeit) continue;
    const rank = results.filter(
      (o) =>
        !o.forfeit &&
        (o.score > r.score + 0.0001 ||
          (Math.abs(o.score - r.score) < 0.0001 && o.survival > r.survival + 0.0001)),
    ).length;
    s.totals[r.hider] += [3, 1, 0][rank] ?? 0;
  }
}
export function nextRound(s: State) {
  if (s.phase !== 'results') return;
  if (s.winner !== null || s.mode !== 'match') {
    s.phase = 'finished';
    return;
  }
  s.round++;
  if (s.round % 3 === 0) {
    s.set++;
    s.roundScores = [];
    s.start = pick(s, s.world.stations).id;
  }
  setupRound(s);
}
export function teammate(s: State, command: string, target = s.actors[0].station) {
  s.teamCommand = command;
  s.teamTarget = target;
  s.teamPoint = ['Inspect this location', 'Search this area'].includes(command)
    ? [...inspectionPoints(s.world.stations[target].local)]
        .filter((_, i) => !s.actors[0].searched.includes(i))
        .sort((a, b) => distance(a, s.actors[0]) - distance(b, s.actors[0]))[0]
    : null;
  const mate = s.actors.find((a) => a.id !== 0 && a.id !== s.hider);
  if (!mate) return;
  mate.path = [];
  mate.destination = null;
  mate.goal = 'investigating';
  mate.nextThink = s.time;
  if (command === 'Handle this curse') handleCurse(s, 0);
  if (command === 'Meet at this station' && target !== s.actors[0].station) travel(s, 0, target);
  if (['Inspect this location', 'Search this area'].includes(command) && s.teamPoint) {
    walkTo(s, 0, s.teamPoint);
    s.actors[0].target = inspectionPoints(s.world.stations[target].local).findIndex(
      (p) => p.x === s.teamPoint!.x && p.y === s.teamPoint!.y,
    );
    s.actors[0].goal = 'checking';
  }
  const text =
    command === 'Suggest a plan'
      ? `${mate.memory.at(-1) ? mate.memory.at(-1) + ' This turn, ' : ''}I have ${s.candidates.length} possible districts. Let’s use a question that splits them, then search the streets together. Confidence: ${Math.round(100 / Math.max(1, s.candidates.length))}%.`
      : command === 'Handle this curse'
        ? 'Let’s clear the errand together. I’m right behind you.'
        : command === 'Follow me'
          ? 'I’ll stay with you and share the clues.'
          : command === 'Meet at this station'
            ? `I’ll meet you at ${s.world.stations[target].name}.`
            : 'Let’s check the courtyards and open buildings together.';
  log(s, 'command', `${NAMES[mate.id]}: ${text}`);
}
export function interact(s: State) {
  const a = s.actors[0],
    t = s.world.stations[a.station].local;
  log(s, 'interact', 'You checked your surroundings.', 0);
  if (s.hider !== 0) {
    const err = tag(s);
    if (!err) return null;
    const h = s.actors[s.hider];
    if (h.station === a.station && !inTransit(h, s.time) && canSeeActor(t, a, h, s.rules.sightRange ?? 7))
      return 'Move closer to tag. You need a clear sightline and close reach.';
    const e = s.effects.find((e) => e.target?.station === a.station && distance(a, e.target!) < 1);
    if (e) return 'Stay here until the task is complete.';
  }
  const resident = nearbyResident(s);
  if (resident) {
    s.residentChat = { station: a.station, index: resident.index, at: s.time };
    const record = s.residents?.find((r) => r.station === a.station && r.index === resident.index);
    if (record) record.talkUntil = s.time + 5;
    const text = residentLine(s, resident.index),
      speech = log(s, 'speech', text);
    Object.assign(speech, { speaker: resident.index + 3, station: a.station, x: resident.x, y: resident.y });
    return text;
  }
  if (distance(a, t.platform) < 5) return 'station';
  const b = t.buildings.find((b) => distance(a, b.door) < 2);
  if (b)
    return b.kind === 'house'
      ? 'The residents have locked up. Try the café, library, or a home with a teal doorway.'
      : `The ${b.kind} is open. Walk through the doorway to explore.`;
  return 'Look for the station sign, open doorways, or a quiet hiding corner.';
}
export function serialize(s: State): string {
  return JSON.stringify(s);
}
export function deserialize(raw: string, fallbackAppearance?: Appearance): State {
  if (raw.length > 8_000_000) throw new Error('This save is too large. Use a game-exported save under 8 MB.');
  const s = JSON.parse(raw) as State;
  validateSave(s);
  if (s.version !== 1 || !s.world?.stations?.length || !Number.isFinite(s.rng) || !s.actors || !s.settings)
    throw new Error('This save is not a supported Last Stop match.');
  s.activeTools ??= [];
  s.teamPoint ??= null;
  s.questionOrder ??= shuffle(
    { rng: hash(`${s.world.seed}:${s.round}:questions`) },
    QUESTIONS.map((question) => question.id),
  );
  s.settings.bindings.sprint ??= 'ShiftLeft';
  s.settings.autoQuestions ??= false;
  s.settings.bindings.hide ??= 'KeyH';
  for (const actor of s.actors) {
    actor.hiding ??= false;
    actor.smokeUntil ??= 0;
    actor.followAt ??= 0;
    actor.sprinting = false;
  }
  s.appearance = normalizeAppearance(s.appearance, fallbackAppearance);
  return s;
}
export function toggleHide(s: State, id = 0): string | null {
  const actor = s.actors[id];
  if (s.paused || !['headstart', 'search'].includes(s.phase)) return 'Start or resume the turn to hide.';
  if (id !== s.hider) return 'Seekers inspect cover; only the hider can conceal themselves.';
  if (actor.journey.length) return 'Leave transit before hiding.';
  if (s.pending || s.rewards.length || s.hand.length > s.handLimit)
    return 'Finish the pending card choice first.';
  if (actor.hiding) {
    actor.hiding = false;
    return null;
  }
  if (!coverAt(s.world.stations[actor.station].local, actor))
    return 'Stand beside a wall, tree, bush, stall, or solid object to hide.';
  actor.hiding = true;
  actor.sprinting = false;
  actor.path = [];
  actor.destination = null;
  log(s, 'cover', `${NAMES[id]} tucked into cover.`, id);
  return null;
}
