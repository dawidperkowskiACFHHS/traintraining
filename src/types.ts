import type { Appearance } from './appearance';
export interface Point {
  x: number;
  y: number;
}
export type Archetype = 'city' | 'market' | 'coast' | 'lake' | 'forest' | 'hill' | 'rail' | 'rural';
export interface Station extends Point {
  id: number;
  name: string;
  kind: Archetype;
  zone: string;
  line: number;
  layout: number;
  roof: number;
  landmark: string;
  local: Town;
}
export interface Building {
  style?: Archetype;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  roof: number;
  door: Point;
  interior: Point;
}
export interface Town {
  cover?: Cover[];
  width: number;
  height: number;
  tiles: number[];
  buildings: Building[];
  spots: Point[];
  platform: Point;
  attraction: Point;
  bridge: Point;
  bench: Point;
  scenic: Point;
  props: { kind: string; x: number; y: number }[];
}
export interface Cover extends Point {
  kind: 'bush' | 'crate' | 'hedge';
  hide: Point;
}
export interface Edge {
  bend?: Point;
  a: number;
  b: number;
  duration: number;
  every: number;
  offset: number;
  kind: 'local' | 'express' | 'ferry' | 'walk' | 'bus';
  line: number;
}
export interface World {
  seed: string;
  stations: Station[];
  edges: Edge[];
  landmarks: { name: string; x: number; y: number; kind: string }[];
}
export interface Leg {
  service?: { mode: 'fast' | 'signal' | 'repair'; seconds: number; scheduled: number };
  from: number;
  to: number;
  depart: number;
  arrive: number;
  kind: Edge['kind'];
  line: number;
}
export interface Resident extends Point {
  station: number;
  index: number;
  dir: number;
  path: Point[];
  activity: string;
  step: number;
  until: number;
  updated: number;
  indoors: boolean;
  talkUntil?: number;
  dialogue?: string;
  dialogueActivity?: string;
  dialogueUntil?: number;
  advice?: { activity: string; until: number };
  memory?: string[];
  greeted?: number;
}
export interface Actor extends Point {
  evades?: number;
  evadeAt?: number;
  smokeUntil: number;
  followAt: number;
  hiding: boolean;
  sprinting: boolean;
  id: number;
  station: number;
  previous: number;
  dir: number;
  path: Point[];
  destination: number | null;
  journey: Leg[];
  goal: string;
  target: number | null;
  spot: number;
  visited: number[];
  searched: number[];
  nextThink: number;
  inside: number | null;
  memory: string[];
}
export type Category = 'Matching' | 'Measuring' | 'Radar' | 'Thermometer' | 'Tentacles' | 'Photo';
export interface Question {
  id: string;
  category: Category;
  title: string;
  anchor: 'station' | 'district' | 'position';
  arg: string | number;
  draw: number;
  keep: number;
}
export interface Evidence {
  time: number;
  question: string;
  answer: string;
  category: Category;
  origin: number;
  previous: number;
  excluded: number[];
  anchor: string;
  photo?: { station: number; x: number; y: number; subject: string };
  stale?: boolean;
}
export interface Pending {
  id: string;
  origin: number;
  previous: number;
  askedBy: number;
  changed: boolean;
}
export interface Effect {
  card: number;
  slot: 'movement' | 'investigation';
  until: number;
  target?: { station: number; x: number; y: number };
  progress: number;
  charges: number;
  category?: Category;
  cleared: boolean;
  worker?: number;
  puzzle?: number[];
  input?: number[];
  resolveAt?: number;
}
export interface Reward {
  cards: number[];
  keep: number;
}
export interface Event {
  speaker?: number;
  card?: number;
  time: number;
  type: string;
  text: string;
  actor?: number;
  station?: number;
  x?: number;
  y?: number;
  visibleToHuman?: boolean;
}
export interface RoundResult {
  hider: number;
  survival: number;
  bonus: number;
  score: number;
  forfeit: boolean;
  reason: string;
  district: number;
  events: Event[];
  evidence?: Evidence[];
}
export interface Settings {
  autoQuestions?: boolean;
  masterVolume?: number;
  musicVolume?: number;
  effectsVolume?: number;
  ambienceVolume?: number;
  textScale: number;
  reducedMotion: boolean;
  panelPause: boolean;
  simplified: boolean;
  sound: boolean;
  bindings: Record<string, string>;
}
export interface Rules {
  seekerSpeed?: number;
  sightRange?: number;
  targetPoints?: number;
  headStart: number;
  searchCap: number;
  questionCooldown: number;
  cardCooldown: number;
  walkSpeed: number;
}
export interface State {
  residents?: Resident[];
  residentChat?: { station: number; index: number; at: number } | null;
  movementMetrics?: Record<string, { movingSeconds: number; sprintSeconds: number; distance: number }>;
  questionSuggestion?: { id: string; actor: number; origin: number; previous: number } | null;
  session?: { pace: 'quick' | 'classic'; difficulty: 'relaxed' | 'standard' | 'sharp' };
  coach?: {
    step: number;
    origin: Point;
    target: number;
    completed: boolean;
    usedCard?: boolean;
    assisted?: boolean;
  };
  questionOrder: string[];
  appearance: Appearance;
  version: number;
  world: World;
  rng: number;
  rules: Rules;
  mode: 'match' | 'hider' | 'seeker' | 'tutorial';
  phase: 'preparation' | 'headstart' | 'search' | 'results' | 'finished';
  time: number;
  phaseAt: number;
  searchAt: number;
  localAt: number | null;
  hider: number;
  round: number;
  set: number;
  start: number;
  order: number[];
  actors: Actor[];
  committed: number | null;
  hideSpot: Point | null;
  locked: boolean;
  relocating: boolean;
  escapeUsed: boolean;
  hand: number[];
  deck: number[];
  discard: number[];
  handLimit: number;
  effects: Effect[];
  cleared: number[];
  cardReady: number;
  questionReady: number;
  pending: Pending | null;
  rewards: Reward[];
  doubleDip: boolean;
  activeTools: { card: number; until: number }[];
  revealUntil: number;
  lastKnown: { id: number; station: number; time: number; x?: number; y?: number }[];
  candidates: number[];
  evidence: Evidence[];
  blocked: Record<string, number>;
  usedQuestions: string[];
  teamCommand: string;
  teamTarget: number;
  teamPoint: Point | null;
  totals: number[];
  results: RoundResult[];
  roundScores: RoundResult[];
  events: Event[];
  notes: Record<string, string>;
  paused: boolean;
  speed: number;
  message: string;
  winner: number | null;
  autoHuman: boolean;
  settings: Settings;
}
export interface Card {
  id: number;
  title: string;
  type: 'curse' | 'tool' | 'bonus';
  slot?: 'movement' | 'investigation';
  duration: number;
  cost: number;
  summary: string;
  rules: string;
  flavor: string;
  art: string;
  reaction?: boolean;
}
