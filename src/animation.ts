import type { Actor, State } from './types';
import type { CharacterPose } from './art';

export function actorPose(s: State, actor: Actor, moving: boolean): CharacterPose {
  if (
    ['results', 'finished'].includes(s.phase) &&
    actor.id === s.hider &&
    s.results.at(-1)?.reason.startsWith('Tagged')
  )
    return 'caught';
  const recent = s.events.slice(-16);
  if (actor.hiding) {
    return !s.settings.reducedMotion &&
      recent.some((e) => e.type === 'cover' && e.actor === actor.id && s.time - e.time < 0.2)
      ? 'crouch'
      : 'hide';
  }
  if (
    recent.some(
      (e) => ['interact', 'card'].includes(e.type) && e.actor === actor.id && s.time - e.time < 0.45,
    )
  )
    return 'interact';
  return moving ? (actor.sprinting ? 'run' : 'walk') : 'idle';
}
export function poseFrame(pose: CharacterPose, time: number, reducedMotion: boolean) {
  if (reducedMotion) return 0;
  if (pose === 'walk' || pose === 'run') return 1 + (Math.floor(time / (pose === 'run' ? 0.085 : 0.14)) % 2);
  return pose === 'idle' ? Math.floor(time / 3) % 2 : pose === 'interact' ? Math.floor(time * 4) % 2 : 0;
}
