import { describe, it, expect } from 'vitest';
import {
  newGame,
  startRound,
  move,
  tick,
  ask,
  travel,
  commit,
  toggleHide,
  playCard,
  finishRound,
  nextRound,
  serialize,
  deserialize,
  seekerView,
} from '../src/simulation';
import { configureSession } from '../src/session';
import { createCoach, advanceCoach } from '../src/coach';
import {
  storeMatch,
  recoverMatch,
  MATCH_KEY,
  BACKUP_KEY,
  readPreferences,
  PREFERENCES_KEY,
} from '../src/storage';
import { residentPositions, residentLine, districtRead } from '../src/residents';
import { pathfind, walkable } from '../src/local';
class MemoryStore implements Storage {
  values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  key(i: number) {
    return [...this.values.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  removeItem(k: string) {
    this.values.delete(k);
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
describe('release formats and explainable difficulty', () => {
  it('retains classic engine defaults and applies a shorter session explicitly', () => {
    const s = newGame('format');
    expect(s.rules.searchCap).toBe(600);
    expect(s.rules.targetPoints).toBeUndefined();
    configureSession(s, 'quick', 'relaxed');
    expect(s.rules.searchCap).toBe(360);
    expect(s.rules.targetPoints).toBe(3);
    expect(newGame('format').rules.searchCap).toBe(600);
    expect(deserialize(serialize(s)).session).toEqual({ pace: 'quick', difficulty: 'relaxed' });
  });
  it('finishes a quick journey after one set with a unique leader', () => {
    const s = newGame('quick-finish');
    configureSession(s, 'quick', 'standard');
    for (let i = 0; i < 3; i++) {
      startRound(s);
      s.phase = 'search';
      s.searchAt = s.time;
      s.time += (i + 1) * 10;
      s.hand = [];
      finishRound(s, 'Test survival');
      if (i < 2) nextRound(s);
    }
    expect(s.winner).toBe(2);
    nextRound(s);
    expect(s.phase).toBe('finished');
  });
  it('changes real seeker speed and perception without changing hider speed or truth', () => {
    const distances: number[] = [];
    for (const d of ['relaxed', 'standard', 'sharp']) {
      const s = newGame('difficulty', 20, 'seeker');
      configureSession(s, 'classic', d);
      startRound(s);
      s.phase = 'search';
      const t = s.world.stations[0].local;
      t.tiles.fill(1);
      t.cover = [];
      Object.assign(s.actors[0], { x: 10.5, y: 10.5 });
      Object.assign(s.actors[1], { x: 16.5, y: 10.5 });
      expect(!!seekerView(s, 0).visibleHider).toBe(d !== 'relaxed');
      move(s, 0, 1, 0, 0.1);
      distances.push(s.actors[0].x - 10.5);
    }
    expect(distances[0] / distances[1]).toBeCloseTo(0.82);
    expect(distances[2] / distances[1]).toBeCloseTo(1.12);
  });
});
describe('recoverable local saves', () => {
  it('recovers a validated backup without replacing it with damaged data', () => {
    const storage = new MemoryStore(),
      s = newGame('backup-one');
    storeMatch(storage, serialize(s));
    s.time = 12;
    storeMatch(storage, serialize(s));
    const backup = storage.getItem(BACKUP_KEY);
    storage.setItem(MATCH_KEY, '{"version":1}');
    const recovered = recoverMatch(storage, deserialize);
    expect(recovered.backup).toBe(true);
    expect(recovered.state.time).toBe(0);
    expect(storage.getItem(BACKUP_KEY)).toBe(backup);
    expect(storage.getItem(MATCH_KEY)).toBe(backup);
  });
  it.each(['tiles', 'actor', 'photo', 'effect', 'volume', 'coach'])(
    'rejects damaged %s before it reaches the renderer',
    (kind) => {
      const s = newGame('damaged');
      if (kind === 'tiles') s.world.stations[0].local.tiles = [];
      if (kind === 'actor') s.actors[1].station = 999;
      if (kind === 'photo')
        s.evidence = [
          {
            time: 0,
            question: 'Photo',
            answer: 'No',
            category: 'Photo',
            origin: 0,
            previous: 0,
            excluded: [],
            anchor: 'station',
            photo: { station: 99, x: 0, y: 0, subject: 'station' },
          },
        ];
      if (kind === 'effect')
        s.effects = [{ card: 99, slot: 'movement', until: 10, progress: 0, charges: 0, cleared: false }];
      if (kind === 'volume') s.settings.masterVolume = 15;
      if (kind === 'coach') s.coach = { step: 99, origin: { x: 0, y: 0 }, target: 1, completed: false };
      expect(() => deserialize(serialize(s))).toThrow();
    },
  );
  it('persists bounded settings separately from the current match', () => {
    const storage = new MemoryStore(),
      s = newGame();
    storage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ ...s.settings, masterVolume: 5, musicVolume: 0.3, textScale: 99 }),
    );
    const p = readPreferences(storage, s.settings);
    expect(p.masterVolume).toBe(1);
    expect(p.musicVolume).toBe(0.3);
    expect(p.textScale).toBe(1.4);
    expect(storage.getItem(MATCH_KEY)).toBeNull();
  });
});
describe('hands-on practice and residents', () => {
  it('does not claim the player tagged the hider after a practice timeout', () => {
    const s = createCoach('first-ticket', true);
    finishRound(s, 'Search time limit reached');
    advanceCoach(s);
    expect(s.coach!.completed).toBe(false);
  });
  it('advances hiding practice only after real movement, arrival, commitment, cover and a played card', () => {
    const s = createCoach();
    advanceCoach(s);
    expect(s.coach!.step).toBe(0);
    move(s, 0, 1, 0, 0.8);
    advanceCoach(s);
    expect(s.coach!.step).toBe(1);
    expect(travel(s, 0, s.coach!.target)).toBeNull();
    tick(s, 110);
    advanceCoach(s);
    expect(s.coach!.step).toBe(2);
    expect(commit(s)).toBeNull();
    advanceCoach(s);
    expect(s.coach!.step).toBe(3);
    const a = s.actors[0],
      t = s.world.stations[a.station].local,
      c = t.cover![0];
    a.path = pathfind(t, a, c.hide);
    tick(s, 80);
    expect(toggleHide(s)).toBeNull();
    advanceCoach(s);
    expect(s.coach!.step).toBe(4);
    expect(s.coach!.usedCard).not.toBe(true);
    expect(playCard(s, 0)).toBeNull();
    advanceCoach(s);
    expect(s.coach!.usedCard).toBe(true);
  });
  it('starts seeking practice without a pre-answered question or model dependency', () => {
    const s = createCoach('first-ticket', true);
    expect(s.phase).toBe('search');
    expect(s.coach!.step).toBe(5);
    expect(s.evidence).toEqual([]);
    expect(s.pending).toBeNull();
    expect(s.committed).not.toBeNull();
    expect(ask(s, 'zone', 0)).toBeNull();
    tick(s, 1);
    expect(s.evidence).toHaveLength(1);
    advanceCoach(s);
    expect(s.coach!.step).toBe(6);
  });
  it('places residents on actual walkable geography and varies contextual dialogue', () => {
    const s = newGame('residents');
    for (const st of s.world.stations)
      for (const p of residentPositions(st)) expect(walkable(st.local, p.x, p.y)).toBe(true);
    const before = residentLine(s, 0);
    s.actors[0].station = 1;
    expect(residentLine(s, 0)).not.toBe(before);
    expect(districtRead(s.world.stations[0])).toContain('open buildings');
  });
});
