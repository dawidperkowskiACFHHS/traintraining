import type { Edge, Leg, World } from './types';
import { hash } from './random';
const cache = new WeakMap<Edge, Map<number, Leg['service']>>();
function condition(w: World, e: Edge, scheduled: number): Leg['service'] {
  if (e.kind === 'walk') return;
  let items = cache.get(e);
  if (!items) {
    items = new Map();
    cache.set(e, items);
  }
  if (items.has(scheduled)) return items.get(scheduled);
  const value = hash(`${w.seed}:service:${e.a}:${e.b}:${scheduled}`),
    roll = value % 100;
  const result: Leg['service'] =
    roll < 11
      ? { mode: 'fast', seconds: Math.min(4, Math.max(1, Math.round(e.duration * 0.12))), scheduled }
      : roll < 17
        ? { mode: 'signal', seconds: 3 + ((value >>> 8) % 4), scheduled }
        : roll < 21
          ? { mode: 'repair', seconds: 6 + ((value >>> 8) % 5), scheduled }
          : undefined;
  if (items.size > 160) items.delete(items.keys().next().value!);
  items.set(scheduled, result);
  return result;
}
export function nextService(w: World, e: Edge, from: number, to: number, time: number): Leg {
  if (e.kind === 'walk')
    return { from, to, depart: time, arrive: time + e.duration, kind: e.kind, line: e.line };
  const first = Math.floor((time - e.offset) / e.every) * e.every + e.offset;
  let best: Leg | undefined;
  // Check the preceding delayed service and following departures: waiting for a
  // faster train must never make the earliest-arrival planner travel backwards.
  const lookahead = Math.min(16, Math.ceil(14 / e.every) + 3);
  for (let i = 0; i < lookahead; i++) {
    const scheduled = first + i * e.every,
      service = condition(w, e, scheduled);
    const depart = scheduled + (service?.mode === 'signal' ? service.seconds : 0);
    if (depart + 1e-7 < time) continue;
    const duration = Math.max(
      1,
      e.duration +
        (service?.mode === 'repair' ? service.seconds : service?.mode === 'fast' ? -service.seconds : 0),
    );
    const leg: Leg = { from, to, depart, arrive: depart + duration, kind: e.kind, line: e.line };
    if (service) leg.service = { ...service };
    if (!best || leg.arrive < best.arrive) best = leg;
  }
  return best!;
}
export function serviceStop(leg: Leg, time: number) {
  if (leg.service?.mode !== 'repair') return null;
  const moving = leg.arrive - leg.depart - leg.service.seconds,
    start = leg.depart + moving * 0.45;
  return time >= start && time < start + leg.service.seconds
    ? { remaining: start + leg.service.seconds - time, start }
    : null;
}
export function movingTime(leg: Leg, time: number) {
  const elapsed = Math.max(0, time - leg.depart);
  if (leg.service?.mode !== 'repair') return elapsed;
  const moving = leg.arrive - leg.depart - leg.service.seconds,
    start = moving * 0.45;
  return elapsed - Math.max(0, Math.min(leg.service.seconds, elapsed - start));
}
export function journeyProgress(leg: Leg, time: number) {
  const duration = leg.arrive - leg.depart - (leg.service?.mode === 'repair' ? leg.service.seconds : 0);
  return Math.max(0, Math.min(1, movingTime(leg, time) / Math.max(1, duration)));
}
export function serviceNote(leg: Leg) {
  const info = leg.service;
  return !info
    ? ''
    : info.mode === 'fast'
      ? `Fast service · ${info.seconds}s quicker`
      : info.mode === 'signal'
        ? `Signal delay · +${info.seconds}s`
        : `Brief repair stop · +${info.seconds}s`;
}
