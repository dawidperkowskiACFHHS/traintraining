import type { State } from './types';
import { canSeeActor, coverAt, lineOfSight, TAG_RANGE } from './local';
import { inTransit } from './transit';

export function canTag(s: State, id = 0) {
  const seeker = s.actors[id],
    hider = s.actors[s.hider];
  return (
    s.phase === 'search' &&
    id !== s.hider &&
    seeker.station === hider.station &&
    !inTransit(seeker, s.time) &&
    !inTransit(hider, s.time) &&
    Math.hypot(seeker.x - hider.x, seeker.y - hider.y) <= TAG_RANGE &&
    lineOfSight(s.world.stations[seeker.station].local, seeker, hider)
  );
}
export function stealthState(s: State): 'spotted' | 'concealed' | 'cover' | 'open' {
  const player = s.actors[0],
    town = s.world.stations[player.station].local;
  if (
    s.hider === 0 &&
    s.phase === 'search' &&
    !inTransit(player, s.time) &&
    s.actors.some(
      (seeker) =>
        seeker.id !== 0 &&
        seeker.station === player.station &&
        !inTransit(seeker, s.time) &&
        canSeeActor(town, seeker, player, s.rules.sightRange ?? 7),
    )
  )
    return 'spotted';
  if (player.hiding && coverAt(town, player)) return 'concealed';
  return coverAt(town, player) ? 'cover' : 'open';
}
