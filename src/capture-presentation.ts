import type { State } from './types';
import { onGameEvent } from './game-events';
export interface CaptureMoment {
  at: number;
  until: number;
  tagger: number;
  hider: number;
  station: number;
  x: number;
  y: number;
}
const watching = new WeakSet<State>(),
  moments = new WeakMap<State, CaptureMoment>();
/** Only a new authoritative capture can start the presentation; loading results cannot replay it. */
export function watchCaptures(s: State, now = () => performance.now()) {
  if (watching.has(s)) return;
  watching.add(s);
  onGameEvent(s, (event) => {
    if (event.type !== 'capture') return;
    const actor = s.actors[s.hider],
      at = now();
    moments.set(s, {
      at,
      until: at + (s.settings.reducedMotion ? 1200 : 1800),
      tagger: event.actor ?? 0,
      hider: s.hider,
      station: actor.station,
      x: actor.x,
      y: actor.y,
    });
  });
}
export function captureMoment(s: State, now = performance.now()) {
  const moment = moments.get(s);
  return moment && now < moment.until ? moment : null;
}
export function dismissCapture(s: State) {
  moments.delete(s);
}
