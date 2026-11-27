import { describe, expect, it } from 'vitest';
import type { Archetype } from '../src/types';
import {
  makeTown,
  reachableTiles,
  walkable,
  pathfind,
  coverAt,
  inspectionPoints,
  lineOfSight,
  REVEAL_RANGE,
} from '../src/local';
import {
  newGame,
  tick,
  startRound,
  suggestedQuestion,
  approveQuestion,
  serialize,
  deserialize,
  interact,
} from '../src/simulation';
import { canTag, stealthState } from '../src/stealth';
import { actorPose, poseFrame } from '../src/animation';
import { residentActivity } from '../src/residents';
import { readPreferences } from '../src/storage';

const kinds: Archetype[] = ['city', 'market', 'coast', 'lake', 'forest', 'hill', 'rail', 'rural'];

describe('district identity and usable geography', () => {
  it('has distinct street/building plans and station locations, with seeded variation', () => {
    const towns = kinds.map((kind) => makeTown('identity', kind, 0, 0));
    expect(new Set(towns.map((town) => JSON.stringify(town.tiles))).size).toBe(8);
    expect(new Set(towns.map((town) => town.platform.x)).size).toBeGreaterThanOrEqual(6);
    expect(towns[0].buildings.length).toBeGreaterThan(towns[4].buildings.length);
    expect(towns[1].props.filter((p) => p.kind === 'market').length).toBeGreaterThanOrEqual(8);
    for (const kind of kinds) {
      expect(makeTown('identity', kind, 0, 0)).toEqual(makeTown('identity', kind, 0, 0));
      expect(makeTown('different', kind, 0, 0).tiles).not.toEqual(makeTown('identity', kind, 0, 0).tiles);
    }
  });
  it.each(kinds)('%s keeps doors, card destinations and cover reachable', (kind) => {
    for (const seed of ['coastal-crossings', 'market-maze', 'woodland-detour']) {
      const town = makeTown(seed, kind, 1, 1),
        reachable = reachableTiles(town, town.platform);
      for (const point of [
        town.platform,
        town.attraction,
        town.bridge,
        town.bench,
        town.scenic,
        ...town.spots,
        ...town.buildings.flatMap((b) => (b.kind === 'house' ? [b.door] : [b.door, b.interior])),
      ]) {
        expect(walkable(town, point.x, point.y), `${kind}/${seed}: ${JSON.stringify(point)}`).toBe(true);
        expect(
          reachable[Math.floor(point.y) * town.width + Math.floor(point.x)],
          `${kind}/${seed}: unreachable ${JSON.stringify(point)}`,
        ).toBe(1);
      }
      expect(pathfind(town, town.platform, town.scenic).length).toBeLessThanOrEqual(44);
    }
  });
  it.each(kinds)(
    '%s public inspection route covers quarter-tile hiding probes without secret coordinates',
    (kind) => {
      const town = makeTown('inspection-audit', kind, 0, 0);
      const points = inspectionPoints(town),
        reachable = reachableTiles(town, town.platform);
      let probes = 0;
      for (let y = 2; y < town.height - 2; y++)
        for (let x = 2; x < town.width - 2; x++) {
          if (!reachable[y * town.width + x]) continue;
          for (const [dx, dy] of [
            [0.25, 0.25],
            [0.75, 0.25],
            [0.5, 0.5],
            [0.25, 0.75],
            [0.75, 0.75],
          ]) {
            const p = { x: x + dx, y: y + dy };
            if (!coverAt(town, p)) continue;
            probes++;
            expect(
              points.some(
                (point) =>
                  Math.hypot(point.x - p.x, point.y - p.y) < REVEAL_RANGE && lineOfSight(town, point, p),
              ),
              `${kind}: omitted ${JSON.stringify(p)}`,
            ).toBe(true);
          }
        }
      expect(probes).toBeGreaterThan(100);
    },
  );
});

