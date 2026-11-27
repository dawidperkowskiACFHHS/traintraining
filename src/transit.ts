import type { Actor, World, Point } from './types';
import { journeyProgress } from './service-conditions';
export const inTransit = (a: Actor, time: number) =>
  !!a.journey.length && time >= a.journey[0].depart && time < a.journey[0].arrive;
export function regionalPosition(w: World, a: Actor, time: number): Point {
  const leg = a.journey[0];
  if (!leg || time < leg.depart) return { x: w.stations[a.station].x, y: w.stations[a.station].y };
  const from = w.stations[leg.from],
    to = w.stations[leg.to],
    t = journeyProgress(leg,time);
  const edge = w.edges.find(
    (e) =>
      e.kind === leg.kind &&
      e.line === leg.line &&
      ((e.a === leg.from && e.b === leg.to) || (e.b === leg.from && e.a === leg.to)),
  );
  const bend = edge?.bend ?? { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  return {
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * bend.x + t * t * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * bend.y + t * t * to.y,
  };
}
