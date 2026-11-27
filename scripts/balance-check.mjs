import { createServer } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const sim = await server.ssrLoadModule('/src/simulation.ts');
  const { configureSession } = await server.ssrLoadModule('/src/session.ts');
  const rows = [];
  for (const seed of ['coastal-crossings', 'market-maze', 'woodland-detour', 'last-connection'])
    for (const difficulty of ['relaxed', 'standard', 'sharp'])
      for (const searchCap of [240, 360]) {
        const s = sim.newGame(seed, 20);
        configureSession(s, 'quick', difficulty);
        s.rules.searchCap = searchCap;
        const stages = { deductionAndLocal: 0, walkingToPlatform: 0, waiting: 0, riding: 0, curseActive: 0 };
        let stateSearchAt = 0,
          localStarted = null;
        const localDurations = [];
        s.autoHuman = true;
        const started = performance.now();
        let advances = 0;
        while (s.phase !== 'finished' && advances++ < 5000) {
          if (s.phase === 'preparation') sim.startRound(s);
          else if (s.phase === 'results') sim.nextRound(s);
          else {
            const searching = s.phase === 'search',
              actor = s.actors[0],
              leg = actor.journey[0],
              before = s.time;
            if (searching) {
              stateSearchAt = s.searchAt;
              localStarted = s.localAt;
            }
            const stage = leg
              ? s.time < leg.depart
                ? 'waiting'
                : 'riding'
              : actor.destination !== null
                ? 'walkingToPlatform'
                : 'deductionAndLocal';
            const cursed = s.effects.length > 0;
            sim.tick(s, 2);
            if (searching) {
              stages[stage] += s.time - before;
              if (cursed) stages.curseActive += s.time - before;
            }
            if (s.phase === 'results' && localStarted !== null)
              localDurations.push(Math.round(s.time - localStarted));
          }
        }
        if (s.phase !== 'finished') throw new Error(`Match stalled: ${seed}/${difficulty}`);
        rows.push({
          seed,
          difficulty,
          searchCap,
          stageSeconds: Object.fromEntries(
            Object.entries(stages).map(([key, value]) => [key, Math.round(value)]),
          ),
          localSearchSeconds: localDurations,
          lastSearchStarted: stateSearchAt,
          questions: s.results.reduce((n, r) => n + r.events.filter((e) => e.type === 'question').length, 0),
          curses: s.results.reduce((n, r) => n + r.events.filter((e) => e.type === 'curse').length, 0),
          escapes: s.results.reduce(
            (n, r) => n + r.events.filter((e) => e.text.includes('dashed for new cover')).length,
            0,
          ),
          simulatedSeconds: Math.round(s.time),
          computeMs: Math.round(performance.now() - started),
          winner: s.winner,
          rounds: s.results.length,
          captures: s.results.filter((r) => r.reason.includes('Tagged')).length,
          forfeits: s.results.filter((r) => r.forfeit).length,
          survival: s.results.map((r) => Math.round(r.survival)),
          districts: s.results.map((r) => r.district),
          layout: {
            biomes: [...new Set(s.world.stations.map((st) => st.kind))],
            services: [...new Set(s.world.edges.map((e) => e.kind))],
            coverGroups: s.world.stations.reduce((n, st) => n + (st.local.cover?.length ?? 0), 0),
          },
        });
      }
  const summaries = [240, 360].map((searchCap) => {
    const subset = rows.filter((row) => row.searchCap === searchCap),
      rounds = subset.reduce((n, row) => n + row.rounds, 0);
    return {
      searchCap,
      matches: subset.length,
      rounds,
      captures: subset.reduce((n, row) => n + row.captures, 0),
      forfeits: subset.reduce((n, row) => n + row.forfeits, 0),
      meanMatchSeconds: Math.round(subset.reduce((n, row) => n + row.simulatedSeconds, 0) / subset.length),
    };
  });
  await writeFile(
    'docs/QUICK-MATCH.md',
    '# Quick-match timing experiment\n\nMatched starting seeds across four regions and three difficulties, with automatic classic NPCs controlling all three roles. Both caps include normal deduction, card use, curse tasks, timetable waits, travel, and local searching. Subsequent choices can diverge after a cap changes the first result. These are progression and pacing checks, not human win-rate estimates.\n\n| Search cap | Matches | Turns | Captures | Forfeits | Mean match seconds |\n| --- | ---: | ---: | ---: | ---: | ---: |\n' +
      summaries
        .map(
          (r) =>
            '| ' +
            [r.searchCap + 's', r.matches, r.rounds, r.captures, r.forfeits, r.meanMatchSeconds].join(' | ') +
            ' |',
        )
        .join('\n') +
      '\n\nNew Quick journeys use a six-minute search cap. Classic remains ten minutes. Old saves keep their stored rules. Detailed stage totals in artifacts/release/balance-check.json are sampled every two game seconds; curse-active time overlaps other stages. Human deduction speed and the feel of escapes still need playtesting.\n',
  );
  await mkdir('artifacts/release', { recursive: true });
  await writeFile(
    'artifacts/release/balance-check.json',
    JSON.stringify(
      {
        method:
          'Deterministic classic-NPC simulations; not evidence of human enjoyment or balanced difficulty.',
        summaries,
        rows,
      },
      null,
      2,
    ),
  );
  console.log(
    `Completed ${rows.length} full matches across two caps and three difficulties without a progression stall. Human pacing and strategy validation remain pending.`,
  );
} finally {
  await server.close();
}
