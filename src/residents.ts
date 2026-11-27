import type { State, Station, Point } from './types';
import { hash, distance } from './random';
import { inTransit } from './transit';
import { walkable, lineOfSight, pathfind, reachableTiles, canSeeActor } from './local';
import type { CharacterPose } from './art';
import { CARDS } from './cards';
const names = [
  'Nora',
  'Elio',
  'Pip',
  'Tansy',
  'Ravi',
  'Cleo',
  'Otis',
  'June',
  'Luca',
  'Inez',
  'Bram',
  'Asha',
];
const homes = new WeakMap<Station['local'], { x: number; y: number }[]>();
export function residentPositions(st: Station) {
  const cached = homes.get(st.local);
  if (cached) return cached;
  const t = st.local,
    anchors = [t.bench, t.attraction, t.buildings.find((b) => b.kind === 'cafe')?.door ?? t.scenic];
  const positions = anchors.map((p) => {
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [2, 0],
      [0, 2],
      [-2, 0],
      [0, -2],
      [3, 0],
      [0, 3],
    ])
      if (walkable(t, p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
    return t.platform;
  });
  homes.set(t, positions);
  return positions;
}
/** Short work routines stay on reachable ground; dialogue uses these same positions. */
export function residentActivity(st: Station, index: number, time: number) {
  const home = residentPositions(st)[index];
  const options = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  const offset = options.find(
    ([dx, dy]) =>
      walkable(st.local, home.x + dx, home.y + dy) &&
      lineOfSight(st.local, home, { x: home.x + dx, y: home.y + dy }),
  ) ?? [0, 0];
  const phase = (time + index * 4 + (hash(st.name) % 9)) % 18;
  const progress = phase < 2 ? phase / 2 : phase < 10 ? 1 : phase < 12 ? 1 - (phase - 10) / 2 : 0;
  const walking = phase < 2 || (phase >= 10 && phase < 12);
  const dx = offset[0] * (phase >= 10 ? -1 : 1),
    dy = offset[1] * (phase >= 10 ? -1 : 1);
  const pose: CharacterPose = walking && (offset[0] || offset[1]) ? 'walk' : phase < 10 ? 'interact' : 'idle';
  return {
    x: home.x + offset[0] * progress,
    y: home.y + offset[1] * progress,
    dir: walking ? (dx > 0 ? 1 : dx < 0 ? 3 : dy < 0 ? 0 : 2) : 2,
    pose,
  };
}
export const residentClock = (time: number) => (8 + time / 120) % 24;
export function residentIdentity(st: Station, index: number) {
  return {
    name: names[(hash(st.name) + index * 5) % names.length],
    job: ['station porter', 'gardener', 'shopkeeper'][index],
  };
}
interface Activity {
  id: string;
  label: string;
  point: Point;
  hold: number;
  line: string;
}
const activities = new WeakMap<Station, Activity[][]>();
export function residentActivities(st: Station, index: number) {
  let list = activities.get(st);
  if (!list) {
    const t = st.local,
      reachable = reachableTiles(t, t.platform);
    const safe = (point: Point, offset = 0): Point => {
      for (const [dx, dy] of [
        [offset, 0],
        [0, 0],
        [1, 1],
        [-1, 1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ]) {
        const p = { x: Math.floor(point.x + dx) + 0.5, y: Math.floor(point.y + dy) + 0.5 };
        if (walkable(t, p.x, p.y) && reachable[Math.floor(p.y) * t.width + Math.floor(p.x)]) return p;
      }
      return { ...t.platform };
    };
    const cafe = t.buildings.find((b) => b.kind === 'cafe')?.door ?? t.bench;
    const home = t.buildings.find((b) => b.kind === 'home')?.door ?? t.buildings.at(-1)?.door ?? t.bench;
    const stock =
      t.cover?.find((cover) => cover.kind === 'crate')?.hide ??
      t.props.find((p) => p.kind === 'suitcase') ??
      t.platform;
    list = [0, 1, 2].map((i) => [
      {
        id: 'work',
        label: ['Sorting parcels', 'Watering the garden', 'Minding the shop'][i],
        point: safe(residentPositions(st)[i]),
        hold: 16,
        line: [
          "I'm sorting the morning parcels. Every service here uses the same clock.",
          'A little water now saves these flowers later.',
          "I'm putting the fresh stock out before the next train.",
        ][i],
      },
      {
        id: 'errand',
        label: ['Moving luggage', 'Tending the trees', 'Collecting stock'][i],
        point: safe(i === 1 ? t.scenic : stock, i - 1),
        hold: 14,
        line: [
          "I've got a few cases to collect, then it's back to the platform.",
          "I'm checking the plants by the path. They dry out quickly here.",
          "I'm collecting a delivery for the shop.",
        ][i],
      },
      {
        id: 'break',
        label: 'Taking a break',
        point: safe(t.bench, i - 1),
        hold: 22,
        line: 'A few quiet minutes on this bench, then back to it.',
      },
      {
        id: 'lunch',
        label: 'Having lunch',
        point: safe(cafe, i - 1),
        hold: 30,
        line: "I'm on my lunch break. It has been a busy morning.",
      },
      {
        id: 'home',
        label: 'Heading home',
        point: safe(home, i - 1),
        hold: 45,
        line: "That's my shift finished. I'm heading home for the evening.",
      },
    ]);
    activities.set(st, list);
  }
  return list[index];
}
export function residentAt(s: State, index: number, station = s.actors[0].station) {
  const record = s.residents?.find((person) => person.station === station && person.index === index);
  if (!record)
    return {
      ...residentActivity(s.world.stations[station], index, s.settings.reducedMotion ? 0 : s.time),
      visible: true,
      activity: 'work',
    };
  const pose: CharacterPose = record.path.length
    ? 'walk'
    : ['work', 'errand'].includes(record.activity)
      ? 'interact'
      : 'idle';
  return {
    x: record.x,
    y: record.y,
    dir: record.dir,
    pose,
    visible: !record.indoors,
    activity: record.activity,
  };
}
const workRoutes = new WeakMap<Station, Map<string, Point[]>>();
export function updateResidents(s: State, dt: number) {
  const station = s.world.stations[s.actors[0].station];
  const records = (s.residents ??= []);
  for (let index = 0; index < 3; index++) {
    let person = records.find((r) => r.station === station.id && r.index === index);
    if (!person) {
      const p = residentActivity(station, index, s.time);
      person = {
        station: station.id,
        index,
        x: p.x,
        y: p.y,
        dir: p.dir,
        path: [],
        activity: 'work',
        step: index,
        until: s.time + 10 + (hash(station.name + index) % 6),
        updated: s.time,
        indoors: false,
      };
      records.push(person);
    }
    const delta = Math.min(2, Math.max(dt, s.time - person.updated));
    person.updated = s.time;
    if ((person.talkUntil ?? 0) > s.time) continue;
    if (person.path.length) {
      // People yield a little personal space rather than marching through a conversation.
      if (distance(person, s.actors[0]) < 0.65 && !s.actors[0].hiding) continue;
      let budget = delta * 1.1;
      while (budget > 0 && person.path.length) {
        const target = person.path[0],
          d = distance(person, target);
        person.dir =
          Math.abs(target.x - person.x) > Math.abs(target.y - person.y)
            ? target.x > person.x
              ? 1
              : 3
            : target.y > person.y
              ? 2
              : 0;
        if (d <= budget) {
          person.x = target.x;
          person.y = target.y;
          person.path.shift();
          budget -= d;
        } else {
          person.x += ((target.x - person.x) * budget) / d;
          person.y += ((target.y - person.y) * budget) / d;
          budget = 0;
        }
      }
      if (!person.path.length) {
        person.until =
          s.time + (residentActivities(station, index).find((a) => a.id === person!.activity)?.hold ?? 16);
        person.indoors = person.activity === 'home';
      }
    } else if (s.time >= person.until) {
      const options = residentActivities(station, index),
        hour = residentClock(s.time);
      const sequence = ['work', 'errand', 'work', 'break', 'errand', 'work', 'lunch'];
      const suggested = person.advice && person.advice.until > s.time ? person.advice.activity : null;
      const id =
        hour >= 18 || hour < 7
          ? 'home'
          : hour >= 12 && hour < 13
            ? 'lunch'
            : (suggested ?? sequence[person.step++ % sequence.length]);
      person.advice = undefined;
      const activity = options.find((a) => a.id === id) ?? options[0];
      let routes = workRoutes.get(station);
      if (!routes) {
        routes = new Map();
        workRoutes.set(station, routes);
      }
      const key = `${index}:${person.x.toFixed(2)}:${person.y.toFixed(2)}:${activity.id}`;
      let path = routes.get(key);
      if (!path) {
        path = pathfind(station.local, person, activity.point);
        if (routes.size < 90) routes.set(key, path);
      }
      person.path = path.map((p) => ({ ...p }));
      person.activity = activity.id;
      person.indoors = false;
      person.until = s.time + activity.hold;
      if (!person.path.length) person.indoors = activity.id === 'home';
    }
  }
}
export function residentView(s: State, index: number) {
  const station = s.world.stations[s.actors[0].station],
    record = s.residents?.find((r) => r.station === station.id && r.index === index);
  if (!record || record.indoors) return null;
  const hour = residentClock(s.time),
    choices = residentActivities(station, index).filter((a) =>
      hour >= 18 || hour < 7 ? a.id === 'home' : a.id !== 'home',
    );
  return {
    context: {
      role: 'resident',
      ...residentIdentity(station, index),
      district: station.name,
      districtType: station.kind,
      localHour: Math.floor(hour),
      currentActivity:
        residentActivities(station, index).find((a) => a.id === record.activity)?.label ?? 'Working',
      walking: !!record.path.length,
      memory: record.memory?.slice(-3) ?? [],
      nearby: s.actors
        .filter(
          (actor) =>
            actor.station === station.id &&
            !inTransit(actor, s.time) &&
            canSeeActor(station.local, record, actor, 5),
        )
        .map((actor) => ({ name: ['Traveler', 'Mira', 'Kit'][actor.id] })),
    },
    choices: choices.map((a, choice) => ({ choice, action: a.label, id: a.id })),
    station: station.id,
    index,
  };
}
export function acceptResidentReply(
  s: State,
  view: NonNullable<ReturnType<typeof residentView>>,
  raw: unknown,
) {
  let data: { choice?: unknown; line?: unknown };
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : (raw as typeof data);
  } catch {
    return false;
  }
  if (!data || !Number.isInteger(data.choice) || typeof data.line !== 'string') return false;
  const choice = view.choices[Number(data.choice)],
    record = s.residents?.find((r) => r.station === view.station && r.index === view.index);
  if (!choice || !record || s.actors[0].station !== view.station) return false;
  const line = data.line
    .replace(/[\u0000-\u001f<>]/g, '')
    .trim()
    .slice(0, 160);
  if (!line || /\b(hider|seeker|Mira|Kit|hidden|tagged|candidate|question answer)\b|\b\d+\s*km\b/i.test(line))
    return false;
  record.advice = { activity: choice.id, until: s.time + 90 };
  record.dialogue = line;
  record.dialogueActivity = choice.id;
  record.dialogueUntil = s.time + 120;
  record.memory = [...(record.memory ?? []), line].slice(-3);
  const chat = s.residentChat;
  if (
    chat &&
    chat.station === view.station &&
    chat.index === view.index &&
    s.time - chat.at < 25 &&
    distance(record, s.actors[0]) < 3
  ) {
    const text = residentIdentity(s.world.stations[view.station], view.index).name + ': ' + line;
    s.events.push({
      type: 'speech',
      time: s.time,
      text,
      speaker: view.index + 3,
      station: view.station,
      x: record.x,
      y: record.y,
      visibleToHuman: true,
    });
    record.talkUntil = s.time + 5;
    s.residentChat = null;
  }
  return true;
}
export function residentLine(s: State, index: number) {
  const st = s.world.stations[s.actors[0].station],
    name = names[(hash(st.name) + index * 5) % names.length],
    role = ['station porter', 'gardener', 'shopkeeper'][index];
  const localColor = {
    city: 'I like the quiet courtyard between the tall blocks.',
    market: 'These stalls are a maze when the awnings go up.',
    coast: 'Salt gets into every door hinge around here.',
    forest: 'The pines make this clearing feel like a little room.',
    lake: 'The lake is lovely from the long way round.',
    hill: 'You earn your lunch walking these winding lanes.',
    rail: 'A porter can always find another crate to shift.',
    rural: 'The garden rows look their best just after watering.',
  }[st.kind];
  const opening = `${name}, the ${role}: ${localColor} `;
  const person = s.residents?.find((r) => r.station === st.id && r.index === index);
  if (
    person?.dialogue &&
    (person.dialogueUntil ?? 0) > s.time &&
    (person.dialogueActivity === person.activity || person.advice?.activity === person.dialogueActivity)
  )
    return `${name}, the ${role}: ${person.dialogue}`;
  if (person && person.activity !== 'work') {
    const activity = residentActivities(st, index).find((a) => a.id === person.activity);
    if (activity) return `${name}, the ${role}: ${activity.line}`;
  }
  const task = s.effects.find((e) => e.target?.station === st.id);
  if (task)
    return (
      opening +
      `${CARDS[task.card].title}? The errand is marked nearby. Stay at the marker long enough to finish it.`
    );
  if (index === 0) {
    return (
      opening +
      `Every service here uses the same clock. ${s.world.edges.some((e) => (e.a === st.id || e.b === st.id) && e.kind === 'bus') ? 'The country bus is another way out.' : 'Check the map before committing to a connection.'}`
    );
  }
  if (index === 1)
    return (
      opening +
      {
        coast: 'The shoreline narrows the routes. Watch the approaches to the bridges.',
        forest: 'Trees break sightlines. Running draws attention from farther away.',
        city: 'Walls and open doorways can break a long sightline. An open street gives you less cover.',
        market: 'Stalls and crates are good cover. A seeker inspecting closely can still find someone.',
        lake: 'The water shapes the routes. A shorter straight line is not always a shorter walk.',
        hill: 'Try approaching a corner from another street. Walls block sight, even at close range.',
        rail: 'Platforms are meeting places. The seekers board together, so a companion may need to catch up.',
        rural: 'Open lanes make runners easier to spot. Look for hedges, trees and garden walls.',
      }[st.kind]
    );
  return (
    opening +
    (s.phase === 'search'
      ? 'I saw no reason to trust a guess over a clue. Compare the answer with the station where it was asked.'
      : `The ${st.landmark.toLowerCase()} is our landmark. Explore before choosing your quiet corner.`)
  );
}
export function nearbyResident(s: State) {
  const actor = s.actors[0],
    station = s.world.stations[actor.station];
  if (inTransit(actor, s.time)) return null;
  for (let index = 0; index < 3; index++) {
    const person = residentAt(s, index);
    if (person.visible && distance(actor, person) < 2 && lineOfSight(station.local, actor, person))
      return {
        index,
        ...person,
        name: names[(hash(station.name) + index * 5) % names.length],
      };
  }
  return null;
}
export function districtRead(st: Station) {
  const t = st.local;
  let blocked = 0,
    open = 0;
  for (let y = 4; y < t.height - 4; y++)
    for (let x = 4; x < t.width - 4; x++)
      if ([3, 7, 10].includes(t.tiles[y * t.width + x])) blocked++;
      else if (walkable(t, x, y)) open++;
  return `${blocked / Math.max(1, open) > 0.25 ? 'Sheltered lanes' : 'Open approaches'} · ${t.buildings.filter((b) => b.kind !== 'house').length} open buildings · ${(t.cover ?? []).length} planted or stacked cover groups`;
}
