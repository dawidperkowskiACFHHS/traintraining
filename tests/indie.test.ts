import { describe, it, expect } from 'vitest';
import { newGame, startRound, tick, travel, move, serialize, deserialize } from '../src/simulation';
import { coverAt, canSeeActor } from '../src/local';
import { freshSeed } from '../src/run';

describe('indie journey flow', () => {
  it('keeps the companion with a human leader instead of launching a solo chase', () => {
    const s = newGame('party-chase', 20, 'seeker');
    startRound(s);
    s.phase = 'search';
    s.localAt = s.time;
    const town = s.world.stations[0].local;
    town.tiles.fill(1);
    town.cover = [];
    town.buildings = [];
    town.props = [];
    s.actors.forEach((a) => (a.nextThink = 9999));
    Object.assign(s.actors[0], { x: 10.5, y: 10.5 });
    Object.assign(s.actors[2], { x: 11.5, y: 10.5, nextThink: s.time });
    Object.assign(s.actors[1], { x: 16.5, y: 10.5 });
    s.questionReady = s.cardReady = 9999;
    tick(s, 3);
    expect(s.phase).toBe('search');
    expect(Math.hypot(s.actors[2].x - s.actors[0].x, s.actors[2].y - s.actors[0].y)).toBeLessThan(2.5);
  });
  it('regroups separated seekers from older saves before continuing shared travel', () => {
    const s = newGame('legacy-separated-party', 20, 'seeker');
    startRound(s);
    s.phase = 'search';
    s.actors.forEach((a) => (a.nextThink = 9999));
    const leader = s.actors[0],
      mate = s.actors[2];
    mate.station = 1;
    Object.assign(mate, s.world.stations[1].local.platform);
    expect(travel(s, 2, leader.station, false)).toBeNull();
    tick(s, 0.2);
    expect(mate.journey.length).toBeGreaterThan(0);
    expect(mate.journey.at(-1)!.to).toBe(leader.station);
    expect(leader.journey).toEqual([]);
  });
  it('creates fresh layouts and repeatable seeded question preferences', () => {
    const seeds = Array.from({ length: 12 }, freshSeed);
    expect(new Set(seeds).size).toBe(12);
    const a = newGame(seeds[0]),
      b = newGame(seeds[1]);
    expect(a.world.stations.map((s) => [s.x, s.y])).not.toEqual(b.world.stations.map((s) => [s.x, s.y]));
    expect(a.questionOrder).not.toEqual(b.questionOrder);
    expect(a.questionOrder).toEqual(newGame(seeds[0]).questionOrder);
    expect(deserialize(serialize(a)).questionOrder).toEqual(a.questionOrder);
  });
  it('keeps control during head start and after local search begins', () => {
    const s = newGame('free-local-control', 20, 'seeker');
    startRound(s);
    s.actors.forEach((a) => (a.nextThink = 9999));
    const x = s.actors[0].x;
    move(s, 0, 1, 0, 0.1);
    expect(s.actors[0].x).toBeGreaterThan(x);
    s.hider = 0;
    s.phase = 'search';
    s.locked = true;
    s.relocating = false;
    const next = s.actors[0].x;
    move(s, 0, 1, 0, 0.1);
    expect(s.actors[0].x).toBeGreaterThan(next);
  });
  it('supports analog walking speed', () => {
    const a = newGame('analog-speed', 20);
    startRound(a);
    const b = deserialize(serialize(a));
    const x = a.actors[0].x;
    move(a, 0, 1, 0, 0.1);
    move(b, 0, 0.4, 0, 0.1);
    expect(b.actors[0].x - x).toBeCloseTo((a.actors[0].x - x) * 0.4);
  });
  it('recognizes unmarked walls, trees and street furniture as cover', () => {
    const s = newGame('unmarked-cover', 20),
      t = s.world.stations[0].local;
    t.tiles.fill(1);
    t.cover = [];
    t.props = [];
    for (const tile of [3, 7, 10]) {
      t.tiles[10 * t.width + 11] = tile;
      expect(coverAt(t, { x: 10.5, y: 10.5 })).toBeDefined();
    }
    t.tiles.fill(1);
    t.props = [{ kind: 'market', x: 10, y: 10 }];
    expect(coverAt(t, { x: 10.5, y: 11.5 })).toBeDefined();
    expect(coverAt(t, { x: 20.5, y: 20.5 })).toBeUndefined();
    Object.assign(s.actors[0], { x: 10.5, y: 11.5, hiding: true });
    expect(canSeeActor(t, { x: 10.5, y: 15.5 }, s.actors[0])).toBe(false);
  });
  it('boards the same service together and follows a walking human', () => {
    const s = newGame('paired-boarding', 20, 'seeker');
    startRound(s);
    s.phase = 'search';
    s.searchAt = s.time;
    s.actors.forEach((a) => (a.nextThink = 9999));
    s.actors[1].station = 19;
    const a = s.actors[0],
      mate = s.actors[2],
      p = s.world.stations[0].local.platform;
    Object.assign(a, p);
    Object.assign(mate, p);
    expect(travel(s, 0, 1)).toBeNull();
    tick(s, 0.2);
    expect(a.journey.length).toBeGreaterThan(0);
    expect(mate.journey).toEqual(a.journey);
    expect(s.events.some((e) => e.type === 'board' && e.actor === 2)).toBe(true);
    a.journey = [];
    mate.journey = [];
    a.destination = null;
    mate.destination = null;
    s.world.stations[0].local.tiles.fill(1);
    a.station = mate.station = 0;
    Object.assign(a, { x: 20.5, y: 20.5, path: [] });
    Object.assign(mate, { x: 14.5, y: 20.5, path: [] });
    tick(s, 1);
    expect(mate.x).toBeGreaterThan(14.5);
    expect(Math.hypot(a.x - mate.x, a.y - mate.y)).toBeLessThan(6);
  });
});
