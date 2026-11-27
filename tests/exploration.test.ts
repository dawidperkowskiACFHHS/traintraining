import { describe, it, expect } from 'vitest';
import {
  newGame,
  startRound,
  tick,
  toggleHide,
  seekerView,
  tag,
  serialize,
  deserialize,
} from '../src/simulation';
import { canSeeActor, coverAt, lineOfSight, pathfind } from '../src/local';
import { regionalPosition } from '../src/transit';
import { generateWorld, route } from '../src/world';

function coverScenario() {
  const state = newGame('cover-rules', 20);
  state.phase = 'search';
  state.time = state.searchAt = 130;
  state.committed = 2;
  state.localAt = 130;
  const town = state.world.stations[2].local;
  town.tiles.fill(1);
  town.buildings = [];
  town.props = [];
  town.cover = [{ kind: 'bush', x: 6.5, y: 6.5, hide: { x: 6.5, y: 6.5 } }];
  town.spots = [{ x: 6.5, y: 6.5 }];
  for (const actor of state.actors) actor.nextThink = 9999;
  Object.assign(state.actors[0], { station: 2, x: 6.5, y: 6.5 });
  Object.assign(state.actors[1], { station: 2, x: 3.5, y: 6.5 });
  Object.assign(state.actors[2], { station: 2, x: 2.5, y: 6.5 });
  return state;
}

describe('organic geography', () => {
  it('has no settlement rows or columns and retains connected scheduled journeys', () => {
    const world = generateWorld('organic-geography', 40);
    expect(new Set(world.stations.map((station) => Math.round(station.x))).size).toBeGreaterThan(20);
    expect(new Set(world.stations.map((station) => Math.round(station.y))).size).toBeGreaterThan(20);
    expect(world.edges.every((edge) => !!edge.bend)).toBe(true);
    for (const station of world.stations) {
      if (station.id) expect(route(world, 0, station.id, 0).at(-1)?.to).toBe(station.id);
      expect(station.local.cover!.length).toBeGreaterThanOrEqual(3);
      for (const cover of station.local.cover!)
        expect(pathfind(station.local, station.local.platform, cover.hide).length).toBeGreaterThan(0);
    }
  });
  it('places travelers on the curved railway geometry rather than its straight chord', () => {
    const state = newGame('curved-trip', 20),
      edge = state.world.edges[0],
      actor = state.actors[0];
    const from = state.world.stations[edge.a],
      to = state.world.stations[edge.b];
    actor.station = edge.a;
    actor.journey = [{ from: edge.a, to: edge.b, depart: 0, arrive: 20, line: edge.line, kind: edge.kind }];
    const midpoint = regionalPosition(state.world, actor, 10);
    expect(midpoint.x).toBeCloseTo(from.x * 0.25 + edge.bend!.x * 0.5 + to.x * 0.25);
    expect(midpoint.y).toBeCloseTo(from.y * 0.25 + edge.bend!.y * 0.5 + to.y * 0.25);
    expect(Math.hypot(midpoint.x - (from.x + to.x) / 2, midpoint.y - (from.y + to.y) / 2)).toBeGreaterThan(
      0.01,
    );
  });
});

