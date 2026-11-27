import type { Card, State, Category } from './types';
import { CATEGORIES, QUESTIONS } from './questions';
import { pathfind } from './local';
import { inTransit } from './transit';
const rows: [string, Card['type'], Card['slot'], number, number, string, string, string, string][] = [
  [
    'Tourist Trap',
    'curse',
    'investigation',
    60,
    0,
    'Visit an attraction; linger for 20s.',
    'An attraction within 15 seconds’ walking distance. Blocks new questions until one seeker stays there for 20 uninterrupted seconds. Expires after 60 seconds.',
    'You can leave after visiting the gift shop.',
    'magnets',
  ],
  [
    'Bridge Club',
    'curse',
    'investigation',
    60,
    0,
    'Reach a bridge; stay for 15s.',
    'A bridge within 25 seconds’ walking distance. Blocks new questions until a seeker remains for 15 seconds. Expires after 60 seconds.',
    'Membership requires standing around.',
    'pigeons',
  ],
  [
    'Department of Forms',
    'curse',
    'investigation',
    30,
    0,
    'Match stamps to unlock questions.',
    'Complete the stamp puzzle after at least 10 seconds. Automatic clearance at 30 seconds. Simplified resolution is available.',
    'Your application to continue is being processed.',
    'stamp',
  ],
  [
    'Wrong Platform',
    'curse',
    'movement',
    30,
    1,
    'No train boarding for 30s.',
    'Both seekers cannot board trains for 30 seconds. Existing journeys, ferries, walking and questions continue.',
    'Good news: that was definitely a train.',
    'train',
  ],
  [
    'Right Is Right',
    'curse',
    'movement',
    45,
    1,
    'No left turns at junctions for 45s.',
    'Both seekers must go straight or turn right at street junctions. Turning around is permitted at dead ends. Questions and reachable transit remain available.',
    'Left has been temporarily discontinued.',
    'compass',
  ],
  [
    'Brain Fog',
    'curse',
    'investigation',
    45,
    1,
    'Lock one category for two answers.',
    'Disables a selected category until two questions in other categories are answered or 45 seconds pass. Cannot remove the final category.',
    'You knew what you were going to ask.',
    'brain',
  ],
  [
    'One Percent Battery',
    'curse',
    'investigation',
    20,
    0,
    'Pause new questions for 20s.',
    'No new investigation questions for 20 seconds. Existing pending questions, movement and local searches continue.',
    'Please remain connected to your vegetable.',
    'potato',
  ],
  [
    'Five More Minutes',
    'curse',
    'movement',
    25,
    1,
    'Stop both seekers’ travel for 25s.',
    'Both seekers must be off transit. Stops walking and boarding for 25 seconds. Questions continue. Physical curse errands cannot progress.',
    'Departure time is a state of mind.',
    'alarm',
  ],
  [
    'Scenic Route',
    'curse',
    'movement',
    60,
    0,
    'Visit the nominated flower.',
    'One seeker must visit a reachable scenic waypoint, adding no more than 30 seconds of walking, before either can board. Expires after 60 seconds.',
    'The journey is approximately the entire problem.',
    'flower',
  ],
  [
    'Platform Picnic',
    'curse',
    'movement',
    60,
    0,
    'Sit by a station bench for 20s.',
    'A reachable station bench is required. One seeker must remain there for 20 uninterrupted seconds before either seeker boards. Expires after 60 seconds.',
    'We packed light. Emotionally.',
    'picnic',
  ],
  [
    'Crossword Emergency',
    'curse',
    'investigation',
    60,
    1,
    'Next two answers add 10s cooldown.',
    'Adds ten seconds after each of the next two answered questions. Maximum additional delay 20 seconds. Unused charges expire after 60 seconds.',
    'Down: your chances.',
    'crossword',
  ],
  [
    'Lost Luggage',
    'curse',
    'movement',
    60,
    1,
    'Retrieve a runaway suitcase.',
    'Spawns public luggage within 20 seconds’ walk of a seeker. Neither can board until it is retrieved. Questions and local searches continue. Expires after 60 seconds.',
    'Your baggage has started a new life.',
    'luggage',
  ],
  [
    'Absolutely Not',
    'tool',
    undefined,
    0,
    0,
    'Cancel the pending question.',
    'Reaction before an answer: cancel the question with no reward. The exact question is blocked for 60 seconds; normal question cooldown applies.',
    'Thank you for your lack of understanding.',
    'reject',
  ],
  [
    'Ask Me Something Else',
    'tool',
    undefined,
    0,
    0,
    'Replace a question in its category.',
    'Reaction: replace a pending question with a random legal alternative in the same category. Only one question change. Selection never depends on the secret answer.',
    'Excellent question. Here’s a different one.',
    'fan',
  ],
  [
    'Spring Cleaning',
    'tool',
    undefined,
    0,
    1,
    'Discard one extra. Draw three.',
    'Pay one additional card, draw three, then resolve the hand limit.',
    'Organization through weather.',
    'blower',
  ],
  [
    'Suspiciously Large Pockets',
    'tool',
    undefined,
    0,
    0,
    'Gain one hand space, up to seven.',
    'Increases capacity by one for this hiding turn. A second copy can increase it again, to a maximum of seven.',
    'Yes, these are carry-on dimensions.',
    'coat',
  ],
  [
    'Double Dip',
    'tool',
    undefined,
    0,
    1,
    'Double your next question reward.',
    'Receive the next answered question’s normal draw-and-keep reward twice, separately. Canceled questions do not consume this tool. Only one may wait.',
    'One question. Two opportunities to be annoying.',
    'fondue',
  ],
  [
    'Where Are You Again?',
    'tool',
    undefined,
    10,
    1,
    'Reveal seekers on the map for 10s.',
    'Shows current regional positions for ten seconds. Then retains timestamped last-known markers. Does not reveal plans.',
    'Just checking you’re enjoying yourselves.',
    'binoculars',
  ],
  [
    'Changed My Mind',
    'tool',
    undefined,
    0,
    0,
    'End your curse. Draw two.',
    'Requires one active curse you cast. Voluntary removal does not qualify for Souvenir Collection.',
    'Upon further consideration, please proceed.',
    'roadblock',
  ],
  [
    'Emergency Exit',
    'tool',
    undefined,
    15,
    2,
    'Dash to another hiding spot.',
    'Once during local search. Pay two additional cards; follow a legal path to another hiding spot, with a 25% speed burst for six seconds. The path must take at most 15 seconds at normal speed. Remain visible and capturable. Seekers are notified; exact-position evidence becomes stale.',
    'The landscaping has reconsidered its position.',
    'bush',
  ],
  [
    'Bus Nap',
    'bonus',
    undefined,
    30,
    0,
    'Retain for +30s.',
    'Retain until round end. Only the best two qualifying bonuses count, combined cap +120 seconds.',
    'Wake me when we’ve won.',
    'nap',
  ],
  [
    'Snack Break',
    'bonus',
    undefined,
    60,
    0,
    'Retain for +60s.',
    'Retain until round end. Only the best two qualifying bonuses count, combined cap +120 seconds.',
    'A tactical deployment of lunch.',
    'sandwich',
  ],
  [
    'Souvenir Collection',
    'bonus',
    undefined,
    60,
    0,
    'Keep: +20s per curse actively cleared.',
    'Twenty seconds per distinct curse design actively cleared by seekers, maximum +60. Natural expiry and voluntary cancellation do not qualify. Retain until end.',
    'Every inconvenience tells a story.',
    'trophy',
  ],
  [
    'Still Here Somehow',
    'bonus',
    undefined,
    60,
    0,
    'Keep: +60s after 60s of local search.',
    'Survive at least 60 seconds after local search begins and retain this card. Otherwise worth zero.',
    'At this point, it’s a collaborative effort.',
    'treehat',
  ],
];
export const CARDS: Card[] = rows.map((r, id) => ({
  id,
  title: r[0],
  type: r[1],
  slot: r[2],
  duration: r[3],
  cost: r[4],
  summary: r[5],
  rules: r[6],
  flavor: r[7],
  art: r[8],
  reaction: id === 12 || id === 13,
}));
export const DECK = CARDS.flatMap((c) => Array(c.type === 'bonus' ? 3 : 2).fill(c.id) as number[]);
export function cardLegal(
  s: State,
  index: number,
  extra: number[] = [],
  category: Category = 'Radar',
): string | null {
  const id = s.hand[index],
    c = CARDS[id];
  if (!c) return 'Choose a card.';
  if (!['headstart', 'search'].includes(s.phase)) return 'Start the hiding turn first.';
  if (c.type === 'bonus') return 'Retain this card to score it. You can discard it to make room.';
  if (c.reaction && !s.pending) return 'Wait for a pending question.';
  if (c.reaction && s.pending?.changed) return 'This question has already been changed.';
  if (!c.reaction && s.time < s.cardReady) return `Card cooldown: ${Math.ceil(s.cardReady - s.time)}s.`;
  if (
    extra.length !== c.cost ||
    new Set(extra).size !== c.cost ||
    extra.some((i) => i === index || !CARDS[s.hand[i]])
  )
    return `Select ${c.cost} additional card${c.cost === 1 ? '' : 's'} to discard.`;
  if (c.slot && s.effects.some((e) => e.slot === c.slot)) return `The ${c.slot} curse slot is occupied.`;
  if (id === 7 && s.actors.some((a) => a.id !== s.hider && inTransit(a, s.time)))
    return 'Both seekers must be off transit.';
  if (id === 15 && s.handLimit >= 7) return 'Your hand is already at maximum capacity.';
  if (id === 16 && s.doubleDip) return 'Double Dip is already waiting.';
  if (id === 17 && s.revealUntil > s.time) return 'Seeker positions are already being revealed.';
  if (id === 18 && !s.effects.length) return 'You need an active curse to cancel.';
  if (id === 19) {
    if (s.phase !== 'search' || s.localAt === null || !s.locked || s.escapeUsed)
      return 'Available once after local search locks your position.';
    const h = s.actors[s.hider],
      t = s.world.stations[h.station].local;
    if (
      !t.spots.some(
        (p) => Math.hypot(p.x - h.x, p.y - h.y) > 2 && pathfind(t, h, p).length / s.rules.walkSpeed <= 15,
      )
    )
      return 'No valid relocation within 15 seconds.';
  }
  if (id === 13) {
    const p = s.pending!,
      q = QUESTIONS.find((q) => q.id === p.id)!;
    if (
      !QUESTIONS.some(
        (a) =>
          a.category === q.category &&
          a.id !== q.id &&
          !s.usedQuestions.includes(
            `${a.id}:${p.origin}:${a.category === 'Thermometer' ? p.previous : ''}`,
          ) &&
          (s.blocked[`${a.id}:${p.origin}:${a.category === 'Thermometer' ? p.previous : ''}`] || 0) <=
            s.time &&
          (a.category !== 'Thermometer' || p.origin !== p.previous),
      )
    )
      return 'No valid alternative.';
  }
  if (id === 5 && !CATEGORIES.includes(category)) return 'Choose a question category.';
  if ([0, 1, 8, 9, 11].includes(id) && !curseTarget(s, id))
    return 'No reachable target within this card’s walking limit.';
  return null;
}
export function curseTarget(s: State, id: number) {
  for (const a of s.actors.filter((a) => a.id !== s.hider && !inTransit(a, s.time))) {
    const town = s.world.stations[a.station].local;
    let p =
      id === 0
        ? town.attraction
        : id === 1
          ? town.bridge
          : id === 8
            ? town.scenic
            : id === 9
              ? town.bench
              : town.scenic;
    if (id === 11) {
      const options = [town.scenic, town.attraction, town.bridge, town.bench, town.platform]
        .map((p) => ({ p, length: pathfind(town, a, p).length }))
        .filter((o) => o.length >= 6 && o.length / s.rules.walkSpeed <= 20)
        .sort((a, b) => b.length - a.length);
      if (!options.length) continue;
      p = options[0].p;
    }
    const length = pathfind(town, a, p).length,
      limit = id === 0 ? 15 : id === 1 ? 25 : id === 11 ? 20 : 30;
    if (id === 8) {
      const added =
        (length + pathfind(town, p, town.platform).length - pathfind(town, a, town.platform).length) /
        s.rules.walkSpeed;
      if (added > 30) continue;
    }
    if (length && length / s.rules.walkSpeed <= limit) return { station: a.station, ...p };
  }
  return null;
}
export function bonusScore(s: State): number {
  return Math.min(
    120,
    s.hand
      .map((id) =>
        id === 20
          ? 30
          : id === 21
            ? 60
            : id === 22
              ? Math.min(60, new Set(s.cleared).size * 20)
              : id === 23 && s.localAt !== null && s.time - s.localAt >= 60
                ? 60
                : 0,
      )
      .sort((a, b) => b - a)
      .slice(0, 2)
      .reduce((a, b) => a + b, 0),
  );
}
