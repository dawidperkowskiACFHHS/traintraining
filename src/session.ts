import type { State } from './types';
export const FORMATS = {
  quick: {
    title: 'Quick journey',
    description: 'One set of three turns · 6-minute search cap',
    searchCap: 360,
    points: 3,
  },
  classic: {
    title: 'Classic match',
    description: 'First to 6 points · 10-minute search cap',
    searchCap: 600,
    points: 6,
  },
} as const;
export const DIFFICULTIES = {
  relaxed: {
    title: 'Relaxed',
    description: 'Seekers walk 18% slower and see 5 tiles. Extra time to react.',
    speed: 0.82,
    sight: 5,
  },
  standard: {
    title: 'Standard',
    description: 'Normal walking speed and 7-tile sightlines.',
    speed: 1,
    sight: 7,
  },
  sharp: {
    title: 'Sharp',
    description: 'Seekers walk 12% faster and see 8 tiles. Same truthful clues.',
    speed: 1.12,
    sight: 8,
  },
} as const;
export function configureSession(s: State, pace: string, difficulty: string) {
  const p = pace in FORMATS ? (pace as keyof typeof FORMATS) : 'quick';
  const d = difficulty in DIFFICULTIES ? (difficulty as keyof typeof DIFFICULTIES) : 'standard';
  s.session = { pace: p, difficulty: d };
  s.rules.searchCap = FORMATS[p].searchCap;
  s.rules.targetPoints = FORMATS[p].points;
  s.rules.seekerSpeed = DIFFICULTIES[d].speed;
  s.rules.sightRange = DIFFICULTIES[d].sight;
}
