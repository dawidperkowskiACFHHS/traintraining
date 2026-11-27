import type { World, Actor, Point, Question } from './types';
import { QUESTIONS, informationGain } from './questions';
import { walkingDistances, inspectionPoints } from './local';
import { route } from './world';
export interface SeekerView {
  world: World;
  time: number;
  self: Actor;
  partner: Actor;
  candidates: number[];
  visibleHider: Point | null;
  legalQuestions: string[];
  questionOrder?: string[];
  command: string;
  commandTarget: number;
  commandPoint: Point | null;
  errand: { station: number; x: number; y: number } | null;
}
export interface Plan {
  kind: 'tag' | 'travel' | 'walk' | 'question' | 'clear' | 'report';
  target?: number;
  point?: Point;
  question?: string;
  text?: string;
}
// The observation contract deliberately contains no secret district, hider actor or position.
export function seekerPlan(v: SeekerView): Plan {
  const { self: a, world: w } = v,
    t = w.stations[a.station].local;
  if (v.visibleHider) {
    if (Math.hypot(v.visibleHider.x - a.x, v.visibleHider.y - a.y) <= 1.3) return { kind: 'tag' };
    return { kind: 'walk', point: v.visibleHider };
  }
  if (v.errand && (v.command === 'Handle this curse' || a.id === 1 || !v.partner.path.length))
    return v.errand.station === a.station
      ? { kind: 'walk', point: v.errand }
      : { kind: 'travel', target: v.errand.station };
  const qs: Question[] = QUESTIONS.filter((q) => v.legalQuestions.includes(q.id));
  const ranked = qs
    .map((q) => ({
      q,
      gain:
        informationGain(w, v.candidates, q, a.station, a.previous) +
        ((v.questionOrder?.length ?? 22) - (v.questionOrder?.indexOf(q.id) ?? 0)) * 0.0015,
    }))
    .sort((x, y) => y.gain - x.gain);
  if (ranked[0]?.gain > 0.12) return { kind: 'question', question: ranked[0].q.id };
  if (v.command === 'Meet at this station' && a.station !== v.commandTarget)
    return { kind: 'travel', target: v.commandTarget };
  if (v.command === 'Meet at this station')
    return {
      kind: 'report',
      text: `I’m waiting at ${w.stations[a.station].name}. Ready for your next plan.`,
    };
  if (v.command === 'Follow me' && a.id !== v.partner.id) {
    if (a.station !== v.partner.station) return { kind: 'travel', target: v.partner.station };
    if (Math.hypot(a.x - v.partner.x, a.y - v.partner.y) > 3)
      return { kind: 'walk', point: { x: v.partner.x, y: v.partner.y } };
    return { kind: 'report', text: 'I’m with you. We can compare clues as we walk.' };
  }
  if (['Search this area', 'Inspect this location'].includes(v.command) && a.station !== v.commandTarget)
    return { kind: 'travel', target: v.commandTarget };
  if (v.command === 'Inspect this location' && v.commandPoint) {
    if (Math.hypot(a.x - v.commandPoint.x, a.y - v.commandPoint.y) > 0.6)
      return {
        kind: 'walk',
        point: v.commandPoint,
        target: t.spots.findIndex((p) => p.x === v.commandPoint!.x && p.y === v.commandPoint!.y),
      };
    return {
      kind: 'report',
      text: 'I inspected the location you marked. No one in clear view here. What shall we try next?',
    };
  }
  if (
    v.command === 'Search this area' ||
    v.command === 'Inspect this location' ||
    v.candidates.includes(a.station)
  ) {
    const costs = walkingDistances(t, a);
    const list = inspectionPoints(t)
      .map((p, i) => ({
        p,
        i,
        cost:
          costs[Math.floor(p.y) * t.width + Math.floor(p.x)] +
          (v.partner.station === a.station && v.partner.target === i ? 100 : 0),
      }))
      .filter(
        (p) => !a.searched.includes(p.i) && costs[Math.floor(p.p.y) * t.width + Math.floor(p.p.x)] >= 0,
      );
    list.sort(
      (x, y) => x.cost + (x.i % 2 === a.id % 2 ? 0 : 12) - (y.cost + (y.i % 2 === a.id % 2 ? 0 : 12)),
    );
    if (list.length) return { kind: 'walk', point: list[0].p, target: list[0].i };
    if (v.command === 'Search this area' || v.command === 'Inspect this location')
      return {
        kind: 'report',
        text: 'I checked the accessible rooms and courtyards here. Let’s review our evidence.',
      };
  }
  const candidates = v.candidates.filter((c) => c !== a.station && !a.visited.includes(c));
  const possible = candidates.length ? candidates : v.candidates.filter((c) => c !== a.station);
  const target = possible
    .map((id) => ({
      id,
      cost:
        (route(w, a.station, id, v.time).at(-1)?.arrive || Infinity) -
        v.time +
        (v.partner.destination === id ? 45 : 0),
    }))
    .sort((x, y) => x.cost - y.cost || ((x.id + a.id) % 7) - ((y.id + a.id) % 7))[0];
  return target
    ? { kind: 'travel', target: target.id }
    : {
        kind: 'report',
        text: 'We have checked this district. Try another question or review the postcards.',
      };
}
