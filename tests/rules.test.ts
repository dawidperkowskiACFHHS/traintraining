import { describe, it, expect } from 'vitest';
import { generateWorld, validateWorld, route, km } from '../src/world';
import {
  newGame,
  startRound,
  tick,
  serialize,
  deserialize,
  awardSet,
  seekerView,
  playCard,
  answer,
  ask,
  tag,
  nextRound,
  solveForms,
  move,
  log,
  visibleEvent,
} from '../src/simulation';
import { DECK, CARDS, bonusScore } from '../src/cards';
import { QUESTIONS, valueAt } from '../src/questions';
import { pathfind, lineOfSight } from '../src/local';
import type { RoundResult, State } from '../src/types';
describe('region', () => {
  // This matrix builds 24 regions and checks every hiding route; it is a
  // correctness check, not a five-second hardware benchmark.
  it('reproduces worlds and validates every size and varied seed', () => {
    for (const count of [20, 30, 40])
      for (const seed of ['moss', 'railway', 'seaside', 'midnight']) {
        const w = generateWorld(seed, count);
        expect(validateWorld(w)).toEqual([]);
        expect(w).toEqual(generateWorld(seed, count));
        expect(w.stations.length).toBe(count);
        for (const a of w.stations)
          for (const p of a.local.spots)
            expect(pathfind(a.local, a.local.platform, p).length).toBeGreaterThan(0);
      }
  }, 15000);
  it('routes schedules with valid transfers and positive waits', () => {
    const w = generateWorld('connection', 40);
    for (let i = 1; i < 40; i++) {
      const legs = route(w, 0, i, 17.3);
      expect(legs.at(-1)?.to).toBe(i);
      let now = 17.3;
      for (const l of legs) {
        expect(l.depart).toBeGreaterThanOrEqual(now);
        expect(l.arrive).toBeGreaterThan(l.depart);
        now = l.arrive;
      }
    }
  });
});
describe('investigation and privacy', () => {
  it('a later reveal never retroactively exposes unobserved seeker travel', () => {
    const s = searchState();
    const hidden = log(s, 'arrival', 'Unobserved seeker trip', 1);
    expect(visibleEvent(s, hidden)).toBe(false);
    s.revealUntil = s.time + 10;
    expect(visibleEvent(s, hidden)).toBe(false);
    const seen = log(s, 'arrival', 'Observed during reveal', 1);
    expect(visibleEvent(s, seen)).toBe(true);
    s.time += 11;
    expect(visibleEvent(s, seen)).toBe(true);
    expect(visibleEvent(s, hidden)).toBe(false);
  });
  it('implements multiple questions in every category with truthful geometry', () => {
    const w = generateWorld('facts', 20);
    for (const cat of ['Matching', 'Measuring', 'Radar', 'Thermometer', 'Tentacles', 'Photo'])
      expect(QUESTIONS.filter((q) => q.category === cat).length).toBeGreaterThan(1);
    for (const r of [12, 25, 40, 60])
      for (let h = 0; h < 20; h++) {
        const q = QUESTIONS.find((q) => q.id === `radar-${r}`)!;
        expect(valueAt(w, q, 0, 0, h)).toBe(km(w, 0, h) <= r ? 'Yes' : 'No');
      }
  });
  it('excludes only inconsistent candidates and keeps the true target', () => {
    const s = searchState();
    for (const q of QUESTIONS) {
      s.questionReady = 0;
      s.pending = null;
      const error = ask(s, q.id, 1);
      if (error) continue;
      answer(s);
      expect(s.candidates).toContain(s.committed);
      expect(s.evidence.at(-1)?.answer).toBe(valueAt(s.world, q, 0, 0, s.committed!));
    }
  });
  it('does not expose the secret to seeker decisions', () => {
    const s = searchState();
    const v = seekerView(s, 1);
    expect(v).not.toHaveProperty('hider');
    expect(v).not.toHaveProperty('committed');
    expect(v.visibleHider).toBeNull();
    const other = structuredClone(s);
    other.committed = 3;
    other.actors[0].station = 3;
    expect(seekerView(other, 1)).toEqual(v);
  });
});
function searchState(): State {
  const s = newGame('test', 20);
  s.phase = 'search';
  s.searchAt = 0;
  s.time = 130;
  s.committed = 2;
  s.actors[0].station = 2;
  s.autoHuman = true;
  return s;
}
describe('cards', () => {
  it('keeps every physical deck copy accounted for during a complete match', () => {
    const s = newGame('inventory', 20);
    s.autoHuman = true;
    let steps = 0;
    while (s.phase !== 'finished' && steps++ < 20000) {
      const all = [
        ...s.deck,
        ...s.hand,
        ...s.discard,
        ...s.effects.map((e) => e.card),
        ...s.activeTools.map((e) => e.card),
        ...s.rewards.flatMap((r) => r.cards),
      ];
      expect(all.sort((a, b) => a - b)).toEqual([...DECK].sort((a, b) => a - b));
      if (s.phase === 'preparation') startRound(s);
      else if (s.phase === 'results') nextRound(s);
      else tick(s, 3);
    }
    expect(s.phase).toBe('finished');
  });
  it('manual movement cannot override settling or Emergency Exit routes', () => {
    const s = searchState(),
      a = s.actors[0];
    s.locked = true;
    s.relocating = true;
    a.path = [{ x: a.x + 1, y: a.y }];
    const before = { x: a.x, y: a.y };
    move(s, 0, 0, -1, 1);
    expect({ x: a.x, y: a.y }).toEqual(before);
    expect(a.path.length).toBe(1);
  });
  it('requires actual platform proximity before any service boards', () => {
    const s = searchState();
    const a = s.actors[1];
    const town = s.world.stations[a.station].local;
    const away = town.spots.find((point) => pathfind(town, point, town.platform).length > 8)!;
    Object.assign(a, away);
    a.destination = 1;
    a.path = [];
    a.nextThink = 9999;
    s.actors[2].nextThink = 9999;
    tick(s, 0.1);
    expect(a.journey.length).toBe(0);
    expect(a.path.length).toBeGreaterThan(0);
  });
  it.each([0, 1, 8, 9, 11])(
    'curse %i makes a reachable shared task and grants active clearance credit',
    (id) => {
      const s = searchState();
      s.actors.forEach((a) => (a.nextThink = 9999));
      s.hand = [id, 20, 21];
      expect(playCard(s, 0, CARDS[id].cost ? [1] : [])).toBeNull();
      const effect = s.effects[0],
        worker = s.actors[1];
      expect(effect.target).toBeDefined();
      Object.assign(worker, effect.target!);
      worker.path = [];
      worker.destination = null;
      worker.journey = [];
      tick(s, id === 0 || id === 9 ? 20.2 : id === 1 ? 15.2 : 0.2);
      expect(s.effects.length).toBe(0);
      expect(s.cleared).toContain(id);
    },
  );
  it('paperwork honors its minimum, manual solution and automatic cap', () => {
    const s = searchState();
    s.actors.forEach((a) => (a.nextThink = 9999));
    s.hand = [2];
    playCard(s, 0);
    expect(solveForms(s)).toBeTruthy();
    s.effects[0].resolveAt = s.time + 29;
    s.effects[0].input = [...s.effects[0].puzzle!];
    tick(s, 10.2);
    expect(solveForms(s)).toBeNull();
    expect(s.cleared).toContain(2);
  });
  it('right-turn curse rejects left turns at a four-way street junction', () => {
    const s = searchState();
    s.hand = [4, 20];
    playCard(s, 0, [1]);
    const a = s.actors[1];
    a.x = 30.5;
    a.y = 17.5;
    a.dir = 0;
    move(s, 1, -1, 0, 0.1);
    expect(a.x).toBe(30.5);
    move(s, 1, 1, 0, 0.1);
    expect(a.x).toBeGreaterThan(30.5);
  });
  it('brain fog clears after two other answers and crossword adds only two delays', () => {
    const s = searchState();
    s.hand = [5, 20];
    playCard(s, 0, [1], 'Radar');
    expect(ask(s, 'radar-25', 1)).toContain('fog');
    for (const id of ['zone', 'kind']) {
      s.questionReady = 0;
      expect(ask(s, id, 1)).toBeNull();
      answer(s);
    }
    expect(s.cleared).toContain(5);
    s.hand = [10, 20];
    s.cardReady = 0;
    playCard(s, 0, [1]);
    for (const id of ['line', 'name']) {
      s.questionReady = 0;
      ask(s, id, 1);
      answer(s);
      expect(s.questionReady - s.time).toBe(30);
    }
    expect(s.effects.length).toBe(0);
  });
  it('five more minutes cancels waiting reservations and prevents all physical progress', () => {
    const s = searchState();
    s.hand = [7, 20];
    const a = s.actors[1];
    a.journey = [{ from: 0, to: 1, depart: s.time + 10, arrive: s.time + 28, kind: 'local', line: 0 }];
    s.actors.forEach((a) => (a.nextThink = 9999));
    expect(playCard(s, 0, [1])).toBeNull();
    expect(a.journey.length).toBe(0);
    const old = { x: a.x, y: a.y };
    move(s, 1, 1, 0, 1);
    tick(s, 20);
    expect(a.station).toBe(0);
    expect({ x: a.x, y: a.y }).toEqual(old);
  });
  it('cleaning draws three, pockets stop at seven, and voluntary cancellations do not qualify', () => {
    const s = searchState();
    s.hand = [14, 20, 21];
    expect(playCard(s, 0, [1])).toBeNull();
    expect(s.hand.length).toBe(4);
    s.hand = [15, 15, 15];
    s.cardReady = 0;
    playCard(s, 0);
    s.cardReady = 0;
    playCard(s, 0);
    expect(s.handLimit).toBe(7);
    s.cardReady = 0;
    expect(playCard(s, 0)).toBeTruthy();
    s.hand = [6, 18];
    playCard(s, 0);
    s.cardReady = 0;
    expect(playCard(s, 0)).toBeNull();
    expect(s.hand.length).toBe(2);
    expect(s.effects.length).toBe(0);
    expect(s.cleared).toEqual([]);
  });
  it('keeps Double Dip on cancellation, then doubles the next reward', () => {
    const s = searchState();
    s.hand = [16, 20, 12];
    playCard(s, 0, [1]);
    ask(s, 'zone', 1);
    playCard(s, 0);
    expect(s.doubleDip).toBe(true);
    s.questionReady = 0;
    ask(s, 'kind', 1);
    answer(s);
    expect(s.doubleDip).toBe(false);
    expect(s.hand.length).toBe(2);
  });
  it('reveal expires to last-known markers; emergency exit takes a physical route and stales position clues', () => {
    const s = searchState();
    s.hand = [17, 20];
    playCard(s, 0, [1]);
    expect(s.revealUntil).toBe(s.time + 10);
    s.actors.forEach((a) => (a.nextThink = 9999));
    tick(s, 10.2);
    expect(s.lastKnown.length).toBe(2);
    expect(s.revealUntil).toBeLessThan(s.time);
    s.hand = [19, 20, 21];
    s.cardReady = 0;
    s.localAt = s.time - 5;
    s.locked = true;
    const h = s.actors[0],
      p = s.world.stations[h.station].local.spots[0];
    Object.assign(h, p);
    s.evidence = [
      {
        time: s.time,
        question: 'Position photo',
        answer: 'Scene',
        category: 'Photo',
        origin: 0,
        previous: 0,
        excluded: [],
        anchor: 'position',
      },
    ];
    const before = { x: h.x, y: h.y };
    expect(playCard(s, 0, [1, 2])).toBeNull();
    expect({ x: h.x, y: h.y }).toEqual(before);
    expect(h.path.length).toBeGreaterThan(0);
    expect(s.evidence[0].stale).toBe(true);
    tick(s, 15);
    expect(s.relocating).toBe(false);
    expect(s.escapeUsed).toBe(true);
  });
  it('has the exact 52-card composition', () => {
    expect(CARDS.length).toBe(24);
    expect(DECK.length).toBe(52);
    for (const c of CARDS) expect(DECK.filter((id) => id === c.id).length).toBe(c.type === 'bonus' ? 3 : 2);
  });
  it('rejects invalid costs without spending, then pays additional discards', () => {
    const s = searchState();
    s.hand = [3, 20, 21];
    expect(playCard(s, 0, [])).toBeTruthy();
    expect(s.hand).toEqual([3, 20, 21]);
    expect(playCard(s, 0, [1])).toBeNull();
    expect(s.hand).toEqual([21]);
    expect(s.effects[0].card).toBe(3);
    expect(s.discard).toContain(20);
    expect(s.discard).not.toContain(3);
  });
  it('honors slots, cooldown and expiry without souvenir credit', () => {
    const s = searchState();
    s.hand = [6, 0, 20];
    expect(playCard(s, 0)).toBeNull();
    expect(playCard(s, 0)).toBeTruthy();
    s.actors.forEach((a) => (a.nextThink = 9999));
    tick(s, 21);
    expect(s.effects).toEqual([]);
    expect(s.cleared).toEqual([]);
    expect(s.discard).toContain(6);
  });
  it('cancels a pending question without granting a reward', () => {
    const s = searchState();
    s.hand = [12];
    expect(ask(s, 'zone', 1)).toBeNull();
    expect(playCard(s, 0)).toBeNull();
    expect(s.pending).toBeNull();
    expect(s.rewards.length).toBe(0);
    expect(ask(s, 'zone', 2)).toBeTruthy();
  });
  it('preserves uncancelled questions under new restrictions', () => {
    const s = searchState();
    s.hand = [6];
    ask(s, 'zone', 1);
    playCard(s, 0);
    expect(s.pending).not.toBeNull();
    answer(s);
    expect(s.evidence.length).toBe(1);
  });
  it('caps bonuses at two cards and 120s with proper qualification', () => {
    const s = searchState();
    s.hand = [20, 21, 22, 23];
    s.cleared = [0, 1, 0];
    expect(bonusScore(s)).toBe(100);
    s.localAt = s.time - 61;
    expect(bonusScore(s)).toBe(120);
  });
  it('applies capacity, double rewards, cleaning and voluntary cancellation', () => {
    const s = searchState();
    s.hand = [15, 16, 20, 18];
    expect(playCard(s, 0)).toBeNull();
    expect(s.handLimit).toBe(6);
    s.time += 11;
    expect(playCard(s, 0, [1])).toBeNull();
    expect(s.doubleDip).toBe(true);
    ask(s, 'zone', 1);
    answer(s);
    expect(s.doubleDip).toBe(false);
    expect(s.hand.length).toBe(3);
  });
});
describe('clock, capture and match', () => {
  it('interrupts manual movement at the same instant as a tactical question pause', () => {
    const s = searchState();
    s.autoHuman = false;
    s.actors[1].nextThink = s.time;
    s.actors[2].nextThink = 9999;
    const before = { time: s.time, x: s.actors[0].x };
    tick(s, 1, { x: 1, y: 0 });
    expect(s.pending).not.toBeNull();
    const elapsed = s.time - before.time;
    expect(elapsed).toBeLessThan(1);
    expect(s.actors[0].x - before.x).toBeGreaterThan(0);
    expect(s.actors[0].x - before.x).toBeCloseTo(s.rules.walkSpeed * elapsed, 6);
  });
  it('freezes the full state during pause and human reactions', () => {
    const s = searchState();
    s.paused = true;
    const saved = serialize(s);
    tick(s, 20);
    expect(serialize(s)).toBe(saved);
    s.paused = false;
    s.autoHuman = false;
    ask(s, 'zone', 1);
    const before = s.time;
    tick(s, 20);
    expect(s.time).toBe(before);
  });
  it('forfeits an uncommitted head start and excludes it from placement', () => {
    const s = newGame('forfeit', 20);
    startRound(s);
    tick(s, 121);
    expect(s.phase).toBe('results');
    expect(s.results[0].forfeit).toBe(true);
    expect(s.results[0].score).toBe(0);
  });
  it('does not tag through a wall', () => {
    const s = searchState(),
      h = s.actors[0],
      a = s.actors[1];
    a.station = h.station;
    const b = s.world.stations[h.station].local.buildings[0];
    a.x = b.x - 0.2;
    a.y = b.y + 2;
    h.x = b.x + 0.9;
    h.y = a.y;
    expect(lineOfSight(s.world.stations[h.station].local, a, h)).toBe(false);
    expect(tag(s, 1)).toBeTruthy();
    expect(s.phase).toBe('search');
  });
  it('resumes sampled outcomes and random state exactly', () => {
    const s = newGame('save', 30);
    s.autoHuman = true;
    startRound(s);
    tick(s, 53);
    const restored = deserialize(serialize(s));
    tick(s, 20);
    tick(restored, 20);
    expect(restored).toEqual(s);
  });
  it('awards ties by survival then shared placements; forfeits get no points', () => {
    const r = (hider: number, score: number, survival: number, forfeit = false) =>
      ({ hider, score, survival, forfeit }) as RoundResult;
    const s = { totals: [0, 0, 0] };
    awardSet(s, [r(0, 120, 100), r(1, 120, 110), r(2, 90, 90)]);
    expect(s.totals).toEqual([1, 3, 0]);
    s.totals = [0, 0, 0];
    awardSet(s, [r(0, 100, 100), r(1, 100, 100), r(2, 0, 0, true)]);
    expect(s.totals).toEqual([3, 3, 0]);
  });
  it.each([20, 30, 40])(
    'completes autonomous role rotations and reaches a winner in a %i-station region',
    (size) => {
      const s = newGame('whole-match', size);
      s.autoHuman = true;
      let loops = 0;
      while (s.phase !== 'finished' && loops++ < 30000) {
        if (s.phase === 'preparation') startRound(s);
        else if (s.phase === 'results') nextRound(s);
        else tick(s, 2);
      }
      expect(s.phase).toBe('finished');
      expect(s.winner).not.toBeNull();
      expect(new Set(s.results.map((r) => r.hider)).size).toBe(3);
      expect(s.results.every((r) => !r.forfeit)).toBe(true);
      expect(s.results.some((r) => r.reason.startsWith('Tagged'))).toBe(true);
      expect(s.results.length % 3).toBe(0);
      expect(serialize(s).length).toBeLessThan(4_000_000);
    },
    30000,
  );
});
