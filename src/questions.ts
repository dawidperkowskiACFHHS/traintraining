import type { Question, World, Category, State, Evidence } from './types';
import { distance } from './random';
import { km } from './world';
import { inTransit } from './transit';
const rewards: Record<Category, [number, number]> = {
  Matching: [3, 1],
  Measuring: [3, 1],
  Radar: [2, 1],
  Thermometer: [2, 1],
  Tentacles: [4, 2],
  Photo: [1, 1],
};
export const QUESTIONS: Question[] = [];
function add(
  category: Category,
  id: string,
  title: string,
  arg: string | number,
  anchor: Question['anchor'] = 'station',
) {
  const [draw, keep] = rewards[category];
  QUESTIONS.push({ id, category, title, arg, anchor, draw, keep });
}
add('Matching', 'zone', 'Are we in the same half of the region?', 'zone', 'district');
add('Matching', 'kind', 'Is your district the same type as mine?', 'kind', 'district');
add('Matching', 'line', 'Do our stations share a home railway line?', 'line');
add('Matching', 'name', 'Does your station name start A–M?', 'name');
add('Matching', 'landmark', 'Do we have the same district landmark?', 'landmark', 'district');
for (const [k, label] of [
  ['coast', 'the eastern coastline'],
  ['lake', 'Lake Lumen'],
  ['hub', 'Bellwether hub'],
  ['hill', 'Mount Button'],
  ['park', 'Oldwood park'],
])
  add('Measuring', `measure-${k}`, `Are you nearer ${label} than I am?`, k);
for (const r of [12, 25, 40, 60])
  add('Radar', `radar-${r}`, `Is your hiding station within ${r} km of my station?`, r);
