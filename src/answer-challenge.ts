import type { State } from './types';
import { QUESTIONS, valueAt } from './questions';
import { KIND_NAMES, LINE_NAMES, km } from './world';
import { distance } from './random';

// A field guide for the hider only. Never include this in an NPC seeker view.
export function answerChallenge(s: State) {
  const p = s.pending;
  if (!p || s.committed === null) return null;
  const q = QUESTIONS.find((item) => item.id === p.id)!;
  const home = s.world.stations[s.committed],
    origin = s.world.stations[p.origin];
  const correct = valueAt(s.world, q, p.origin, p.previous, s.committed);
  const tool = {
    Matching: { name: 'Field map', action: 'Compare our stations', ready: 'Stations compared' },
    Measuring: { name: 'Survey kit', action: 'Trace the distances', ready: 'Distances measured' },
    Radar: { name: 'Pocket radar', action: 'Run radar sweep', ready: 'Range checked' },
    Thermometer: { name: 'Travel log', action: 'Compare the journey', ready: 'Journey compared' },
    Tentacles: { name: 'Compass', action: 'Find the nearest marker', ready: 'Nearest marker found' },
    Photo: { name: 'Camera', action: 'Take photograph', ready: 'Photograph ready' },
  }[q.category];
  let guide = `You committed to ${home.name}. The question comes from ${origin.name}.`;
  if (q.arg === 'zone') guide += ` Your half: ${home.zone}. Their half: ${origin.zone}.`;
  else if (q.arg === 'kind')
    guide += ` Your district: ${KIND_NAMES[home.kind]}. Theirs: ${KIND_NAMES[origin.kind]}.`;
  else if (q.arg === 'line')
    guide += ` Your home line: ${LINE_NAMES[home.line]}. Theirs: ${LINE_NAMES[origin.line]}.`;
  else if (q.arg === 'name') guide += ` Check the first letter of “${home.name}”. A through M counts as Yes.`;
  else if (q.category === 'Matching')
    guide += ` Your landmark: ${home.landmark}. Theirs: ${origin.landmark}.`;
  else if (q.category === 'Radar')
    guide += ` The stations are ${km(s.world, p.origin, home.id).toFixed(1)} km apart. Compare this with ${q.arg} km.`;
  else if (q.category === 'Thermometer')
    guide += ` Before their journey: ${km(s.world, p.previous, home.id).toFixed(1)} km away. Now: ${km(s.world, p.origin, home.id).toFixed(1)} km away.`;
  else if (q.category === 'Measuring') {
    const feature = s.world.landmarks.find((point) => point.kind === q.arg);
    const from = (point: typeof home) =>
      q.arg === 'coast' ? Math.abs(88 - point.x) : distance(point, feature!);
    guide += ` Your distance: ${from(home).toFixed(1)} km. Their distance: ${from(origin).toFixed(1)} km.`;
  } else if (q.category === 'Tentacles') guide += ` Your closest marker is ${correct}.`;
  else if (q.category === 'Photo')
    guide += ` Look at your ${q.arg === 'station' ? 'station roof' : q.arg === 'landmark' ? 'district landmark' : 'immediate surroundings'}. Sending this shares an actual picture with the seekers.`;
  return { q, correct, tool, guide, key: `${s.round}:${p.id}:${p.origin}:${p.previous}` };
}
