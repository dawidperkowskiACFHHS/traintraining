import type { State, Point } from './types';
import { seekerPlan, type Plan, type SeekerView } from './ai';
import { QUESTIONS, informationGain } from './questions';
import { CARDS, cardLegal } from './cards';
import { route, KIND_NAMES } from './world';
import { coverAt, insideBuilding } from './local';

export type NpcPlan =
  | Plan
  | { kind: 'card'; index: number; cardId: number; extra: number[] }
  | { kind: 'hold' }
  | { kind: 'hide-at'; target: number; point: Point };
export interface NpcChoice {
  label: string;
  plan: NpcPlan;
}
export interface NpcMenu {
  choices: NpcChoice[];
  context: Record<string, unknown>;
}
export function seekerMenu(view: SeekerView): NpcMenu {
  const fallback = seekerPlan(view),
    choices: NpcChoice[] = [{ label: 'Continue the current plan', plan: fallback }];
  if (!view.visibleHider && !view.errand && ['Suggest a plan', 'Search this area'].includes(view.command)) {
    const questions = QUESTIONS.filter((question) => view.legalQuestions.includes(question.id)).sort(
      (a, b) =>
        informationGain(view.world, view.candidates, b, view.self.station, view.self.previous) -
        informationGain(view.world, view.candidates, a, view.self.station, view.self.previous),
    );
    for (const question of questions.slice(0, 3))
      choices.push({ label: question.title, plan: { kind: 'question', question: question.id } });
    const town = view.world.stations[view.self.station].local;
    town.spots
      .map((point, index) => ({ point, index }))
      .filter((spot) => !view.self.searched.includes(spot.index))
      .slice(0, 3)
      .forEach((spot) =>
        choices.push({
          label: `Inspect hiding corner ${spot.index + 1} here`,
          plan: { kind: 'walk', point: spot.point, target: spot.index },
        }),
      );
    if (view.command === 'Suggest a plan') {
      const destinations = view.candidates
        .filter((id) => id !== view.self.station)
        .sort(
          (a, b) =>
            (route(view.world, view.self.station, a, view.time).at(-1)?.arrive ?? Infinity) -
            (route(view.world, view.self.station, b, view.time).at(-1)?.arrive ?? Infinity),
        );
      for (const target of destinations.slice(0, 3))
        choices.push({
          label: `Investigate ${view.world.stations[target].name}`,
          plan: { kind: 'travel', target },
        });
    }
  }
  return {
    choices,
    context: {
      role: 'seeker',
      station: view.world.stations[view.self.station].name,
      command: view.command,
      partnerStation: view.world.stations[view.partner.station].name,
      visibleHider: view.visibleHider,
      candidates: view.candidates.map((id) => ({
        id,
        name: view.world.stations[id].name,
        kind: KIND_NAMES[view.world.stations[id].kind],
      })),
      questionCooldown: !view.legalQuestions.length ? 'not ready' : 'ready',
    },
  };
}
export function hiderMenu(state: State, id: number): NpcMenu | null {
  const actor = state.actors[id];
  if (state.phase === 'preparation') {
    const choices = state.world.stations
      .filter((station) => station.id !== state.start)
      .map((station) => ({
        station,
        arrival: route(state.world, state.start, station.id, state.time + 2).at(-1)?.arrive ?? Infinity,
      }))
      .filter((option) => option.arrival < state.time + state.rules.headStart - 20)
      .sort((a, b) => a.arrival - b.arrival)
      .slice(0, 5)
      .map((option) => ({
        label: `Hide in ${option.station.name} (${Math.ceil(option.arrival - state.time)}s journey)`,
        plan: { kind: 'travel' as const, target: option.station.id },
      }));
    return choices.length
      ? {
          choices,
          context: {
            role: 'hider',
            phase: 'preparation',
            objective: 'Choose a reachable hiding district before the head start deadline.',
          },
        }
      : null;
  }
  if (state.phase === 'headstart') {
    if (actor.goal === 'hidden' && !actor.path.length) return null;
    const target = actor.target ?? actor.station,
      town = state.world.stations[target].local;
    return {
      choices: [...town.spots]
        .sort((a, b) => Number(!!coverAt(town, b)) - Number(!!coverAt(town, a)))
        .slice(0, 6)
        .map((point, index) => ({
          label: `Use ${coverAt(town, point)?.kind ?? (insideBuilding(town, point) !== null ? 'an indoor corner' : 'a courtyard')} ${index + 1} in ${state.world.stations[target].name}`,
          plan: { kind: 'hide-at' as const, target, point },
        })),
      context: {
        role: 'hider',
        phase: 'headstart',
        objective: 'Select a hiding corner at your own destination.',
        knownSeekers: state.lastKnown.map((known) => ({
          station: state.world.stations[known.station].name,
          time: known.time,
        })),
      },
    };
  }
  if (state.phase !== 'search') return null;
  const choices: NpcChoice[] = [{ label: 'Retain cards and wait', plan: { kind: 'hold' } }];
  state.hand.forEach((card, index) => {
    if (CARDS[card].type === 'bonus' || CARDS[card].reaction) return;
    const extra = state.hand
      .map((_, position) => position)
      .filter((position) => position !== index)
      .sort(
        (a, b) =>
          Number(CARDS[state.hand[a]].type === 'bonus') - Number(CARDS[state.hand[b]].type === 'bonus'),
      )
      .slice(0, CARDS[card].cost);
    if (!cardLegal(state, index, extra))
      choices.push({
        label: `Play ${CARDS[card].title}: ${CARDS[card].summary}`,
        plan: { kind: 'card', index, cardId: card, extra },
      });
  });
  if (choices.length === 1) return null;
  return {
    choices,
    context: {
      role: 'hider',
      phase: 'search',
      station: state.world.stations[actor.station].name,
      hand: state.hand.map((card) => ({
        title: CARDS[card].title,
        summary: CARDS[card].summary,
        type: CARDS[card].type,
      })),
      knownSeekers: state.lastKnown.map((known) => ({
        station: state.world.stations[known.station].name,
        time: known.time,
      })),
    },
  };
}
interface Advice {
  plan: NpcPlan;
  line: string;
  round: number;
  hider: number;
  station: number;
  expires: number;
}
const advice = new WeakMap<State, Map<number, Advice>>();
export function offerNpcAdvice(state: State, id: number, plan: NpcPlan, line: string) {
  if (id === 0 || id < 0 || id > 2) return;
  if (!advice.has(state)) advice.set(state, new Map());
  advice.get(state)!.set(id, {
    plan: structuredClone(plan),
    line: line.slice(0, 160),
    round: state.round,
    hider: state.hider,
    station: state.actors[id].station,
    expires: state.time + 60,
  });
}
export function takeNpcAdvice(state: State, id: number) {
  const result = advice.get(state)?.get(id);
  advice.get(state)?.delete(id);
  if (!result || result.round !== state.round || result.hider !== state.hider || result.expires < state.time)
    return null;
  if (result.plan.kind === 'walk' && result.station !== state.actors[id].station) return null;
  return result;
}
export function clearNpcAdvice(state: State) {
  advice.delete(state);
}
export function parseNpcReply(content: unknown, choices: NpcChoice[]) {
  if (typeof content !== 'string' || content.length > 4096)
    throw new Error('The model did not return a usable decision.');
  const value = JSON.parse(content) as { choice?: unknown; line?: unknown };
  if (
    !Number.isInteger(value.choice) ||
    typeof value.choice !== 'number' ||
    value.choice < 0 ||
    value.choice >= choices.length
  )
    throw new Error('The model selected an unavailable action.');
  return {
    plan: choices[value.choice].plan,
    line: typeof value.line === 'string' ? value.line.replace(/[\u0000-\u001f]/g, ' ').slice(0, 160) : '',
  };
}
