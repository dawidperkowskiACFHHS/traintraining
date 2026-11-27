import type { State } from './types';
import { visibleEvent } from './simulation';
import info from '../package.json';
export const VERSION = info.version;
const frameTimes: number[] = [];
let last = 0;
export function recordFrame(now: number) {
  if (last && !document.hidden) {
    frameTimes.push(now - last);
    if (frameTimes.length > 3600) frameTimes.shift();
  }
  last = now;
}
export function exportReport(s: State) {
  const sorted = [...frameTimes].sort((a, b) => a - b),
    percentile = (p: number) => Math.round((sorted[Math.floor((sorted.length - 1) * p)] ?? 0) * 10) / 10;
  const report = {
    version: VERSION,
    created: new Date().toISOString(),
    seed: s.world.seed,
    session: s.session ?? { pace: 'classic', difficulty: 'standard' },
    mode: s.mode,
    phase: s.phase,
    round: s.round,
    time: s.time,
    practice: s.coach ?? null,
    platform: navigator.userAgent,
    viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
    controllerConnected: [...navigator.getGamepads()].some(Boolean),
    performance: {
      samples: sorted.length,
      medianMs: percentile(0.5),
      p95Ms: percentile(0.95),
      framesOver50ms: sorted.filter((n) => n > 50).length,
    },
    settings: s.settings,
    movement: s.movementMetrics ?? {},
    candidateCount: s.candidates.length,
    results: s.results.map(({ hider, survival, bonus, reason }) => ({ hider, survival, bonus, reason })),
    events: s.events.filter((e) => visibleEvent(s, e) && e.type !== 'position').slice(-120),
    feedback: {
      goalWasClear: '',
      cleverDecision: '',
      confusingMoment: '',
      wantedAnotherRound: '',
      inputIssues: '',
    },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `last-stop-report-${s.world.seed.replace(/[^a-z0-9-]/gi, '').slice(0, 45)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function installRelease(onSave: () => void, getState: () => State) {
  let shown = false;
  const failure = (reason: unknown) => {
    if (shown) return;
    shown = true;
    getState().paused = true;
    const box = document.createElement('section');
    box.className = 'recovery-banner';
    box.setAttribute('role', 'alert');
    const title = document.createElement('h3');
    title.textContent = 'The journey paused unexpectedly.';
    const text = document.createElement('p');
    text.textContent =
      'Your previous save is retained. Export a report, then reload to continue or restore a backup in Settings.';
    const detail = document.createElement('small');
    detail.textContent = String(reason instanceof Error ? reason.message : reason).slice(0, 300);
    const report = document.createElement('button');
    report.className = 'outline-button';
    report.textContent = 'Export report';
    report.onclick = () => exportReport(getState());
    const reload = document.createElement('button');
    reload.className = 'primary-button';
    reload.textContent = 'Reload game';
    reload.onclick = () => location.reload();
    box.append(title, text, detail, report, reload);
    document.body.append(box);
  };
  window.addEventListener('error', (e) => {
    if (e instanceof ErrorEvent) failure(e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => failure(e.reason));
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    void navigator.serviceWorker
      .register('./sw.js')
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              const b = document.createElement('button');
              b.className = 'update-banner';
              b.textContent = 'Update ready · save and restart';
              b.onclick = () => {
                onSave();
                worker.postMessage('activate');
                navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
                  once: true,
                });
              };
              document.body.append(b);
            }
          });
        });
      })
      .catch(() => {
        /* The game can also run without offline caching. */
      });
    void fetch('./__desktop')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.app === 'last-stop') {
          const alive = () => void fetch('./__alive', { cache: 'no-store' }).catch(() => {});
          alive();
          setInterval(alive, 20000);
        }
      })
      .catch(() => {});
  }
}
