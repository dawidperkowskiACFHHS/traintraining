import { test, expect } from 'vitest';
import { newGame, seekerView, tick, serialize, deserialize, startRound } from '../src/simulation';
import {
  seekerMenu,
  hiderMenu,
  parseNpcReply,
  offerNpcAdvice,
  takeNpcAdvice,
  clearNpcAdvice,
} from '../src/npc-advice';

test('seeker model menus contain public knowledge and remain identical when an unseen hider moves', () => {
  const state = newGame('private-npc-context', 20, 'seeker');
  state.phase = 'search';
  state.time = 130;
  state.searchAt = 130;
  state.actors[1].station = 2;
  state.committed = 2;
  const before = seekerMenu(seekerView(state, 2));
  state.actors[1].station = 3;
  state.committed = 3;
  state.hideSpot = { x: 9.5, y: 12.5 };
  expect(seekerMenu(seekerView(state, 2))).toEqual(before);
  expect(JSON.stringify(before.context)).not.toMatch(/committed|hideSpot|hand|correctAnswer/);
});
test('model output can select only supplied actions, with bounded plain-text dialogue', () => {
  const choices = [{ label: 'Wait', plan: { kind: 'hold' as const } }];
  expect(parseNpcReply('{"choice":0,"line":"I will wait."}', choices).plan.kind).toBe('hold');
  for (const content of ['{"choice":3}', '{"choice":-1}', '{"choice":"0"}', 'null', 'not json'])
    expect(() => parseNpcReply(content, choices)).toThrow();
  expect(parseNpcReply(JSON.stringify({ choice: 0, line: 'a'.repeat(500) }), choices).line.length).toBe(160);
});
test('queued model plans expire, clear on disable, reject a changed role and do not enter saves', () => {
  const state = newGame('advice-lifecycle', 20),
    saved = serialize(state);
  offerNpcAdvice(state, 1, { kind: 'hold' }, 'Wait.');
  expect(serialize(state)).toBe(saved);
  expect(takeNpcAdvice(state, 1)?.plan.kind).toBe('hold');
  expect(takeNpcAdvice(state, 1)).toBeNull();
  offerNpcAdvice(state, 1, { kind: 'hold' }, 'Wait.');
  state.round++;
  expect(takeNpcAdvice(state, 1)).toBeNull();
  offerNpcAdvice(state, 1, { kind: 'hold' }, 'Wait.');
  state.time += 61;
  expect(takeNpcAdvice(state, 1)).toBeNull();
  offerNpcAdvice(state, 1, { kind: 'hold' }, 'Wait.');
  clearNpcAdvice(state);
  expect(takeNpcAdvice(state, 1)).toBeNull();
  offerNpcAdvice(state, 0, { kind: 'hold' }, 'Wait.');
  expect(takeNpcAdvice(state, 0)).toBeNull();
});
test('an NPC uses a legal model-selected question through the ordinary simulation action', () => {
  const state = newGame('model-question', 20);
  state.phase = 'search';
  state.time = 130;
  state.searchAt = 130;
  state.localAt = 130;
  state.committed = 3;
  state.actors[0].station = 3;
  state.actors.forEach((actor) => (actor.nextThink = 9999));
  state.actors[1].nextThink = 130;
  const menu = seekerMenu(seekerView(state, 1)),
    choice = menu.choices.find((choice) => choice.plan.kind === 'question')!;
  offerNpcAdvice(state, 1, choice.plan, 'I will compare our clues.');
  tick(state, 0.1);
  expect(state.pending).not.toBeNull();
  expect(state.events.some((event) => event.text.includes('Plan · I will compare'))).toBe(true);
});
test('invalid or stale model travel cannot move an NPC to an excluded district', () => {
  const state = newGame('invalid-model-travel', 20);
  state.phase = 'search';
  state.time = 130;
  state.searchAt = 130;
  state.actors.forEach((actor) => (actor.nextThink = 9999));
  state.actors[1].nextThink = 130;
  state.actors[0].station = 3;
  state.committed = 3;
  state.candidates = [0];
  state.questionReady = 9999;
  offerNpcAdvice(state, 1, { kind: 'travel', target: 18 }, 'Go there.');
  tick(state, 0.1);
  expect(state.actors[1].destination).not.toBe(18);
});
test('hider choices use their own hand and legal costs; older saves keep classic play without a server', () => {
  const state = newGame('hider-model', 20, 'seeker');
  state.phase = 'search';
  state.time = 130;
  state.searchAt = 130;
  state.hand = [3, 20, 21];
  const menu = hiderMenu(state, 1)!;
  expect(menu.context.role).toBe('hider');
  expect(menu.choices.some((choice) => choice.plan.kind === 'card')).toBe(true);
  const restored = deserialize(serialize(newGame('offline-model', 20)));
  startRound(restored);
  tick(restored, 1);
  expect(restored.time).toBeGreaterThan(0);
});