add('Thermometer', 'warmer', 'Did my last station journey bring me closer?', 'warmer');
add(
  'Thermometer',
  'much-warmer',
  'Did my last station journey bring me at least 10 km closer?',
  'much-warmer',
);
add('Tentacles', 'landmarks', 'Which regional landmark is closest to your station?', 'landmarks');
add('Tentacles', 'terminals', 'Which line terminus is closest to your station?', 'terminals');
add('Tentacles', 'corners', 'Which region corner is closest to your station?', 'corners');
add('Photo', 'photo-station', 'Send a postcard of your station frontage.', 'station');
add('Photo', 'photo-landmark', 'Send a postcard of your district landmark.', 'landmark', 'district');
add('Photo', 'photo-position', 'Send a view of your immediate surroundings.', 'position', 'position');
export const CATEGORIES: Category[] = ['Matching', 'Measuring', 'Radar', 'Thermometer', 'Tentacles', 'Photo'];
export function valueAt(w: World, q: Question, origin: number, previous: number, hidden: number): string {
  const h = w.stations[hidden],
    o = w.stations[origin];
  if (q.category === 'Matching') {
    if (q.arg === 'name') return /^[A-M]/i.test(h.name) ? 'Yes' : 'No';
    const attr = q.arg as 'zone' | 'kind' | 'line' | 'landmark';
    return h[attr] === o[attr] ? 'Yes' : 'No';
  }
  if (q.category === 'Radar') return km(w, origin, hidden) <= Number(q.arg) ? 'Yes' : 'No';
  if (q.category === 'Thermometer')
    return km(w, previous, hidden) - km(w, origin, hidden) >= (q.arg === 'much-warmer' ? 10 : 0.001)
      ? 'Yes'
      : 'No';
  if (q.category === 'Measuring') {
    const feature = (id: number) => {
      const s = w.stations[id];
      if (q.arg === 'coast') return Math.abs(88 - s.x);
      const f = w.landmarks.find((l) => l.kind === q.arg)!;
      return distance(s, f);
    };
    return feature(hidden) < feature(origin) ? 'Yes' : 'No';
  }
  if (q.category === 'Tentacles') {
    const list =
      q.arg === 'landmarks'
        ? w.landmarks
        : q.arg === 'terminals'
          ? [w.stations[0], w.stations[4], w.stations.at(-5)!, w.stations.at(-1)!]
          : [
              { name: 'Northwest', x: 0, y: 0 },
              { name: 'Northeast', x: 100, y: 0 },
              { name: 'Southwest', x: 0, y: 100 },
              { name: 'Southeast', x: 100, y: 100 },
            ];
    return [...list].sort((a, b) => distance(a, h) - distance(b, h))[0].name;
  }
  if (q.arg === 'station') return ['Terracotta', 'Teal', 'Golden', 'Slate'][h.roof] + ' station roof';
  if (q.arg === 'landmark') return h.landmark;
  return 'A view from the current hiding position';
}
export function questionKey(id: string, origin: number, previous: number) {
  return `${id}:${origin}:${id === 'warmer' || id === 'much-warmer' ? previous : ''}`;
}
export function questionLegal(s: State, id: string, actor: number): string | null {
  const q = QUESTIONS.find((q) => q.id === id),
    a = s.actors[actor];
  if (!q) return 'Unknown question';
  if (s.phase !== 'search') return 'Questions open when the search begins.';
  if (actor === s.hider) return 'Hiders answer questions.';
  if (s.pending) return 'A question is already waiting for an answer.';
  if (inTransit(a, s.time)) return 'Wait until you disembark.';
  if (s.time < s.questionReady) return `Team cooldown: ${Math.ceil(s.questionReady - s.time)} seconds.`;
  const effect = s.effects.find((e) => e.slot === 'investigation');
  if (effect && [0, 1, 2, 6].includes(effect.card)) return 'Clear the investigation curse first.';
  if (effect?.card === 5 && effect.category === q.category) return `${q.category} is lost in brain fog.`;
  if (q.category === 'Thermometer' && (a.previous === a.station || km(s.world, a.previous, a.station) < 5))
    return 'First complete a journey of at least 5 km.';
  const key = questionKey(id, a.station, a.previous);
  if ((s.blocked[key] || 0) > s.time) return 'That question was canceled. Wait 60 seconds.';
  if (s.usedQuestions.includes(key)) return 'Already answered from this anchor. Travel before repeating.';
  return null;
}
export function resolveEvidence(s: State, id: string, origin: number, previous: number): Evidence {
  const q = QUESTIONS.find((q) => q.id === id)!,
    h = s.actors[s.hider],
    target = s.committed!;
  const answer = valueAt(s.world, q, origin, previous, target);
  const e: Evidence = {
    time: s.time,
    question: q.title,
    answer,
    category: q.category,
    origin,
    previous,
    anchor: q.anchor,
    excluded: s.candidates.filter((c) => valueAt(s.world, q, origin, previous, c) !== answer),
  };
  if (q.category === 'Photo')
    e.photo = {
      station: target,
      x:
        q.anchor === 'position'
          ? h.x
          : q.arg === 'station'
            ? s.world.stations[target].local.platform.x
            : s.world.stations[target].local.attraction.x,
      y:
        q.anchor === 'position'
          ? h.y
          : q.arg === 'station'
            ? s.world.stations[target].local.platform.y
            : s.world.stations[target].local.attraction.y,
      subject: String(q.arg),
    };
  return e;
}
// This function accepts a public belief set. It never receives the hider or a true target.
export function informationGain(
  w: World,
  candidates: number[],
  q: Question,
  origin: number,
  previous: number,
): number {
  const groups = new Map<string, number>();
  for (const c of candidates) {
    const a = valueAt(w, q, origin, previous, c);
    groups.set(a, (groups.get(a) || 0) + 1);
  }
  const n = candidates.length || 1;
  let gain = 0;
  for (const count of groups.values()) {
    const p = count / n;
    gain -= p * Math.log2(p);
  }
  return gain / (1 + q.keep * 0.2);
}
