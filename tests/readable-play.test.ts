import { describe, expect, it } from 'vitest';
import {
  newGame,
  startRound,
  tick,
  skipHeadStart,
  submitHumanAnswer,
  serialize,
  deserialize,
  handleCurse,
  cancelTravel,
  visibleEvent,
  interact,
} from '../src/simulation';
import { residentActivity, nearbyResident } from '../src/residents';
import { answerChallenge } from '../src/answer-challenge';
import { QUESTIONS, valueAt } from '../src/questions';

describe('human-readable play and decisions', () => {
  it('records a nearby resident conversation without spending time or changing a clue', () => {
    const state = newGame('speaking-residents', 20, 'hider');
    startRound(state);
    const person = residentActivity(state.world.stations[0], 0, state.time);
    Object.assign(state.actors[0], { x: person.x, y: person.y });
    expect(nearbyResident(state)?.index).toBe(0);
    const time = state.time,
      cards = [...state.hand];
    const reply = interact(state),
      event = state.events.at(-1)!;
    expect(event.type).toBe('speech');
    expect(event.speaker).toBe(3);
    expect(event.text).toBe(reply);
    expect(event.station).toBe(0);
    expect(visibleEvent(state, event)).toBe(true);
    expect(state.time).toBe(time);
    expect(state.hand).toEqual(cards);
    expect(state.evidence).toEqual([]);
    expect(deserialize(serialize(state)).events.at(-1)?.speaker).toBe(3);
  });
  it('skips preparation by advancing the same authoritative simulation', () => {
    const state = newGame('skip-preparation', 20, 'seeker');
    startRound(state);
    const control = deserialize(serialize(state));
    expect(skipHeadStart(state)).toBeNull();
    tick(control, 120.1);
    expect(serialize(state)).toBe(serialize(control));
    expect(state.phase).toBe('search');
    expect(state.committed).not.toBeNull();
    expect(skipHeadStart(state)).toMatch(/Skip is available/);
    const hider = newGame('skip-protected', 20, 'hider');
    startRound(hider);
    expect(skipHeadStart(hider)).not.toBeNull();
    expect(hider.time).toBe(0);
  });
  it('offers truthful, stable choices for every question without consuming randomness', () => {
    const state = newGame('question-field-guide', 20, 'hider');
    state.phase = 'search';
    state.committed = 3;
    state.actors[0].station = 3;
    for (const q of QUESTIONS) {
      state.pending = { id: q.id, origin: 0, previous: 2, askedBy: 1, changed: false };
      const rng = state.rng,
        challenge = answerChallenge(state)!;
      expect(challenge.choices).toContain(valueAt(state.world, q, 0, 2, 3));
      expect(challenge.choices.length).toBeLessThanOrEqual(4);
      expect(answerChallenge(state)).toEqual(challenge);
      expect(state.rng).toBe(rng);
      expect(challenge.guide).toContain(state.world.stations[3].name);
    }
  });
  it('lets the human retry and publishes no false clue or paid reward', () => {
    const state = newGame('truthful-retry', 20, 'hider');
    state.phase = 'search';
    state.committed = 3;
    state.actors[0].station = 3;
    state.pending = { id: 'zone', origin: 0, previous: 2, askedBy: 1, changed: false };
    const challenge = answerChallenge(state)!,
      before = serialize(state);
    expect(submitHumanAnswer(state, challenge.correct === 'Yes' ? 'No' : 'Yes')).toMatch(
      /Nothing has been sent/,
    );
    expect(serialize(state)).toBe(before);
    expect(submitHumanAnswer(state, challenge.correct)).toBeNull();
    expect(state.pending).toBeNull();
    expect(state.evidence.at(-1)?.answer).toBe(challenge.correct);
    expect(state.candidates).toContain(3);
    expect(state.rewards).toHaveLength(1);
    expect(submitHumanAnswer(state, challenge.correct)).not.toBeNull();
    expect(state.rewards).toHaveLength(1);
  });
  it('tracks the selected curse task and awards a clear once its hold completes', () => {
    const state = newGame('bridge-task', 20, 'seeker');
    state.phase = 'search';
    state.committed = 1;
    state.rules.searchCap = 9999;
    state.actors.forEach((a) => (a.nextThink = 1e9));
    const point = { station: 0, ...state.world.stations[0].local.platform };
    state.effects = [
      { card: 1, slot: 'investigation', target: point, progress: 0, charges: 0, until: 60, cleared: false },
    ];
    expect(handleCurse(state, 0, 1)).toBeNull();
    tick(state, 9);
    expect(state.effects[0].progress).toBeCloseTo(9);
    tick(state, 6.1);
    expect(state.effects).toHaveLength(0);
    expect(state.cleared).toContain(1);
    expect(state.events.filter((event) => /Bridge Club: cleared/.test(event.text))).toHaveLength(1);
  });
  it('cancels a waiting party together but cannot teleport it out of a moving vehicle', () => {
    const state = newGame('cancel-party', 20, 'seeker');
    const leg = { from: 0, to: 1, depart: 10, arrive: 20, kind: 'local' as const, line: 0 };
    for (const a of state.actors.filter((a) => a.id !== state.hider)) a.journey = [{ ...leg }];
    expect(cancelTravel(state)).toBeNull();
    expect(
      state.actors
        .filter((a) => a.id !== state.hider)
        .every((a) => !a.journey.length && a.destination === null),
    ).toBe(true);
    state.actors[0].journey = [leg];
    state.time = 15;
    expect(cancelTravel(state)).toMatch(/next stop/);
    expect(state.actors[0].journey).toHaveLength(1);
  });
  it('cancels the companion reservation when manual movement leaves a waiting service', () => {
    const state = newGame('leave-platform-together', 20, 'seeker');
    state.phase = 'search';
    state.committed = 1;
    state.actors[1].station = 1;
    state.actors.forEach((a) => (a.nextThink = 1e9));
    const leg = { from: 0, to: 1, depart: 10, arrive: 30, kind: 'local' as const, line: 0 };
    state.actors[0].journey = [{ ...leg }];
    state.actors[2].journey = [{ ...leg }];
    tick(state, 0.1, { x: 1, y: 0 });
    expect(state.actors[0].journey).toHaveLength(0);
    expect(state.actors[2].journey).toHaveLength(0);
    expect(state.actors[2].station).toBe(state.actors[0].station);
  });
  it('makes a visible, bounded escape and preserves it in saved games', () => {
    const state = newGame('reactive-hider', 20, 'seeker');
    state.phase = 'search';
    state.time = state.searchAt = 130;
    state.committed = 2;
    state.localAt = 130;
    state.cardReady = state.questionReady = 1e9;
    state.hand = [];
    const town = state.world.stations[2].local;
    town.tiles.fill(1);
    town.buildings = [];
    town.props = [];
    town.cover = [];
    town.spots = [
      { x: 18.5, y: 10.5 },
      { x: 19.5, y: 12.5 },
    ];
    state.actors.forEach((a) => Object.assign(a, { station: 2, x: 5.5, y: 10.5, nextThink: 1e9 }));
    Object.assign(state.actors[1], { x: 10.5, nextThink: 0 });
    tick(state, 0.1);
    expect(state.actors[1].evades).toBe(1);
    expect(state.actors[1].goal).toBe('escaping');
    expect(state.actors[1].sprinting).toBe(true);
    expect(state.events.some((event) => event.text.includes('dashed for new cover'))).toBe(true);
    expect(
      visibleEvent(state, state.events.find((event) => event.text.includes('dashed for new cover'))!),
    ).toBe(true);
    expect(deserialize(serialize(state)).actors[1].evades).toBe(1);
    const hidden = deserialize(serialize(state));
    Object.assign(hidden.actors[1], {
      x: 10.5,
      y: 10.5,
      path: [],
      evades: 0,
      evadeAt: 0,
      nextThink: 0,
      goal: 'hidden',
    });
    for (let y = 0; y < town.height; y++) hidden.world.stations[2].local.tiles[y * town.width + 8] = 12;
    tick(hidden, 0.1);
    expect(hidden.actors[1].evades).toBe(0);
  });
});
