import { createServer } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const sim = await server.ssrLoadModule('/src/simulation.ts');
  const { FORMATS } = await server.ssrLoadModule('/src/session.ts');
  const quickCap = FORMATS.quick.searchCap;
  const local = await server.ssrLoadModule('/src/local.ts');
  const seeds = ['coastal-crossings', 'market-maze', 'woodland-detour'];
  const rows = [],
    trials = [];
  const trialKinds = new Set();
  const seen = (town, points, p) =>
    points.some(
      (point) =>
        Math.hypot(point.x - p.x, point.y - p.y) < local.REVEAL_RANGE && local.lineOfSight(town, point, p),
    );
  function legacyPoints(t) {
    const candidates = [],
      points = [...t.spots],
      reachable = local.reachableTiles(t, t.platform);
    for (let y = 3; y < t.height - 3; y += 2)
      for (let x = 3; x < t.width - 3; x += 2) {
        const p = { x: x + 0.5, y: y + 0.5 };
        if (local.coverAt(t, p) && t.spots.every((spot) => Math.hypot(spot.x - p.x, spot.y - p.y) > 2))
          candidates.push(p);
      }
    for (let i = 0; i < Math.min(24, candidates.length); i++) {
      const p = candidates[Math.floor((i * candidates.length) / Math.min(24, candidates.length))];
      if (reachable[Math.floor(p.y) * t.width + Math.floor(p.x)]) points.push(p);
    }
    return points;
  }
  for (const seed of seeds) {
    const base = sim.newGame(seed, 20);
    for (const station of base.world.stations) {
      const town = station.local,
        reachable = local.reachableTiles(town, town.platform);
      const patrol = local.inspectionPoints(town),
        legacy = legacyPoints(town);
      let probes = 0,
        omitted = 0,
        legacyOmitted = 0,
        trialPoint;
      for (let y = 2; y < town.height - 2; y++)
        for (let x = 2; x < town.width - 2; x++) {
          if (!reachable[y * town.width + x]) continue;
          for (const [dx, dy] of [
            [0.2, 0.2],
            [0.8, 0.2],
            [0.5, 0.5],
            [0.2, 0.8],
            [0.8, 0.8],
          ]) {
            const p = { x: x + dx, y: y + dy };
            if (!local.coverAt(town, p)) continue;
            probes++;
            if (!seen(town, patrol, p)) omitted++;
            if (!seen(town, legacy, p)) {
              legacyOmitted++;
              trialPoint ??= p;
            }
          }
        }
      rows.push({
        seed,
        district: station.id,
        kind: station.kind,
        probes,
        omitted,
        legacyOmitted,
        patrolPoints: patrol.length,
      });
      if (!trialKinds.has(station.kind) && trialPoint) {
        trialKinds.add(station.kind);
        const s = sim.deserialize(sim.serialize(base));
        s.phase = 'search';
        s.time = s.searchAt = 0;
        s.rules.searchCap = 1200;
        s.hider = 0;
        s.committed = station.id;
        s.locked = true;
        s.localAt = 0;
        s.hand = [];
        s.pending = null;
        s.rewards = [];
        s.questionReady = s.cardReady = 1e9;
        s.candidates = [station.id];
        s.hideSpot = { ...trialPoint };
        for (const a of s.actors)
          Object.assign(a, {
            station: station.id,
            path: [],
            destination: null,
            journey: [],
            nextThink: 0,
            x: town.platform.x + (a.id === 1 ? -1 : 1),
            y: town.platform.y,
          });
        Object.assign(s.actors[0], trialPoint, { hiding: true, nextThink: 1e9 });
        let steps = 0;
        while (s.phase === 'search' && steps++ < 1201) sim.tick(s, 1);
        trials.push({
          seed,
          kind: station.kind,
          district: station.id,
          point: trialPoint,
          captured: s.results.at(-1)?.reason.startsWith('Tagged') ?? false,
          seconds: Math.round(s.time),
          reason: s.results.at(-1)?.reason ?? 'Audit cap',
        });
      }
    }
  }
  const s = sim.newGame('sprint-measurement', 20);
  sim.startRound(s);
  s.actors.forEach((a) => (a.nextThink = 1e9));
  const town = s.world.stations[s.actors[0].station].local;
  town.tiles.fill(1);
  town.cover = [];
  town.props = [];
  town.buildings = [];
  Object.assign(s.actors[0], { x: 10.5, y: 10.5 });
  const run = sim.deserialize(sim.serialize(s));
  sim.tick(s, 2, { x: 1, y: 0 });
  sim.tick(run, 2, { x: 1, y: 0, sprint: true });
  const walkDistance = s.actors[0].x - 10.5,
    sprintDistance = run.actors[0].x - 10.5;
  const target = { ...s.actors[0], x: 10.5, y: 10.5, hiding: false };
  const observer = { x: 18.5, y: 10.5 };
  const sprint = {
    walkDistance,
    sprintDistance,
    ratio: sprintDistance / walkDistance,
    walkVisibleAtEightTiles: local.canSeeActor(town, observer, target),
    sprintVisibleAtEightTiles: local.canSeeActor(town, observer, { ...target, sprinting: true }),
    samples: { walking: s.movementMetrics, sprinting: run.movementMetrics },
    conclusion:
      'Mechanical risk exists near seekers. Human sprint preference and stamina changes remain unvalidated; no movement-balance change made.',
  };
  const total = rows.reduce(
    (sum, row) => ({
      probes: sum.probes + row.probes,
      omitted: sum.omitted + row.omitted,
      legacyOmitted: sum.legacyOmitted + row.legacyOmitted,
    }),
    { probes: 0, omitted: 0, legacyOmitted: 0 },
  );
  const report = {
    method:
      'Five probes per reachable cover cell across three fixed 20-station seeds. Legacy 24-sample patrol compared on the same new maps. Isolated stationary-hider trials disable questions/cards and allow up to 1200 game seconds; this is not a normal-match balance or human-enjoyment test.',
    total,
    rows,
    trials,
    sprint,
  };
  await mkdir('artifacts/release', { recursive: true });
  await writeFile('artifacts/release/stealth-audit.json', JSON.stringify(report, null, 2));
  await writeFile(
    'docs/BALANCE.md',
    `# Hiding and sprint measurements

Generated by \`npm run audit:stealth\`. These are deterministic geometry probes and controlled simulations, not completed human playtests.

## Inspection coverage

Across ${rows.length} districts from three fixed seeds, ${total.probes.toLocaleString('en-US')} reachable hiding probes were tested. The new public-geometry patrol omitted **${total.omitted}**. The previous at-most-24-extra-point sampler, evaluated on the same new districts, omitted **${total.legacyOmitted.toLocaleString('en-US')}**. This compares inspection algorithms on the current geography; it is not a measurement of old-release win rates.

Every patrol point is chosen without the hider's position. The audit samples five positions per eligible walking cell and requires both reveal range and line of sight. Unit checks also cover all eight district families and entrances across three fixed seeds.

## Isolated stationary-hider trials

Questions and cards are disabled. Seekers begin at the local platform, use public patrols, stay together, and receive a 1200-second audit cap. Each chosen hiding probe was outside the old sampler's coverage. These conditions deliberately differ from normal matches.

| District | Captured | Game seconds | Exceeds Quick's ${quickCap}-second cap |
| --- | --- | ---: | --- |
${trials.map((t) => `| ${t.kind} | ${t.captured ? 'Yes' : 'No'} | ${t.seconds} | ${t.seconds > quickCap ? 'Yes' : 'No'} |`).join('\n')}

A complete inspection plan does not guarantee a capture during a six-minute search, particularly against a moving player. Human pacing and corner-camping results remain unmeasured.

## Sprint

In a clear two-second corridor test, walking covered ${walkDistance.toFixed(2)} tiles and sprinting ${sprintDistance.toFixed(2)}: **${sprint.ratio.toFixed(2)}×**. At eight tiles with a clear sightline, the walking target was ${sprint.walkVisibleAtEightTiles ? 'visible' : 'unseen'} and the sprinting target was ${sprint.sprintVisibleAtEightTiles ? 'visible' : 'unseen'}. No stamina, speed or detection balance change was made.

Movement and sprint time now accumulate locally by phase and role in saved matches and exported support reports. No data is transmitted. Real-player sprint uptime and reasons for walking must be collected using [the playtest protocol](PLAYTEST.md) before choosing a stamina system or different default pace.

Full per-district measurements are in \`artifacts/release/stealth-audit.json\`.
`,
  );
  console.log(
    JSON.stringify(
      { districts: rows.length, ...total, localTrials: trials, sprintRatio: sprint.ratio },
      null,
      2,
    ),
  );
  if (total.omitted) throw new Error(`${total.omitted} hiding probes remain uninspected.`);
} finally {
  await server.close();
}
