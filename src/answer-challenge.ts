import type { State } from './types';
import { QUESTIONS, valueAt } from './questions';
import { KIND_NAMES, LINE_NAMES, km } from './world';

// A field guide for the hider only. Never include this in an NPC seeker view.
export function answerChallenge(s: State) {
  const p = s.pending;
  if (!p || s.committed === null) return null;
  const q = QUESTIONS.find((item) => item.id === p.id)!;
  const home = s.world.stations[s.committed],
    origin = s.world.stations[p.origin];
  const correct = valueAt(s.world, q, p.origin, p.previous, s.committed);
  const values = [...new Set(s.world.stations.map((st) => valueAt(s.world, q, p.origin, p.previous, st.id)))];
  // Stable ordering does not consume match randomness or reveal the answer by position.
  const binary = values.length <= 2 && values.every((v) => v === 'Yes' || v === 'No');
  const choices = binary
    ? ['Yes', 'No']
    : [...new Set([correct, ...values])].sort((a, b) => a.localeCompare(b)).slice(0, 4);
  if (!choices.includes(correct)) choices[choices.length - 1] = correct;
  if (!binary) choices.sort((a, b) => a.localeCompare(b));
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
  else if (q.category === 'Photo')
    guide += ` Look at your ${q.arg === 'station' ? 'station roof' : q.arg === 'landmark' ? 'district landmark' : 'immediate surroundings'}. Sending this shares an actual picture with the seekers.`;
  return { q, correct, choices, guide, key: `${p.id}:${p.origin}:${p.previous}` };
}
