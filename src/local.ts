import type { Town, Point, Archetype, Building, Actor } from './types';
import { hash, random } from './random';
import { districtPlan } from './districts';
export const TILE = 16;
export const REVEAL_RANGE = 1.6;
export const TAG_RANGE = 1.35;
export const SPRINT_MULTIPLIER = 1.65;
const directions = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;
const blocked = (tile: number) =>
  tile === 2 || tile === 3 || tile === 6 || tile === 7 || tile === 10 || tile === 11 || tile === 12;
export const walkable = (t: Town, x: number, y: number) =>
  x >= 0 &&
  y >= 0 &&
  x < t.width &&
  y < t.height &&
  !blocked(t.tiles[Math.floor(y) * t.width + Math.floor(x)]);
export function makeTown(seed: string, kind: Archetype, variant: number, roof: number): Town {
  const r = { rng: hash(seed) },
    w = 60,
    h = 44,
    tiles = Array(w * h).fill(0);
  const plan = districtPlan(seed, kind);
  const t: Town = {
    width: w,
    height: h,
    tiles,
    buildings: [],
    spots: [],
    platform: { ...plan.platform },
    attraction: { x: plan.landmark.x + 0.5, y: plan.landmark.y + 1.5 },
    bridge: { x: 30.5, y: 20.5 },
    bench: { x: plan.platform.x + 3, y: 35.5 },
    scenic: { ...plan.scenic },
    props: [],
    cover: [],
  };
  const rect = (x: number, y: number, rw: number, rh: number, v: number) => {
    for (let yy = y; yy < y + rh; yy++)
      for (let xx = x; xx < x + rw; xx++) if (xx >= 0 && yy >= 0 && xx < w && yy < h) tiles[yy * w + xx] = v;
  };
  rect(0, 0, w, 2, 7);
  rect(0, h - 2, w, 2, 7);
  rect(0, 0, 2, h, 7);
  rect(w - 2, 0, 2, h, 7);
  const phase = random(r) * Math.PI * 2;
  const road = (points: Point[], width = 3) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 2);
      for (let j = 0; j <= steps; j++) {
        const x = Math.round(a.x + ((b.x - a.x) * j) / steps),
          y = Math.round(a.y + ((b.y - a.y) * j) / steps);
        rect(x - Math.floor(width / 2), y - Math.floor(width / 2), width, width, 1);
      }
    }
  };
  for (const lane of plan.lanes) road(lane.points, lane.width);
  if (['forest', 'hill', 'rural', 'lake'].includes(kind)) {
    for (let x = 2; x < 58; x++) {
      const y = 21 + Math.round(Math.sin(x / 8 + phase) * 2);
      for (let dy = 0; dy < 2; dy++) {
        const at = (y + dy) * w + x;
        tiles[at] = tiles[at] === 1 ? 5 : 2;
      }
    }
    const bridges = tiles.map((tile, index) => ({ tile, index })).filter((p) => p.tile === 5);
    const bridge = bridges.sort((a, b) => Math.abs((a.index % w) - 30) - Math.abs((b.index % w) - 30))[0];
    if (bridge) t.bridge = { x: (bridge.index % w) + 0.5, y: Math.floor(bridge.index / w) + 0.5 };
  } else {
    for (let x = 25; x < 36; x++)
      for (let y = 20; y < 22; y++) tiles[y * w + x] = tiles[y * w + x] === 1 ? 5 : 2;
    t.bridge = { x: 30.5, y: 20.5 };
    rect(29, 20, 3, 2, 5);
  }
  if (kind === 'coast') {
    for (let y = 2; y < 40; y++) {
      const shore = 52 + Math.round(Math.sin(y / 6 + phase) * 2);
      rect(shore, y, 58 - shore, 1, 2);
      rect(shore - 2, y, 2, 1, 1);
    }
    rect(49, 16, 7, 3, 5);
    t.scenic = { x: 53.5, y: 17.5 };
  }
  if (kind === 'lake') {
    for (let y = 6; y <= 14; y++)
      for (let x = 38; x < 55; x++) if (((x - 46) / 8) ** 2 + ((y - 10) / 4.8) ** 2 < 1) rect(x, y, 1, 1, 2);
    rect(43, 12, 4, 4, 5);
    t.scenic = { x: 44.5, y: 15.5 };
  }
  const slots = plan.plots;
  slots.forEach(([x, y, bw, bh], i) => {
    if (kind === 'lake' && i === 2) return;
    x += Math.floor(random(r) * 5) - 2;
    y += Math.floor(random(r) * 3) - 1;
    if (variant % 2 && i < 3) y += 1;
    if (
      Array.from({ length: bh }, (_, dy) => tiles.slice((y + dy) * w + x, (y + dy) * w + x + bw))
        .flat()
        .some((tile) => tile === 2 || tile === 5)
    )
      return;
    const enter = i === 0 || i === 3 || i === 4;

    const b: Building = {
      x,
      y,
      w: bw,
      h: bh,
      kind: i === 0 ? 'cafe' : i === 3 ? 'library' : i === 4 ? 'home' : 'house',
      roof: (roof + (i % 2)) % 4,
      style: kind,
      door: { x: x + Math.floor(bw / 2) + 0.5, y: y + bh + 0.5 },
      interior: { x: x + Math.floor(bw / 2) + 0.5, y: y + bh - 2 + 0.5 },
    };
    rect(x, y, bw, bh, 3);
    if (enter) {
      rect(x + 1, y + 1, bw - 2, bh - 2, 4);
      rect(x + Math.floor(bw / 2), y + bh - 1, 1, 2, 4);
      t.spots.push({ ...b.interior });
    }
    t.buildings.push(b);
    rect(Math.floor(b.door.x), Math.floor(b.door.y), 1, 1, 1);
    t.spots.push({ x: x - 0.5, y: y + bh - 0.5 });
  });
  // District platforms occupy different ends of their street networks.
  const platformLeft = Math.floor(t.platform.x) - 10;
  rect(platformLeft, 35, 21, 4, 9);
  rect(2, 40, 56, 2, 6);
  road([t.platform, { x: t.platform.x, y: 39 }], 3);
  t.props.push(
    { kind: 'station', x: platformLeft + 1, y: 35 },
    { kind: 'bench', x: t.platform.x + 3, y: 35 },
    { kind: 'sign', x: t.platform.x - 1, y: 34 },
    { kind: 'clock', x: platformLeft + 18, y: 35 },
    { kind: 'landmark', ...plan.landmark },
    { kind: 'flowers', x: t.platform.x - 6, y: 33 },
    { kind: 'lamp', x: t.platform.x - 3, y: 33 },
    { kind: 'suitcase', x: t.platform.x + 7, y: 36 },
  );
  rect(plan.landmark.x, plan.landmark.y, 1, 1, 3);
  const stalls = plan.stalls.length ? plan.stalls : [{ x: 20, y: 17 }];
  for (const stall of stalls) {
    if (![0, 1].includes(tiles[stall.y * w + stall.x])) continue;
    t.props.push({ kind: 'market', ...stall });
    rect(stall.x, stall.y, 2, 1, 3);
  }
  for (const barrier of plan.barriers)
    for (let i = 0; i < barrier.length; i++) {
      const x = barrier.x + (barrier.vertical ? 0 : i),
        y = barrier.y + (barrier.vertical ? i : 0);
      if (tiles[y * w + x] === 0) rect(x, y, 1, 1, barrier.stone ? 12 : 11);
    }
  if (kind === 'rural')
    for (let y = 25; y < 32; y += 2)
      for (let x = 24; x < 32; x += 2) if (tiles[y * w + x] === 0) t.props.push({ kind: 'crop', x, y });
  // Small paths join offset doorways to the nearest street on their side of the river.
  for (const b of t.buildings) {
    let lane: Point | null = null,
      nearest = Infinity;
    for (let y = 3; y < 35; y++)
      for (let x = 3; x < 56; x++) {
        if (tiles[y * w + x] !== 1) continue;
        const d = (x + 0.5 - b.door.x) ** 2 + (y + 0.5 - b.door.y) ** 2;
        if (d > 4 && d < nearest) {
          nearest = d;
          lane = { x: x + 0.5, y: y + 0.5 };
        }
      }
    if (lane)
      for (const point of pathfind(t, b.door, lane))
        if (tiles[Math.floor(point.y) * w + Math.floor(point.x)] === 0)
          rect(Math.floor(point.x), Math.floor(point.y), 1, 1, 1);
  }
  // Cover uses the same positions for art, interaction and NPC inspection.
  const coverCandidates = plan.lanes
    .flatMap((lane) => lane.points)
    .map((point, index) => ({ x: Math.round(point.x) + (index % 2 ? 2 : -2), y: Math.round(point.y) + 1 }))
    .filter(
      (point) =>
        point.x > 3 &&
        point.x < 55 &&
        point.y > 3 &&
        point.y < 34 &&
        Math.hypot(point.x - t.platform.x, point.y - t.platform.y) > 5,
    );
  coverCandidates.forEach((point, index) => {
    const x = point.x,
      y = point.y;
    if (!walkable(t, x + 0.5, y + 0.5) || [2, 4, 5, 9].includes(tiles[y * w + x])) return;
    const kind = index % 3 === 0 ? 'crate' : index % 3 === 1 ? 'hedge' : 'bush';
    const hide = kind === 'crate' ? { x: x + 0.5, y: y - 0.5 } : { x: x + 0.5, y: y + 0.5 };
    if (!walkable(t, hide.x, hide.y)) return;
    if (kind === 'crate') rect(x, y, 1, 1, 10);
    t.cover!.push({ kind, x: x + 0.5, y: y + 0.5, hide });
    t.spots.push(hide);
  });
  const trees =
    kind === 'forest' ? 190 : kind === 'rural' ? 75 : ['city', 'market', 'rail'].includes(kind) ? 15 : 45;
  for (let i = 0; i < trees; i++) {
    const x = 3 + Math.floor(random(r) * 53),
      y = 3 + Math.floor(random(r) * 35);
    if (
      tiles[y * w + x] === 0 &&
      tiles[(y + 1) * w + x] === 0 &&
      !t.spots.some((p) => Math.hypot(p.x - x, p.y - y) < 2) &&
      ![t.attraction, t.bridge, t.bench, t.scenic].some((p) => Math.hypot(p.x - x, p.y - y) < 2)
    ) {
      rect(x, y, 1, 1, 7);
    }
  }
  for (let i = 0; i < 100; i++) {
    const x = 3 + Math.floor(random(r) * 53),
      y = 3 + Math.floor(random(r) * 35);
    if (tiles[y * w + x] === 0) t.props.push({ kind: i % 4 ? 'grass' : 'flower', x, y });
  }
  t.spots.push(
    ...plan.lanes
      .flatMap((lane) => lane.points)
      .map((p) => ({ x: Math.floor(p.x) + 0.5, y: Math.floor(p.y) + 0.5 })),
  );
  // Keep only reachable positions; generation cannot create an inaccessible winning spot.
  const reachable = reachableTiles(t, t.platform);
  const reaches = (p: Point) => !!reachable[Math.floor(p.y) * w + Math.floor(p.x)];
  const nearest = (point: Point) => {
    if (reaches(point)) return point;
    let best = t.platform,
      cost = Infinity;
    for (let i = 0; i < reachable.length; i++)
      if (reachable[i]) {
        const candidate = { x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 };
        const d = Math.hypot(candidate.x - point.x, candidate.y - point.y);
        if (d < cost) {
          cost = d;
          best = candidate;
        }
      }
    return { ...best };
  };
  t.attraction = nearest(t.attraction);
  t.bridge = nearest(t.bridge);
  t.bench = nearest(t.bench);
  t.scenic = nearest(t.scenic);
  // A scenic errand must fit the existing 30-second added-walking budget from the station.
  const scenicPath = pathfind(t, t.platform, t.scenic);
  if (scenicPath.length > 44) t.scenic = { ...scenicPath[42] };
  t.props.push({ kind: 'flowers', x: t.scenic.x - 0.5, y: t.scenic.y - 0.5 });
  t.spots = t.spots.filter(reaches);
  t.cover = t.cover!.filter((cover) => reaches(cover.hide));
  return t;
}
export function reachableTiles(t: Town, from: Point) {
  const seen = new Uint8Array(t.width * t.height),
    queue = new Int32Array(t.width * t.height);
  if (!walkable(t, from.x, from.y)) return seen;
  const start = Math.floor(from.y) * t.width + Math.floor(from.x);
  seen[start] = 1;
  queue[0] = start;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const current = queue[head],
      x = current % t.width,
      y = Math.floor(current / t.width);
    for (const [dx, dy] of directions) {
      const nx = x + dx,
        ny = y + dy,
        index = ny * t.width + nx;
      if (nx < 0 || ny < 0 || nx >= t.width || ny >= t.height || seen[index] || blocked(t.tiles[index]))
        continue;
      seen[index] = 1;
      queue[tail++] = index;
    }
  }
  return seen;
}
export function walkingDistances(t: Town, from: Point) {
  const costs = new Int16Array(t.width * t.height).fill(-1),
    queue = new Int32Array(costs.length);
  if (!walkable(t, from.x, from.y)) return costs;
  const start = Math.floor(from.y) * t.width + Math.floor(from.x);
  costs[start] = 0;
  queue[0] = start;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const current = queue[head],
      x = current % t.width,
      y = Math.floor(current / t.width);
    for (const [dx, dy] of directions) {
      const nx = x + dx,
        ny = y + dy,
        index = ny * t.width + nx;
      if (
        nx < 0 ||
        ny < 0 ||
        nx >= t.width ||
        ny >= t.height ||
        costs[index] !== -1 ||
        blocked(t.tiles[index])
      )
        continue;
      costs[index] = costs[current] + 1;
      queue[tail++] = index;
    }
  }
  return costs;
}
export function pathfind(t: Town, from: Point, to: Point): Point[] {
  const sx = Math.floor(from.x),
    sy = Math.floor(from.y),
    tx = Math.floor(to.x),
    ty = Math.floor(to.y);
  if (!walkable(t, tx, ty) || !walkable(t, sx, sy)) return [];
  const start = sy * t.width + sx,
    end = ty * t.width + tx;
  if (start === end) return [{ x: tx + 0.5, y: ty + 0.5 }];
  const prev = new Int32Array(t.width * t.height).fill(-1),
    queue = [start];
  prev[start] = start;
  for (let k = 0; k < queue.length; k++) {
    const cur = queue[k];
    if (cur === end) break;
    const x = cur % t.width,
      y = Math.floor(cur / t.width);
    for (const [dx, dy] of directions) {
      const nx = x + dx,
        ny = y + dy,
        n = ny * t.width + nx;
      if (nx >= 0 && nx < t.width && ny >= 0 && ny < t.height && prev[n] === -1 && !blocked(t.tiles[n])) {
        prev[n] = cur;
        queue.push(n);
      }
    }
  }
  if (prev[end] === -1) return [];
  const out: Point[] = [];
  for (let cur = end; cur !== start; cur = prev[cur])
    out.push({ x: (cur % t.width) + 0.5, y: Math.floor(cur / t.width) + 0.5 });
  out.reverse();
  if (Math.hypot(from.x - sx - 0.5, from.y - sy - 0.5) > 0.001) out.unshift({ x: sx + 0.5, y: sy + 0.5 });
  return out;
}
export function lineOfSight(t: Town, a: Point, b: Point): boolean {
  const n = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) * 8);
  for (let i = 1; i < n; i++) {
    const x = a.x + ((b.x - a.x) * i) / n,
      y = a.y + ((b.y - a.y) * i) / n;
    if (!walkable(t, x, y)) return false;
  }
  return true;
}
export function insideBuilding(t: Town, p: Point): number | null {
  const i = t.buildings.findIndex((b) => p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h);
  return i < 0 ? null : i;
}
export function coverAt(t: Town, p: Point) {
  const marked = t.cover?.find((cover) => Math.hypot(p.x - cover.hide.x, p.y - cover.hide.y) < 0.85);
  if (marked) return marked;
  if (!walkable(t, p.x, p.y)) return undefined;
  const x = Math.floor(p.x),
    y = Math.floor(p.y);
  for (const [dx, dy] of directions) {
    const tx = x + dx,
      ty = y + dy,
      tile = t.tiles[ty * t.width + tx];
    if (tx < 2 || ty < 2 || tx >= t.width - 2 || ty >= t.height - 2) continue;
    if ([3, 7, 10, 11, 12].includes(tile))
      return {
        kind: tile === 7 ? ('tree' as const) : tile === 3 ? ('wall' as const) : ('object' as const),
        x: tx + 0.5,
        y: ty + 0.5,
        hide: { x: p.x, y: p.y },
      };
  }
  const object = t.props.find(
    (prop) =>
      ['bench', 'market', 'station', 'suitcase', 'sign', 'landmark'].includes(prop.kind) &&
      Math.hypot(p.x - prop.x - 0.5, p.y - prop.y - 0.5) < 1.35,
  );
  return object
    ? { kind: 'object' as const, x: object.x + 0.5, y: object.y + 0.5, hide: { x: p.x, y: p.y } }
    : undefined;
}
export function canSeeActor(t: Town, observer: Point, target: Actor, range = 7) {
  const distance = Math.hypot(observer.x - target.x, observer.y - target.y);
  return (
    distance < (target.sprinting ? range + 3 : range) &&
    !(target.hiding && coverAt(t, target) && distance > REVEAL_RANGE) &&
    lineOfSight(t, observer, target)
  );
}
const inspectionCache = new WeakMap<Town, Point[]>();
/** Cover every reachable hiding cell using public geometry, never the hider's position. */
export function inspectionPoints(t: Town): Point[] {
  const cached = inspectionCache.get(t);
  if (cached) return cached;
  const reachable = reachableTiles(t, t.platform);
  const unchecked = new Set<number>();
  const disks = [
    ...(t.cover ?? []).map((p) => ({ ...p.hide, radius: 0.85 })),
    ...t.props
      .filter((p) => ['bench', 'market', 'station', 'suitcase', 'sign', 'landmark'].includes(p.kind))
      .map((p) => ({ x: p.x + 0.5, y: p.y + 0.5, radius: 1.35 })),
  ];
  for (let i = 0; i < reachable.length; i++) {
    if (!reachable[i]) continue;
    const x = i % t.width,
      y = Math.floor(i / t.width);
    const intersects = disks.some(
      (p) =>
        Math.hypot(p.x - Math.max(x, Math.min(x + 1, p.x)), p.y - Math.max(y, Math.min(y + 1, p.y))) <
        p.radius,
    );
    if (intersects || coverAt(t, { x: x + 0.5, y: y + 0.5 })) unchecked.add(i);
  }
  const points = t.spots
    .filter((p) => reachable[Math.floor(p.y) * t.width + Math.floor(p.x)])
    .map((p) => ({ ...p }));
  const nearby = (p: Point) => {
    const cells: number[] = [];
    for (const [dx, dy] of [[0, 0], ...directions]) {
      const x = Math.floor(p.x) + dx,
        y = Math.floor(p.y) + dy,
        index = y * t.width + x;
      // All four corners of a walking cell must be within close-inspection reach.
      const far = Math.hypot(Math.abs(p.x - x - 0.5) + 0.5, Math.abs(p.y - y - 0.5) + 0.5);
      if (unchecked.has(index) && far < REVEAL_RANGE && lineOfSight(t, p, { x: x + 0.5, y: y + 0.5 }))
        cells.push(index);
    }
    return cells;
  };
  for (const p of points) for (const index of nearby(p)) unchecked.delete(index);
  while (unchecked.size) {
    const cell = unchecked.values().next().value!;
    const center = { x: (cell % t.width) + 0.5, y: Math.floor(cell / t.width) + 0.5 };
    let best = center,
      coverage = nearby(center);
    for (const [dx, dy] of directions) {
      const candidate = { x: center.x + dx, y: center.y + dy };
      if (!reachable[Math.floor(candidate.y) * t.width + Math.floor(candidate.x)]) continue;
      const covered = nearby(candidate);
      if (covered.length > coverage.length) {
        best = candidate;
        coverage = covered;
      }
    }
    points.push(best);
    for (const index of coverage) unchecked.delete(index);
  }
  inspectionCache.set(t, points);
  return points;
}
