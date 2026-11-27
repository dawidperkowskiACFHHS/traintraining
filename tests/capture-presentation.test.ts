import { it, expect } from 'vitest';
import { newGame, tag, serialize, deserialize, finishRound } from '../src/simulation';
import { watchCaptures, captureMoment, dismissCapture } from '../src/capture-presentation';
import { publishGameEvent } from '../src/game-events';

it('presents a real tag without changing scoring, actors or subsequent saves; newer effects own their lifetime', () => {
  const s = newGame('tag-feedback', 20, 'seeker');
  s.phase = 'search';
  s.committed = 0;
  Object.assign(s.actors[1], { station: 0, x: s.actors[0].x + 1, y: s.actors[0].y });
  const control = deserialize(serialize(s));
  let now = 100;
  watchCaptures(s, () => now);
  watchCaptures(s, () => now);
  expect(tag(s)).toBeNull();
  expect(tag(control)).toBeNull();
  expect(serialize(s)).toBe(serialize(control));
  expect(captureMoment(s, now)?.tagger).toBe(0);
  now = 130;
  publishGameEvent(s, { type: 'capture', time: s.time, text: '', actor: 0 });
  expect(captureMoment(s, 1901)).not.toBeNull();
  expect(captureMoment(s, 1931)).toBeNull();
  expect(serialize(s)).toBe(serialize(control));
  expect(s.actors.map((a) => [a.x, a.y])).toEqual(control.actors.map((a) => [a.x, a.y]));
});
it('does not replay historical captures, fabricate a tag for a timeout, or resist Continue', () => {
  const s = newGame('tag-lifecycle', 20);
  s.events.push({ type: 'capture', time: 0, text: 'Old capture', actor: 1 });
  watchCaptures(s, () => 0);
  expect(captureMoment(s, 0)).toBeNull();
  finishRound(s, 'Search time limit reached');
  expect(captureMoment(s, 0)).toBeNull();
  s.settings.reducedMotion = true;
  publishGameEvent(s, { type: 'capture', time: 0, text: '', actor: 1 });
  expect(captureMoment(s, 0)?.until).toBe(1200);
  dismissCapture(s);
  expect(captureMoment(s, 0)).toBeNull();
});
