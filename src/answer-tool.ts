import type { State, Pending } from './types';
import { answerChallenge } from './answer-challenge';
import { landscape, mapX, mapY } from './map-art';
import { resolveEvidence } from './questions';
import { photoData } from './art';
const photos = new WeakMap<Pending, string>();

/** A hider's field kit prepares evidence. It never offers a way to falsify it. */
export function answerTool(s: State, prepared: boolean, escape: (text: unknown) => string) {
  const prompt = answerChallenge(s)!;
  const { q, correct, tool } = prompt,
    p = s.pending!,
    home = s.world.stations[s.committed!],
    origin = s.world.stations[p.origin];
  let picture = '';
  if (q.category === 'Photo') {
    let image = photos.get(p);
    if (!image) {
      const photo = resolveEvidence(s, q.id, p.origin, p.previous).photo!;
      image = photoData(s.world.stations[photo.station], photo.x, photo.y, photo.subject);
      photos.set(p, image);
    }
    picture = `<div class="answer-camera ${prepared ? 'exposed' : ''}"><img src="${image}" alt="${escape(q.title)}"/><span aria-hidden="true"></span></div>`;
  } else {
    const hx = mapX(home.x),
      hy = mapY(home.y),
      ox = mapX(origin.x),
      oy = mapY(origin.y);
    const previous = s.world.stations[p.previous];
    const feature =
      q.category === 'Measuring'
        ? q.arg === 'coast'
          ? { x: 88, y: home.y }
          : s.world.landmarks.find((point) => point.kind === q.arg)
        : q.category === 'Tentacles'
          ? [
              ...s.world.landmarks,
              ...s.world.stations,
              { name: 'Northwest', x: 0, y: 0 },
              { name: 'Northeast', x: 100, y: 0 },
              { name: 'Southwest', x: 0, y: 100 },
              { name: 'Southeast', x: 100, y: 100 },
            ].find((point) => point.name === correct)
          : null;
    const line = feature
      ? `M${hx} ${hy}L${mapX(feature.x)} ${mapY(feature.y)}`
      : q.category === 'Thermometer'
        ? `M${mapX(previous.x)} ${mapY(previous.y)}L${hx} ${hy}L${ox} ${oy}`
        : `M${ox} ${oy}L${hx} ${hy}`;
    picture = `<svg class="answer-instrument" viewBox="0 0 650 550" aria-label="Your district and the asking station" role="img">${landscape(s.world)}${prepared ? `<path class="answer-trace" d="${line}" pathLength="1" fill="none" stroke="#9b514e" stroke-width="7"/>` : ''}${feature ? `<path d="M${mapX(feature.x) - 10} ${mapY(feature.y)}h20m-10-10v20" stroke="#8b633d" stroke-width="5"/>` : ''}<circle cx="${ox}" cy="${oy}" r="11" fill="#fff8e6" stroke="#5d566d" stroke-width="5"/><circle cx="${hx}" cy="${hy}" r="12" fill="#4b7460" stroke="#fff8e6" stroke-width="5"/>${prepared && q.category === 'Radar' ? `<circle class="answer-radar" cx="${hx}" cy="${hy}" r="37" fill="none" stroke="#4b7460" stroke-width="5"/>` : ''}</svg>`;
  }
  return `<div class="answer-preparation ${prepared ? 'prepared' : ''}" data-tool="${q.category.toLowerCase()}"><div class="answer-device"><span class="answer-tool-name">${tool.name}</span>${picture}<span class="answer-origin">${escape(home.name)} · question from ${escape(origin.name)}</span></div><div class="reply-ticket"><span>${prepared ? tool.ready : 'Prepare your reply'}</span><strong class="reply-value">${prepared ? escape(q.category === 'Photo' ? 'Photo attached' : correct) : '—'}</strong><button class="primary-button" data-action="${prepared ? 'answer' : 'prepare-answer'}">${prepared ? 'Send reply' : tool.action}</button><small>Draw ${q.draw}, keep ${q.keep} after replying.</small></div></div>${prepared ? `<p class="field-guide">${escape(prompt.guide)}</p>` : '<p class="answer-assurance">Your kit works out the truthful reply. You choose when to send it.</p>'}`;
}