function seeking() {
  const s = newGame('player-led-questions', 20, 'seeker');
  s.phase = 'search';
  s.time = s.searchAt = 130;
  s.committed = 2;
  s.actors[s.hider].station = 2;
  s.actors[s.hider].nextThink = 99999;
  s.cardReady = 99999;
  return s;
}
describe('player-led investigation', () => {
  it('rejects malformed card cue actors before replacing a saved match', () => {
    const s = seeking();
    s.events.push({ type: 'card', time: s.time, text: 'Invalid cue', card: 0, actor: 999 });
    expect(() => deserialize(serialize(s))).toThrow('damaged');
  });
  it('holds a legal recommendation without spending a question; approval uses the shown origin', () => {
    const s = seeking();
    tick(s, 1);
    const proposal = suggestedQuestion(s)!;
    expect(proposal).toBeTruthy();
    expect(s.events.some((e) => e.type === 'question')).toBe(false);
    expect(s.pending).toBeNull();
    expect(approveQuestion(s)).toBeNull();
    expect(s.pending?.id).toBe(proposal.id);
    expect(s.pending?.origin).toBe(proposal.origin);
    expect(s.questionSuggestion).toBeNull();
  });
  it('invalidates a suggestion after its author travels and never asks it from a stale anchor', () => {
    const s = seeking();
    tick(s, 1);
    s.actors[s.questionSuggestion!.actor].station = 3;
    expect(suggestedQuestion(s)).toBeNull();
    expect(approveQuestion(s)).toContain('moved');
    expect(s.pending).toBeNull();
  });
  it('retains explicit automatic questioning and persists the assistance preference', () => {
    const s = seeking();
    s.settings.autoQuestions = true;
    tick(s, 1);
    expect(s.events.some((e) => e.type === 'question')).toBe(true);
    expect(suggestedQuestion(s)).toBeNull();
    const storage = { getItem: () => JSON.stringify({ autoQuestions: true }) } as unknown as Storage;
    expect(readPreferences(storage, newGame('prefs', 20).settings).autoQuestions).toBe(true);
    const legacy = JSON.parse(serialize(s));
    delete legacy.settings.autoQuestions;
    delete legacy.questionSuggestion;
    expect(deserialize(JSON.stringify(legacy)).settings.autoQuestions).toBe(false);
  });
});

describe('stealth signals and animation', () => {
  it('separates concealment, close revelation, tagging reach and wall occlusion', () => {
    const s = seeking(),
      town = s.world.stations[0].local;
    town.tiles.fill(1);
    town.cover = [{ kind: 'bush', x: 8.5, y: 6.5, hide: { x: 8.5, y: 6.5 } }];
    Object.assign(s.actors[0], { station: 0, x: 6.5, y: 6.5 });
    Object.assign(s.actors[1], { station: 0, x: 8.5, y: 6.5, hiding: true });
    expect(canTag(s)).toBe(false);
    s.actors[0].x = 7;
    expect(canTag(s)).toBe(false);
    expect(interact(s)).toContain('Move closer');
    s.actors[0].x = 7.3;
    expect(canTag(s)).toBe(true);
    s.hider = 0;
    s.actors[0].x = 8.5;
    s.actors[0].hiding = true;
    expect(stealthState(s)).toBe('spotted');
    s.actors[1].x = 12.5;
    expect(stealthState(s)).toBe('concealed');
    s.hider = 1;
    s.actors[0].x = 6.8;
    s.actors[1].x = 8;
    town.tiles[6 * town.width + 7] = 12;
    expect(canTag(s)).toBe(false);
  });
  it('uses distinct purposeful poses and keeps reduced-motion poses stable', () => {
    const s = seeking(),
      actor = s.actors[0];
    expect(actorPose(s, actor, false)).toBe('idle');
    expect(actorPose(s, actor, true)).toBe('walk');
    actor.sprinting = true;
    expect(actorPose(s, actor, true)).toBe('run');
    actor.hiding = true;
    s.events.push({ type: 'cover', actor: 0, time: s.time, text: '' });
    expect(actorPose(s, actor, false)).toBe('crouch');
    s.time += 0.3;
    expect(actorPose(s, actor, false)).toBe('hide');
    actor.hiding = false;
    s.events.push({ type: 'interact', actor: 0, time: s.time, text: '' });
    expect(actorPose(s, actor, false)).toBe('interact');
    expect(poseFrame('run', 1, true)).toBe(0);
    expect(poseFrame('idle', 100, true)).toBe(0);
  });
  it('keeps resident work routines on walkable ground', () => {
    const s = newGame('resident-jobs', 20);
    for (const st of s.world.stations)
      for (let i = 0; i < 3; i++)
        for (let time = 0; time < 18; time += 0.5) {
          const person = residentActivity(st, i, time);
          expect(walkable(st.local, person.x, person.y)).toBe(true);
        }
  });
  it('records actual moving sprint time by phase and role and retains it across saves', () => {
    const s = newGame('movement-record', 20);
    startRound(s);
    s.actors.forEach((a) => (a.nextThink = 9999));
    tick(s, 0.4, { x: 0, y: -1, sprint: true });
    tick(s, 0.4, { x: 0, y: -1 });
    const metric = s.movementMetrics!['human-headstart-hider'];
    expect(metric.movingSeconds).toBeCloseTo(0.8);
    expect(metric.sprintSeconds).toBeCloseTo(0.4);
    expect(deserialize(serialize(s)).movementMetrics).toEqual(s.movementMetrics);
  });
});
