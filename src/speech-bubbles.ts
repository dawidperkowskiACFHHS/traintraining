import type { Event, State } from './types';
import { NAMES, visibleEvent } from './simulation';
import { inTransit } from './transit';

interface Speech {
  speaker: number;
  station: number;
  at: number;
  until: number;
  element: HTMLDivElement;
}
export class SpeechBubbles {
  private active: Speech[] = [];
  constructor(private root: HTMLElement) {}
  observe(event: Event, s: State) {
    if (!visibleEvent(s, event) || s.time - event.time > 2) return;
    let speaker = event.type === 'speech' ? event.speaker : undefined;
    if (event.type === 'teammate' && s.hider !== 0) {
      speaker = event.actor ?? NAMES.findIndex((name) => event.text.startsWith(name + ':'));
      if (speaker === s.hider || speaker === 0 || speaker < 0) return;
    }
    if (speaker === undefined || speaker < 1 || speaker > 5) return;
    const station = speaker < 3 ? s.actors[speaker].station : event.station;
    if (station !== s.actors[0].station || (speaker < 3 && inTransit(s.actors[speaker], s.time))) return;
    for (const old of this.active.filter((entry) => entry.speaker === speaker)) old.element.remove();
    this.active = this.active.filter((entry) => entry.speaker !== speaker);
    if (this.active.length >= 2) this.active.shift()!.element.remove();
    const split = event.text.indexOf(':');
    const name = split >= 0 ? event.text.slice(0, split) : (NAMES[speaker] ?? 'Resident');
    const text = split >= 0 ? event.text.slice(split + 1).trim() : event.text;
    const element = document.createElement('div');
    element.className = 'speech-bubble';
    element.dataset.speaker = String(speaker);
    element.hidden = true;
    const title = document.createElement('strong'),
      body = document.createElement('p');
    title.textContent = name;
    body.textContent = text;
    element.append(title, body);
    this.root.append(element);
    const at = performance.now();
    this.active.push({
      speaker,
      station,
      at,
      until: at + Math.min(14000, Math.max(5500, text.length * 42)),
      element,
    });
  }
  talking(speaker: number) {
    return this.active.some((entry) => entry.speaker === speaker && performance.now() < entry.at + 3800);
  }
  nod(speaker: number, s: State) {
    return !s.settings.reducedMotion && this.talking(speaker) ? Math.round(Math.sin(s.time * 9) * 0.7) : 0;
  }
  update(
    s: State,
    speakers: { id: number; x: number; y: number; visible: boolean }[],
    view: { x: number; y: number; zoom: number },
  ) {
    const now = performance.now(),
      placed: { left: number; top: number; width: number; height: number }[] = [];
    this.active = this.active.filter((entry) => {
      if (now >= entry.until || entry.station !== s.actors[0].station) {
        entry.element.remove();
        return false;
      }
      const person = speakers.find((candidate) => candidate.id === entry.speaker);
      const x = person ? (person.x - view.x) * view.zoom : -1000,
        y = person ? (person.y - view.y) * view.zoom : -1000;
      const el = entry.element;
      el.hidden = !person?.visible || x < 0 || x > innerWidth || y < 0 || y > innerHeight;
      if (el.hidden) return true;
      const width = el.offsetWidth,
        height = el.offsetHeight;
      const left = Math.max(12, Math.min(innerWidth - width - 12, x - width / 2));
      let top = y - 58 - height,
        below = false;
      if (top < 130 && y + 18 + height < innerHeight - 95) {
        top = y + 18;
        below = true;
      }
      top = Math.max(125, Math.min(innerHeight - height - 95, top));
      for (const box of placed)
        if (
          left < box.left + box.width + 8 &&
          left + width > box.left - 8 &&
          top < box.top + box.height + 8 &&
          top + height > box.top - 8
        ) {
          const above = box.top - height - 12;
          top = above >= 125 ? above : Math.min(innerHeight - height - 95, box.top + box.height + 12);
        }
      for (const obstacle of document.querySelectorAll<HTMLElement>(
        '.toast,.role-intro-card,#objective,#movement-tools,.rail-nav,.tray-toggle',
      )) {
        const box = obstacle.getBoundingClientRect();
        if (
          left < box.right + 8 &&
          left + width > box.left - 8 &&
          top < box.bottom + 8 &&
          top + height > box.top - 8
        ) {
          const above = box.top - height - 12;
          top = above >= 125 ? above : Math.min(innerHeight - height - 95, box.bottom + 12);
        }
      }
      el.classList.toggle('below', below);
      el.dataset.motion = s.settings.reducedMotion ? 'still' : 'talking';
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
      el.style.setProperty('--tail-x', `${Math.max(16, Math.min(width - 16, x - left))}px`);
      placed.push({ left, top, width, height });
      return true;
    });
  }
  clear() {
    this.active.forEach((entry) => entry.element.remove());
    this.active = [];
  }
}
