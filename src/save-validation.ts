import type { State } from './types';
const fail = () => {
  throw new Error('This save is incomplete or damaged. Your current journey has been kept.');
};
const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
const list = (v: unknown, max = 100000): v is unknown[] => Array.isArray(v) && v.length <= max;
export function validateSave(value: unknown): asserts value is State {
  if (!value || typeof value !== 'object') fail();
  const s = value as State;
  if (s.version !== 1)
    throw new Error('This save version is unsupported. Keep the file and use the matching game version.');
  if (
    !s.world ||
    !list(s.world.stations, 80) ||
    s.world.stations.length < 2 ||
    typeof s.world.seed !== 'string' ||
    s.world.seed.length > 100
  )
    fail();
  const count = s.world.stations.length;
  if (![1, 2, 4, 8].includes(s.speed)) fail();
  if (
    !list(s.world.landmarks, 100) ||
    ['hub', 'lake', 'hill', 'park'].some(
      (kind) =>
        !s.world.landmarks.some(
          (p) => p && p.kind === kind && typeof p.name === 'string' && finite(p.x) && finite(p.y),
        ),
    )
  )
    fail();
  if (
    s.session &&
    (!['quick', 'classic'].includes(s.session.pace) ||
      !['relaxed', 'standard', 'sharp'].includes(s.session.difficulty))
  )
    fail();
  const station = (id: unknown) => Number.isInteger(id) && Number(id) >= 0 && Number(id) < count;
  const activity = (id: unknown) =>
    typeof id === 'string' && ['work', 'errand', 'break', 'lunch', 'home'].includes(id);
  if (s.residents !== undefined) {
    if (!list(s.residents, count * 3)) fail();
    const ids = new Set<string>();
    for (const r of s.residents) {
      if (
        !r ||
        !station(r.station) ||
        ![0, 1, 2].includes(r.index) ||
        ![0, 1, 2, 3].includes(r.dir) ||
        ![r.x, r.y, r.until, r.updated, r.step].every(finite) ||
        !Number.isInteger(r.step) ||
        r.step < 0 ||
        !activity(r.activity) ||
        typeof r.indoors !== 'boolean' ||
        !list(r.path, 20000) ||
        r.path.some((p) => !p || !finite(p.x) || !finite(p.y)) ||
        (r.talkUntil !== undefined && !finite(r.talkUntil)) ||
        (r.dialogue !== undefined && (typeof r.dialogue !== 'string' || r.dialogue.length > 160)) ||
        (r.dialogueActivity !== undefined && !activity(r.dialogueActivity)) ||
        (r.dialogueUntil !== undefined && !finite(r.dialogueUntil)) ||
        (r.advice && (!activity(r.advice.activity) || !finite(r.advice.until))) ||
        (r.memory !== undefined &&
          (!list(r.memory, 3) || r.memory.some((line) => typeof line !== 'string' || line.length > 160)))
      )
        fail();
      const key = `${r.station}:${r.index}`;
      if (ids.has(key)) fail();
      ids.add(key);
      const town = s.world.stations[r.station].local;
      if (
        r.x < 0 ||
        r.y < 0 ||
        r.x >= town.width ||
        r.y >= town.height ||
        r.path.some((p) => p.x < 0 || p.y < 0 || p.x >= town.width || p.y >= town.height)
      )
        fail();
    }
  }
  if (
    s.residentChat &&
    (!station(s.residentChat.station) ||
      ![0, 1, 2].includes(s.residentChat.index) ||
      !finite(s.residentChat.at))
  )
    fail();
  if (s.settings?.autoQuestions !== undefined && typeof s.settings.autoQuestions !== 'boolean') fail();
  if (s.movementMetrics !== undefined) {
    if (
      !s.movementMetrics ||
      typeof s.movementMetrics !== 'object' ||
      Object.keys(s.movementMetrics).length > 20
    )
      fail();
    for (const [key, sample] of Object.entries(s.movementMetrics))
      if (
        !/^(human|auto)-(preparation|headstart|search|results|finished)-(hider|seeker)$/.test(key) ||
        !sample ||
        ![sample.movingSeconds, sample.sprintSeconds, sample.distance].every((n) => finite(n) && n >= 0) ||
        sample.sprintSeconds > sample.movingSeconds + 0.001
      )
        fail();
  }
  if (s.questionSuggestion) {
    const p = s.questionSuggestion;
    if (
      typeof p.id !== 'string' ||
      p.id.length > 100 ||
      ![0, 1, 2].includes(p.actor) ||
      !station(p.origin) ||
      !station(p.previous)
    )
      fail();
  }
  for (const [index, st] of s.world.stations.entries()) {
    if (
      !st ||
      st.id !== index ||
      !finite(st.x) ||
      !finite(st.y) ||
      typeof st.name !== 'string' ||
      st.name.length > 100
    )
      fail();
    const t = st.local;
    if (
      !t ||
      !Number.isInteger(t.width) ||
      !Number.isInteger(t.height) ||
      t.width < 4 ||
      t.height < 4 ||
      t.width > 128 ||
      t.height > 128 ||
      !list(t.tiles, 16384) ||
      t.tiles.length !== t.width * t.height
    )
      fail();
    if (
      t.tiles.some((n) => !Number.isInteger(n) || n < 0 || n > 15) ||
      !list(t.buildings, 100) ||
      !list(t.props, 4096) ||
      !list(t.spots, 500)
    )
      fail();
    for (const p of [t.platform, t.attraction, t.bridge, t.bench, t.scenic, ...t.spots, ...t.props])
      if (!p || !finite(p.x) || !finite(p.y)) fail();
    for (const b of t.buildings)
      if (!b || ![b.x, b.y, b.w, b.h, b.door?.x, b.door?.y, b.interior?.x, b.interior?.y].every(finite))
        fail();
    if (
      t.cover &&
      (!list(t.cover, 500) || t.cover.some((p) => !p || ![p.x, p.y, p.hide?.x, p.hide?.y].every(finite)))
    )
      fail();
  }
  if (
    !list(s.world.edges, 1000) ||
    s.world.edges.some(
      (e) =>
        !e ||
        !station(e.a) ||
        !station(e.b) ||
        ![e.duration, e.every, e.offset].every(finite) ||
        e.duration <= 0 ||
        e.every <= 0,
    )
  )
    fail();
  if (
    !list(s.actors, 3) ||
    s.actors.length !== 3 ||
    !Number.isInteger(s.hider) ||
    s.hider < 0 ||
    s.hider > 2 ||
    !['preparation', 'headstart', 'search', 'results', 'finished'].includes(s.phase)
  )
    fail();
  for (const [id, a] of s.actors.entries()) {
    if (
      !a ||
      a.id !== id ||
      !station(a.station) ||
      ![a.x, a.y, a.nextThink].every(finite) ||
      (a.evades !== undefined && (!Number.isInteger(a.evades) || a.evades < 0 || a.evades > 2)) ||
      (a.evadeAt !== undefined && !finite(a.evadeAt)) ||
      !list(a.path, 20000) ||
      !list(a.journey, 100) ||
      !list(a.searched, 500) ||
      !list(a.visited, 100)
    )
      fail();
    if (
      a.path.some((p) => !p || !finite(p.x) || !finite(p.y)) ||
      a.journey.some(
        (l) =>
          !l ||
          !station(l.from) ||
          !station(l.to) ||
          !finite(l.depart) ||
          !finite(l.arrive) ||
          l.arrive < l.depart ||
          (l.service !== undefined &&
            (!l.service ||
              !['fast', 'signal', 'repair'].includes(l.service.mode) ||
              !finite(l.service.seconds) ||
              l.service.seconds < 1 ||
              l.service.seconds > 10 ||
              !finite(l.service.scheduled) ||
              (l.service.mode === 'repair' && l.arrive - l.depart <= l.service.seconds))),
      )
    )
      fail();
  }
  for (const key of [
    'time',
    'phaseAt',
    'searchAt',
    'rng',
    'round',
    'set',
    'questionReady',
    'cardReady',
  ] as const)
    if (!finite(s[key])) fail();
  if (
    !s.rules ||
    ![
      s.rules.headStart,
      s.rules.searchCap,
      s.rules.walkSpeed,
      s.rules.questionCooldown,
      s.rules.cardCooldown,
    ].every(finite) ||
    s.rules.walkSpeed <= 0 ||
    s.rules.searchCap <= 0
  )
    fail();
  for (const key of [
    'deck',
    'hand',
    'discard',
    'candidates',
    'effects',
    'rewards',
    'events',
    'evidence',
    'results',
    'roundScores',
    'usedQuestions',
    'order',
    'totals',
    'lastKnown',
    'cleared',
  ] as const)
    if (!list(s[key])) fail();
  if (
    [...s.deck, ...s.hand, ...s.discard].some((id) => !Number.isInteger(id) || id < 0 || id > 23) ||
    s.candidates.some((id) => !station(id))
  )
    fail();
  if (
    !s.settings ||
    !s.settings.bindings ||
    typeof s.settings.bindings !== 'object' ||
    !finite(s.settings.textScale) ||
    !s.notes ||
    !s.blocked
  )
    fail();
  for (const key of ['up', 'down', 'left', 'right', 'interact', 'map', 'pause'])
    if (typeof s.settings.bindings[key] !== 'string' || s.settings.bindings[key].length > 40) fail();
  if (
    Object.entries(s.notes).some(
      ([id, note]) => !station(Number(id)) || typeof note !== 'string' || note.length > 5000,
    )
  )
    fail();
  for (const r of [...s.results, ...s.roundScores])
    if (
      !r ||
      !station(r.district) ||
      !Number.isInteger(r.hider) ||
      r.hider < 0 ||
      r.hider > 2 ||
      ![r.survival, r.bonus, r.score].every(finite) ||
      typeof r.reason !== 'string' ||
      !list(r.events)
    )
      fail();
  if (
    s.settings.textScale < 1 ||
    s.settings.textScale > 1.4 ||
    !['match', 'hider', 'seeker', 'tutorial'].includes(s.mode)
  )
    fail();
  for (const key of ['masterVolume', 'musicVolume', 'effectsVolume', 'ambienceVolume'] as const)
    if (
      s.settings[key] !== undefined &&
      (!finite(s.settings[key]) || s.settings[key]! < 0 || s.settings[key]! > 1)
    )
      fail();
  for (const [key, limit] of [
    ['seekerSpeed', 3],
    ['sightRange', 20],
    ['targetPoints', 100],
  ] as const)
    if (s.rules[key] !== undefined && (!finite(s.rules[key]) || s.rules[key]! <= 0 || s.rules[key]! > limit))
      fail();
  if (
    s.order.length !== 3 ||
    new Set(s.order).size !== 3 ||
    s.order.some((n) => !Number.isInteger(n) || n < 0 || n > 2) ||
    s.totals.length !== 3 ||
    s.totals.some((n) => !finite(n))
  )
    fail();
  for (const e of s.effects)
    if (
      !e ||
      !Number.isInteger(e.card) ||
      e.card < 0 ||
      e.card > 23 ||
      ![e.until, e.progress].every(finite) ||
      (e.target && (!station(e.target.station) || !finite(e.target.x) || !finite(e.target.y)))
    )
      fail();
  for (const r of s.rewards)
    if (
      !r ||
      !list(r.cards, 52) ||
      r.cards.some((n) => !Number.isInteger(n) || n < 0 || n > 23) ||
      !Number.isInteger(r.keep) ||
      r.keep < 0 ||
      r.keep > r.cards.length
    )
      fail();
  for (const e of s.evidence)
    if (
      !e ||
      !station(e.origin) ||
      !station(e.previous) ||
      typeof e.question !== 'string' ||
      typeof e.answer !== 'string' ||
      !list(e.excluded, 80) ||
      e.excluded.some((id) => !station(id))
    )
      fail();
  for (const e of s.evidence)
    if (
      e.photo &&
      (!station(e.photo.station) ||
        !finite(e.photo.x) ||
        !finite(e.photo.y) ||
        !['station', 'landmark', 'position'].includes(e.photo.subject))
    )
      fail();
  for (const e of s.events)
    if (
      !e ||
      !finite(e.time) ||
      typeof e.text !== 'string' ||
      typeof e.type !== 'string' ||
      (e.speaker !== undefined && (!Number.isInteger(e.speaker) || e.speaker < 1 || e.speaker > 5)) ||
      (e.card !== undefined &&
        (!Number.isInteger(e.card) || e.card < 0 || e.card > 23 || ![0, 1, 2].includes(e.actor ?? -1)))
    )
      fail();
  if (
    s.coach &&
    (!Number.isInteger(s.coach.step) ||
      s.coach.step < 0 ||
      s.coach.step > 9 ||
      !station(s.coach.target) ||
      !finite(s.coach.origin?.x) ||
      !finite(s.coach.origin?.y))
  )
    fail();
}
