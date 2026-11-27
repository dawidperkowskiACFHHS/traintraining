import type { World, Station, Edge, Leg, Archetype } from './types';
import { hash, random, distance } from './random';
import { makeTown, reachableTiles } from './local';
import { nextService } from './service-conditions';
export const KIND_NAMES: Record<Archetype, string> = {
  city: 'City district',
  market: 'Market town',
  coast: 'Coastal town',
  lake: 'Lakeside village',
  forest: 'Forest village',
  hill: 'Hillside town',
  rail: 'Railway district',
  rural: 'Rural stop',
};
export const LINE_NAMES = [
  'Fern local',
  'Sunset local',
  'Bay express',
  'Cross-country',
  'Footpath',
  'Ferry',
  'Country bus',
];
export const LINE_COLORS = ['#5c9f76', '#d69058', '#5b8eae', '#be7984', '#849181', '#679ca5', '#c4a36b'];
const names = [
  'Bellwether',
  'Mossbrook',
  'Apricot',
  'Foxglove',
  'Saltmere',
  'Briar Glen',
  'Willowby',
  'Cloverfield',
  'Copperwick',
  'Dandelion',
  'Fern Hollow',
  'Goldfinch',
  'Honeywell',
  'Ivybridge',
  'Juniper',
  'Kingfisher',
  'Larkspur',
  'Marigold',
  'Northbank',
  'Otterford',
  'Pinevale',
  'Quince',
  'Rosewater',
  'Sunmeadow',
  'Thistledown',
  'Umber Yard',
  'Valewood',
  'Westhaven',
  'Yarrow',
  'Zephyr Bay',
  'Amberley',
  'Birchcross',
  'Cinderhill',
  'Dewford',
  'Elm Quay',
  'Flint Row',
  'Gorse End',
  'Hazelton',
  'Indigo',
  'Jade Lake',
];
export function generateWorld(seed: string, count = 30): World {
  if (![20, 30, 40].includes(count)) throw new Error('Region must contain 20, 30 or 40 stations');
  const r = { rng: hash(seed) },
    stations: Station[] = [],
    edges: Edge[] = [];
  const points = [{ x: 43 + random(r) * 8, y: 43 + random(r) * 8 }];
  const centers = [
    { x: 23, y: 23 },
    { x: 59, y: 30 },
    { x: 31, y: 73 },
    { x: 72, y: 71 },
  ];
  // Best-candidate sampling within settlement clusters: separation without rows or columns.
  while (points.length < count) {
    let best = { x: 0, y: 0 },
      quality = -Infinity;
    for (let sample = 0; sample < 40; sample++) {
      const center = centers[Math.floor(random(r) * centers.length)];
      const angle = random(r) * Math.PI * 2,
        radius = Math.sqrt(random(r)) * 29;
      const candidate = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
      if (candidate.x < 10 || candidate.x > 82 || candidate.y < 10 || candidate.y > 89) continue;
      if (
        Math.hypot((candidate.x - 63) / 1.5, candidate.y - 29) < 7 ||
        Math.hypot(candidate.x - 27, candidate.y - 57) < 7
      )
        continue;
      const spacing = Math.min(...points.map((p) => distance(p, candidate)));
      if (spacing > quality) {
        quality = spacing;
        best = candidate;
      }
    }
    points.push(best);
  }
  const kinds: Archetype[] = ['city', 'market', 'forest', 'hill', 'rail', 'rural'];
  const shift = Math.floor(random(r) * 40);
  points.forEach((point, i) => {
    const kind: Archetype =
      i === 0
        ? 'city'
        : point.x > 75
          ? 'coast'
          : distance(point, { x: 63, y: 29 }) < 17
            ? 'lake'
            : kinds[Math.floor(random(r) * kinds.length)];
    const layout = Math.floor(random(r) * 6),
      roof = Math.floor(random(r) * 4);
    stations.push({
      id: i,
      name: names[(i + shift) % names.length],
      ...point,
      kind,
      zone: point.y < 50 ? 'North country' : 'South country',
      line: point.x < 48 ? 0 : 1,
      layout,
      roof,
      landmark:
        kind === 'coast'
          ? 'Lighthouse'
          : kind === 'forest'
            ? 'Ancient oak'
            : kind === 'hill'
              ? 'Windmill'
              : kind === 'lake'
                ? 'Boathouse'
                : kind === 'rail'
                  ? 'Water tower'
                  : 'Clock garden',
      local: makeTown(seed + ':' + i, kind, layout, roof),
    });
  });
  const add = (a: number, b: number, kind: Edge['kind'] = 'local', line?: number) => {
    if (
      a === b ||
      edges.some((e) => ((e.a === a && e.b === b) || (e.a === b && e.b === a)) && e.kind === kind)
    )
      return;
    const first = stations[a],
      last = stations[b],
      length = distance(first, last);
    const curve = (random(r) - 0.5) * 0.35;
    edges.push({
      a,
      b,
      kind,
      line: line ?? ((first.x + last.x) / 2 < 48 ? 0 : 1),
      duration: Math.round(
        kind === 'walk'
          ? 18 + length * 1.2
          : kind === 'express'
            ? 10 + length * 0.3
            : kind === 'ferry'
              ? 15 + length * 0.65
              : 9 + length * 0.52,
      ),
      every: kind === 'walk' ? 1 : kind === 'express' ? 24 : kind === 'ferry' ? 20 : 12,
      offset: Math.floor(random(r) * 6),
      bend: {
        x: (first.x + last.x) / 2 - (last.y - first.y) * curve,
        y: (first.y + last.y) / 2 + (last.x - first.x) * curve,
      },
    });
  };
  // A minimum-distance backbone guarantees connectivity; nearby branches add alternate routes.
  const connected = new Set([0]);
  while (connected.size < count) {
    let pair = [0, 1],
      shortest = Infinity;
    for (const a of connected)
      for (let b = 0; b < count; b++)
        if (!connected.has(b)) {
          const d = distance(stations[a], stations[b]);
          if (d < shortest) {
            shortest = d;
            pair = [a, b];
          }
        }
    add(pair[0], pair[1]);
    connected.add(pair[1]);
  }
  for (const a of stations) {
    const nearest = stations
      .filter(
        (b) =>
          a.id !== b.id &&
          !edges.some((edge) => (edge.a === a.id && edge.b === b.id) || (edge.b === a.id && edge.a === b.id)),
      )
      .sort((x, y) => distance(a, x) - distance(a, y));
    const degree = edges.filter((e) => e.a === a.id || e.b === a.id).length;
    if (degree < 3) for (const b of nearest.slice(0, degree < 2 ? 2 : 1)) add(a.id, b.id);
  }
  for (const [index, center] of centers.entries()) {
    const target = [...stations]
      .filter((s) => s.id !== 0)
      .sort((a, b) => distance(a, center) - distance(b, center))[0];
    add(0, target.id, 'express', 2 + (index % 2));
  }
  const coast = stations.filter((s) => s.kind === 'coast').sort((a, b) => a.y - b.y);
  for (let i = 1; i < coast.length; i++) add(coast[i - 1].id, coast[i].id, 'ferry', 5);
  for (const a of stations.filter((s) => s.id % 7 === 0)) {
    const b = [...stations].filter((s) => s.id !== a.id).sort((x, y) => distance(a, x) - distance(a, y))[0];
    if (distance(a, b) < 17) add(a.id, b.id, 'walk', 4);
  }
  for (const station of stations.filter((station) => station.id % 5 === 2)) {
    const nearby = [...stations]
      .filter((other) => other.id !== station.id)
      .sort((a, b) => distance(a, station) - distance(b, station))[0];
    add(station.id, nearby.id, 'bus', 6);
  }
  const world: World = {
    seed,
    stations,
    edges,
    landmarks: [
      { name: 'Bellwether hub', x: stations[0].x, y: stations[0].y, kind: 'hub' },
      { name: 'Lake Lumen', x: 63, y: 29, kind: 'lake' },
      { name: 'Mount Button', x: 27, y: 57, kind: 'hill' },
      { name: 'Oldwood park', x: 15, y: 37, kind: 'park' },
    ],
  };
  const errors = validateWorld(world);
  if (errors.length) throw new Error(errors.join('; '));
  return world;
}
export function route(world: World, from: number, to: number, time: number): Leg[] {
  if (from === to) return [];
  const n = world.stations.length,
    d = Array(n).fill(Infinity),
    done = new Set<number>(),
    back: (Leg | undefined)[] = Array(n);
  d[from] = time;
  for (let i = 0; i < n; i++) {
    let a = -1;
    for (let j = 0; j < n; j++) if (!done.has(j) && (a === -1 || d[j] < d[a])) a = j;
    if (a === to || a === -1 || !Number.isFinite(d[a])) break;
    done.add(a);
    for (const e of world.edges) {
      if (e.a !== a && e.b !== a) continue;
      const b = e.a === a ? e.b : e.a;
      const leg = nextService(world,e,a,b,d[a]);
      const arrive = leg.arrive;
      if (arrive < d[b]) {
        d[b] = arrive;
        back[b] = leg;
      }
    }
  }
  const legs: Leg[] = [];
  let cur = to;
  while (cur !== from) {
    const leg = back[cur];
    if (!leg) return [];
    legs.push(leg);
    cur = leg.from;
  }
  return legs.reverse();
}
export function validateWorld(w: World): string[] {
  const errors: string[] = [];
  for (const s of w.stations) {
    if (s.id !== 0 && !route(w, 0, s.id, 0).length) errors.push('Disconnected station ' + s.id);
    if (s.local.spots.length < 4) errors.push('Too few hiding spots ' + s.id);
    const reachable = reachableTiles(s.local, s.local.platform);
    for (const p of [s.local.attraction, s.local.bridge, s.local.bench, s.local.scenic, ...s.local.spots])
      if (!reachable[Math.floor(p.y) * s.local.width + Math.floor(p.x)])
        errors.push('Unreachable location ' + s.id);
  }
  if (w.stations.filter((s) => route(w, 0, s.id, 12).at(-1)?.arrive! < 100).length < 4)
    errors.push('Too few head-start choices');
  return errors;
}
export const km = (w: World, a: number, b: number) => distance(w.stations[a], w.stations[b]);