describe('sprinting and physical cover', () => {
  it('runs 1.65 times as fast, normalizes diagonals, and respects pause and movement locks', () => {
    const walk = newGame('sprint-rules', 20);
    startRound(walk);
    walk.actors.forEach((actor) => (actor.nextThink = 9999));
    const run = deserialize(serialize(walk)),
      diagonal = deserialize(serialize(walk));
    const origin = { x: walk.actors[0].x, y: walk.actors[0].y };
    tick(walk, 0.2, { x: 1, y: 0 });
    tick(run, 0.2, { x: 1, y: 0, sprint: true });
    tick(diagonal, 0.2, { x: 1, y: 1, sprint: true });
    expect(run.actors[0].x - origin.x).toBeCloseTo((walk.actors[0].x - origin.x) * 1.65);
    expect(Math.hypot(diagonal.actors[0].x - origin.x, diagonal.actors[0].y - origin.y)).toBeCloseTo(
      run.actors[0].x - origin.x,
    );
    const stopped = run.actors[0].x;
    run.paused = true;
    tick(run, 1, { x: 1, y: 0, sprint: true });
    expect(run.actors[0].x).toBe(stopped);
    run.paused = false;
    run.locked = true;
    run.relocating = true;
    tick(run, 0.2, { x: 1, y: 0, sprint: true });
    expect(run.actors[0].x).toBe(stopped);
  });
  it('conceals a stationary hider but permits a close inspection and tag', () => {
    const state = coverScenario(),
      town = state.world.stations[2].local;
    expect(lineOfSight(town, state.actors[1], state.actors[0])).toBe(true);
    expect(toggleHide(state)).toBeNull();
    expect(seekerView(state, 1).visibleHider).toBeNull();
    expect(tag(state, 1)).not.toBeNull();
    state.actors[1].x = 5.4;
    expect(seekerView(state, 1).visibleHider).not.toBeNull();
    expect(tag(state, 1)).toBeNull();
    expect(state.phase).toBe('results');
  });
  it('breaks cover on movement, allows leaving it explicitly, and refuses hiding in open ground', () => {
    const state = coverScenario();
    state.actors[1].station = 0;
    expect(toggleHide(state)).toBeNull();
    tick(state, 0.1, { x: 1, y: 0, sprint: true });
    expect(state.actors[0].hiding).toBe(false);
    Object.assign(state.actors[0], { x: 6.5, y: 6.5 });
    expect(toggleHide(state)).toBeNull();
    expect(toggleHide(state)).toBeNull();
    state.actors[0].x = 10.5;
    expect(toggleHide(state)).toContain('bush');
  });
  it('keeps the chosen cover when seekers arrive instead of moving the hider elsewhere', () => {
    const state = coverScenario();
    state.localAt = null;
    toggleHide(state);
    tick(state, 0.1);
    expect(state.locked).toBe(true);
    expect(state.hideSpot).toEqual({ x: 6.5, y: 6.5 });
    expect(state.actors[0].hiding).toBe(true);
    expect(coverAt(state.world.stations[2].local, state.actors[0])).toBeDefined();
  });
  it('lets an autonomous seeker inspect cover without revealing its secret position first', () => {
    const state = coverScenario();
    state.locked = true;
    state.questionReady = 9999;
    state.actors[1].nextThink = state.time;
    toggleHide(state);
    expect(seekerView(state, 1).visibleHider).toBeNull();
    for (let step = 0; step < 40 && state.phase === 'search'; step++) tick(state, 0.2);
    expect(state.phase).toBe('results');
    expect(state.results[0].reason).toContain('Mira');
  });
  it('makes sprinting easier to spot and physical objects block sight and tags', () => {
    const state = coverScenario(),
      town = state.world.stations[2].local;
    state.actors[1].x = 14.5;
    expect(canSeeActor(town, state.actors[1], state.actors[0])).toBe(false);
    state.actors[0].sprinting = true;
    expect(canSeeActor(town, state.actors[1], state.actors[0])).toBe(true);
    town.tiles[6 * town.width + 7] = 10;
    expect(lineOfSight(town, state.actors[1], state.actors[0])).toBe(false);
  });
  it('keeps cover in saves and supplies controls for older match saves', () => {
    const state = coverScenario();
    toggleHide(state);
    expect(deserialize(serialize(state)).actors[0].hiding).toBe(true);
    const old = JSON.parse(serialize(state));
    delete old.settings.bindings.sprint;
    delete old.settings.bindings.hide;
    old.actors.forEach((actor: Record<string, unknown>) => {
      delete actor.hiding;
      delete actor.sprinting;
    });
    const restored = deserialize(JSON.stringify(old));
    expect(restored.settings.bindings.hide).toBe('KeyH');
    expect(restored.actors[0].hiding).toBe(false);
  });
});
