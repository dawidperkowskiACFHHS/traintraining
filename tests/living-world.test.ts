import { describe, it, expect } from 'vitest';
import { newGame, serialize, deserialize, interact } from '../src/simulation';
import {
  updateResidents,
  residentActivities,
  residentAt,
  residentView,
  acceptResidentReply,
} from '../src/residents';
import { walkable, reachableTiles } from '../src/local';
import { nextService, journeyProgress, serviceStop, serviceNote } from '../src/service-conditions';
import type { Leg } from '../src/types';

describe('resident lives', () => {
  it('visits reachable work and errand locations, yields for conversations and persists the routine', () => {
    const s = newGame('working-town', 20);
    updateResidents(s, 0.1);
    const st = s.world.stations[0],
      accessible = reachableTiles(st.local, st.local.platform);
    for (let i = 0; i < 3; i++)
      for (const a of residentActivities(st, i))
        expect(accessible[Math.floor(a.point.y) * st.local.width + Math.floor(a.point.x)]).toBe(1);
    // Keep the player out of their personal space, without simulating seekers.
    Object.assign(s.actors[0], { x: 1.5, y: 1.5 });
    const positions = new Set<string>(),
      jobs = new Set<string>();
    for (let second = 0; second < 210; second++) {
      s.time += 1;
      updateResidents(s, 1);
      for (const p of s.residents!) {
        expect(walkable(st.local, p.x, p.y)).toBe(true);
        positions.add(`${p.index}:${p.x.toFixed(1)}:${p.y.toFixed(1)}`);
        jobs.add(p.activity);
      }
    }
    expect(positions.size).toBeGreaterThan(30);
    expect(jobs.has('errand')).toBe(true);
    expect(jobs.has('break')).toBe(true);
    const person = s.residents![0];
    Object.assign(s.actors[0], { x: person.x, y: person.y });
    interact(s);
    const before = { x: person.x, y: person.y };
    s.time += 2;
    updateResidents(s, 2);
    expect({ x: person.x, y: person.y }).toEqual(before);
    expect(deserialize(serialize(s)).residents).toEqual(JSON.parse(serialize(s)).residents);
  });
  it('goes home at the end of a shift and returns the following morning', () => {
    const s = newGame('resident-evening', 20);
    updateResidents(s, 0.1);
    Object.assign(s.actors[0], { x: 1.5, y: 1.5 });
    s.time = 120 * 10;
    for (let t = 0; t < 150; t++) {
      s.time++;
      updateResidents(s, 1);
    }
    expect(s.residents!.every((p) => p.activity === 'home' && p.indoors)).toBe(true);
    expect(residentAt(s, 0).visible).toBe(false);
    s.time = 24 * 120;
    for (let t = 0; t < 150; t++) {
      s.time++;
      updateResidents(s, 1);
    }
    expect(s.residents!.every((p) => !p.indoors)).toBe(true);
  });
  it('keeps model observations local and validates activity choices and dialogue', () => {
    const s = newGame('resident-context', 20, 'seeker');
    updateResidents(s, 0.1);
    s.actors[1].station = 5;
    s.committed = 5;
    s.hideSpot = { x: 3, y: 4 };
    const view = residentView(s, 0)!;
    s.actors[1].station = 6;
    s.committed = 6;
    s.hideSpot = { x: 30, y: 40 };
    expect(residentView(s, 0)).toEqual(view);
    expect(JSON.stringify(view)).not.toMatch(/committed|hideSpot|candidates|correctAnswer/);
    expect(acceptResidentReply(s, view, { choice: 99, line: 'A break would be nice.' })).toBe(false);
    expect(acceptResidentReply(s, view, { choice: 0, line: 'The hider is in town.' })).toBe(false);
    const person = s.residents![0];
    Object.assign(s.actors[0], { x: person.x, y: person.y });
    s.residentChat = { station: 0, index: 0, at: s.time };
    const choice = view.choices.find((a) => a.id === 'break')!;
    expect(
      acceptResidentReply(s, view, {
        choice: choice.choice,
        line: 'I could use a few quiet minutes on the bench.',
      }),
    ).toBe(true);
    expect(s.events.at(-1)?.speaker).toBe(3);
    expect(person.memory).toHaveLength(1);
    expect(person.advice?.activity).toBe('break');
    expect(s.residentChat).toBeNull();
    expect(deserialize(serialize(s)).residents![0].memory).toEqual(person.memory);
    const corrupt = JSON.parse(serialize(s));
    corrupt.residents[0].memory = Array(5).fill('bad');
    expect(() => deserialize(JSON.stringify(corrupt))).toThrow();
  });
});

describe('bounded service conditions', () => {
  it('schedules deterministic fast, delayed and repair services with valid arrival times', () => {
    const s = newGame('changing-services', 20),
      edge = s.world.edges.find((e) => e.kind !== 'walk')!;
    const seen = new Set<string>();
    for (let i = 0; i < 160; i++) {
      const time = i * edge.every,
        leg = nextService(s.world, edge, edge.a, edge.b, time);
      expect(nextService(s.world, edge, edge.a, edge.b, time)).toEqual(leg);
      expect(leg.depart).toBeGreaterThanOrEqual(time - 1e-7);
      expect(leg.arrive).toBeGreaterThan(leg.depart);
      expect(journeyProgress(leg, leg.arrive)).toBe(1);
      seen.add(leg.service?.mode ?? 'normal');
      if (leg.service) expect(serviceNote(leg)).not.toBe('');
      s.actors[0].journey = [leg];
      expect(deserialize(serialize(s)).actors[0].journey).toEqual([leg]);
    }
    expect([...seen].sort()).toEqual(['fast', 'normal', 'repair', 'signal']);
  });
  it('stops actual route progress during a repair, then resumes and arrives', () => {
    const leg: Leg = {
      from: 0,
      to: 1,
      depart: 10,
      arrive: 60,
      kind: 'local',
      line: 0,
      service: { mode: 'repair', seconds: 10, scheduled: 10 },
    };
    expect(serviceStop(leg, 29)?.remaining).toBe(9);
    expect(journeyProgress(leg, 29)).toBeCloseTo(0.45);
    expect(journeyProgress(leg, 36)).toBeCloseTo(0.45);
    expect(serviceStop(leg, 38)).toBeNull();
    expect(journeyProgress(leg, 40)).toBeGreaterThan(0.45);
    expect(journeyProgress(leg, 60)).toBe(1);
  });
});
