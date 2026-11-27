import type { State } from './types';
export const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
export function setPlaybackSpeed(s: State, requested?: number) {
  s.speed = PLAYBACK_SPEEDS.includes(requested as 1 | 2 | 4 | 8)
    ? requested!
    : PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(s.speed as 1 | 2 | 4 | 8) + 1) % PLAYBACK_SPEEDS.length];
}
