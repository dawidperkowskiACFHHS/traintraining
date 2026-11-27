import type { State, Archetype } from './types';
import { inTransit } from './transit';
import { characterCanvas, playerCanvas } from './art';
import { serviceCanvas } from './service-art';
import { journeyProgress, movingTime, serviceStop } from './service-conditions';

let portraits: HTMLCanvasElement[] = [],
  appearance = '';
let walking: HTMLCanvasElement[][] = [];
function districtScenery(c: CanvasRenderingContext2D, kind: Archetype, motion: number, alpha: number) {
  if (alpha <= 0) return;
  c.save();
  c.globalAlpha = alpha;
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  if (kind === 'coast' || kind === 'lake') {
    rect(0, 187, 640, 57, '#79aeb7');
    for (let i = 0; i < 13; i++)
      rect(((((i * 59 - motion * 11) % 720) + 720) % 720) - 30, 196 + (i % 4) * 10, 32, 2, '#bad5ce');
    if (kind === 'coast') {
      rect(454, 130, 18, 83, '#e6e5c9');
      rect(454, 158, 18, 11, '#bb6f59');
      rect(450, 124, 26, 6, '#456c79');
      rect(456, 129, 14, 10, '#a4d0ca');
      rect(447, 211, 36, 6, '#7b8f85');
    } else {
      rect(329, 216, 120, 6, '#9a8160');
      rect(347, 222, 5, 17, '#7a735e');
      rect(422, 222, 5, 17, '#7a735e');
    }
  } else if (kind === 'city' || kind === 'rail' || kind === 'market') {
    for (let i = 0; i < 10; i++) {
      const x = ((((i * 79 - motion * 15) % 850) + 850) % 850) - 100;
      const height = kind === 'city' ? 57 + (i % 3) * 19 : kind === 'rail' ? 43 : 36 + (i % 2) * 12;
      rect(x, 239 - height, 61, height, kind === 'rail' ? '#9d8e7c' : '#a8b8b5');
      rect(x - 3, 235 - height, 67, 6, '#607b88');
      for (let y = 247 - height; y < 227; y += 14)
        for (let dx = 8; dx < 55; dx += 16) rect(x + dx, y, 7, 8, '#d3dbbd');
      if (kind === 'market')
        for (let dx = 0; dx < 61; dx += 8) rect(x + dx, 217, 8, 8, dx % 16 ? '#d3b08c' : '#ac705c');
      if (kind === 'rail') {
        rect(x + 10, 181, 5, 17, '#697d7c');
        rect(x + 35, 204, 20, 30, '#596c70');
      }
    }
  } else if (kind === 'forest') {
    for (let i = 0; i < 17; i++) {
      const x = ((((i * 47 - motion * 24) % 760) + 760) % 760) - 70;
      rect(x + 13, 197, 5, 56, '#655e4b');
      for (let tier = 0; tier < 3; tier++) {
        c.fillStyle = tier % 2 ? '#426d5a' : '#527d61';
        c.beginPath();
        c.moveTo(x + 16, 132 + tier * 23);
        c.lineTo(x - 5 - tier * 2, 195 + tier * 17);
        c.lineTo(x + 37 + tier * 2, 195 + tier * 17);
        c.fill();
      }
    }
  } else {
    rect(0, 219, 640, 27, kind === 'hill' ? '#a6b186' : '#bdb77b');
    for (let i = 0; i < 6; i++) {
      const x = ((((i * 137 - motion * 21) % 900) + 900) % 900) - 120;
      rect(x, 228, 103, 2, '#d3ca8e');
      rect(x, 238, 103, 2, '#8c9b65');
      rect(x + 30, 193, 31, 31, '#d8c59b');
      rect(x + 25, 187, 41, 10, '#8a705b');
    }
  }
  c.restore();
}
/** A vehicle interior follows the authoritative timetable, including pause and speed. */
export function renderJourney(s: State) {
  const actor = s.actors[0],
    leg = actor.journey[0];
  const active = inTransit(actor, s.time);
  const view = document.getElementById('journey-view')!;
  view.hidden = !active;
  document.body.classList.toggle('on-vehicle', active);
  if (!active || !leg) return;
  const key = JSON.stringify(s.appearance);
  if (key !== appearance) {
    appearance = key;
    portraits = [
      playerCanvas(s.appearance, 2, 0),
      characterCanvas('#669b99', '#e2ba85', 2, 0, false),
      characterCanvas('#a77c99', '#b98564', 2, 0, true),
    ];
    walking = [0, 1, 2].map((id) =>
      [0, 1, 2].map((frame) =>
        id === 0
          ? playerCanvas(s.appearance, 1, frame)
          : characterCanvas(
              id === 1 ? '#669b99' : '#a77c99',
              id === 1 ? '#e2ba85' : '#b98564',
              1,
              frame,
              id === 2,
            ),
      ),
    );
    portraits = portraits.map((image) => {
      const seat = document.createElement('canvas');
      seat.width = 24;
      seat.height = 32;
      const ctx = seat.getContext('2d')!;
      ctx.drawImage(image, 0, 0, 24, 24, 0, 0, 24, 24);
      ctx.drawImage(image, 5, 23, 14, 4, 5, 23, 14, 4);
      ctx.drawImage(image, 7, 28, 5, 3, 7, 26, 5, 3);
      ctx.drawImage(image, 13, 28, 5, 3, 14, 26, 5, 3);
      return seat;
    });
  }
  const canvas = document.getElementById('journey-canvas') as HTMLCanvasElement;
  const c = canvas.getContext('2d')!;
  canvas.width = 640;
  canvas.height = 360;
  c.imageSmoothingEnabled = false;
  const bus = leg.kind === 'bus',
    boat = leg.kind === 'ferry',
    foot = leg.kind === 'walk';
  const stop = serviceStop(leg, s.time);
  const motion = s.settings.reducedMotion
    ? 0
    : (leg.depart + movingTime(leg, s.time)) *
      (leg.service?.mode === 'fast' ? 1.3 : leg.kind === 'express' ? 1.15 : 1);
  const progress = journeyProgress(leg, s.time);
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };
  const party = s.actors.filter(
    (a) =>
      a.id === 0 || a.journey.some((l) => l.from === leg.from && l.to === leg.to && l.depart === leg.depart),
  );
  const boarding = !foot && s.time - leg.depart < 1.4;
  view.dataset.stage = boarding ? 'boarding' : 'riding';
  const scenery = () => {
    const sky = c.createLinearGradient(0, 0, 0, 260);
    sky.addColorStop(0, '#829cba');
    sky.addColorStop(1, '#efd0a2');
    c.fillStyle = sky;
    c.fillRect(0, 0, 640, 270);
    for (let layer = 0; layer < 3; layer++) {
      c.fillStyle = ['#81938f', '#698b79', '#527b66'][layer];
      c.beginPath();
      c.moveTo(0, 270);
      for (let x = -20; x <= 660; x += 10)
        c.lineTo(
          x,
          155 +
            layer * 33 +
            Math.sin((x + motion * (8 + layer * 13)) / 95 + layer) * 20 +
            Math.sin((x + motion * 12) / 45) * 7,
        );
      c.lineTo(640, 270);
      c.fill();
    }
    if (boat) {
      rect(0, 218, 640, 100, '#6898a5');
      for (let i = 0; i < 28; i++) rect((i * 53 - motion * 18) % 690, 230 + (i % 7) * 10, 22, 2, '#a8c7c3');
    } else {
      rect(0, 244, 640, 40, '#9ca96c');
      for (let i = 0; i < 12; i++) {
        const x = ((((i * 103 - motion * 49) % 780) + 780) % 780) - 70,
          y = 225 + (i % 3) * 9;
        rect(x + 13, y - 28, 5, 42, '#5d6852');
        c.fillStyle = i % 2 ? '#42705d' : '#577e5e';
        c.beginPath();
        c.ellipse(x + 16, y - 28, 22, 29, 0, 0, 7);
        c.fill();
      }
      for (let i = 0; i < 5; i++) {
        const x = ((((i * 227 - motion * 22) % 1100) + 1100) % 1100) - 100;
        rect(x, 199, 34, 29, '#d4bf91');
        rect(x - 3, 192, 40, 9, '#9a655b');
        rect(x + 12, 215, 8, 13, '#526976');
      }
    }
  };
  scenery();
  const arrivalBlend = Math.max(0, Math.min(1, (progress - 0.55) / 0.3));
  const blend = arrivalBlend * arrivalBlend * (3 - 2 * arrivalBlend);
  districtScenery(c, s.world.stations[leg.from].kind, motion, 1 - blend);
  districtScenery(c, s.world.stations[leg.to].kind, motion, blend);
  view.dataset.destination = s.world.stations[leg.to].kind;
  view.dataset.approaching = String(progress > 0.7);
  if (boarding) {
    rect(0, 246, 640, 114, boat ? '#658c98' : '#b7b6a2');
    rect(0, 277, 640, 8, '#e6cd90');
    rect(0, 285, 640, 4, '#465c69');
    if (boat) {
      rect(310, 222, 34, 65, '#947f5d');
      for (let y = 224; y < 285; y += 6) rect(311, y, 32, 1, '#d3bd8b');
    }
    c.drawImage(serviceCanvas(leg.kind, true), 96, 137, 448, 112);
    const step = s.settings.reducedMotion ? 0.8 : Math.min(1, (s.time - leg.depart) / 1.25);
    party.forEach((a, i) => {
      const delay = Math.max(0, Math.min(1, (step - i * 0.16) / (1 - i * 0.16)));
      c.save();
      c.globalAlpha = delay > 0.8 ? (1 - delay) / 0.2 : 1;
      c.drawImage(
        walking[a.id][s.settings.reducedMotion ? 0 : 1 + (Math.floor(s.time * 7) % 2)],
        220 + i * 65 + (320 - 220 - i * 65) * delay,
        248 - 82 * delay,
        48,
        64,
      );
      c.restore();
    });
  }
  if (!boarding) {
    const bob = s.settings.reducedMotion || stop ? 0 : Math.sin(motion * 7) * 0.55;
    c.save();
    c.translate(0, bob);
    if (foot) {
      rect(0, 272, 640, 88, '#c6b18c');
      rect(0, 288, 640, 12, '#dfc79a');
    } else {
      const shell = bus ? '#344a5b' : boat ? '#455b6c' : '#415561';
      rect(0, 0, 640, 88, shell);
      rect(0, 88, 640, 8, '#dcc89b');
      rect(0, 243, 640, 117, shell);
      rect(0, 246, 640, 5, '#d1b37b');
      rect(0, 300, 640, 60, '#796f68');
      for (let x = 0; x < 640; x += 160) {
        rect(x, 87, 13, 163, '#263c50');
        rect(x + 13, 96, 4, 145, '#d2be91');
        // Reflections stay attached to the glass while the landscape moves.
        c.fillStyle = '#eef5e711';
        c.beginPath();
        c.moveTo(x + 32, 102);
        c.lineTo(x + 75, 102);
        c.lineTo(x + 145, 236);
        c.lineTo(x + 102, 236);
        c.fill();
        rect(x + 36, 274, 96, 42, bus ? '#99715c' : '#6c8190');
        rect(x + 32, 310, 104, 13, '#384d62');
        rect(x + 42, 323, 5, 20, '#283b50');
        rect(x + 119, 323, 5, 20, '#283b50');
        rect(x + 48, 68, 2, 19, '#d5c49e');
        rect(x + 43, 83, 12, 5, '#d5c49e');
      }
      if (bus) {
        rect(548, 92, 6, 246, '#c7c3a3');
        rect(569, 247, 71, 48, '#263b4a');
        rect(576, 255, 54, 7, '#8da8ab');
        c.strokeStyle = '#162a39';
        c.lineWidth = 5;
        c.beginPath();
        c.ellipse(591, 283, 17, 11, -0.3, 0, Math.PI * 2);
        c.stroke();
        rect(589, 284, 5, 29, '#263b4a');
        rect(623, 108, 4, 118, '#c7c3a3');
        rect(615, 154, 15, 4, '#d5c49e');
        rect(544, 34, 36, 20, '#8cabad');
        rect(548, 37, 28, 13, '#4e6c7b');
      } else if (!boat) {
        for (let x = 40; x < 640; x += 180) {
          rect(x, 57, 90, 4, '#d0bd94');
          rect(x + 8, 43, 28, 14, '#997759');
          rect(x + 41, 40, 30, 17, '#a48f69');
          rect(x + 48, 39, 16, 3, '#374b52');
        }
      }
      rect(225, 24, 190, 27, '#203247');
      rect(231, 29, 7, 17, '#d2b077');
      c.font = 'bold 12px sans-serif';
      c.fillStyle = '#f4e9cc';
      c.textAlign = 'center';
      c.fillText(bus ? 'COUNTRY BUS' : boat ? 'RIVER CROSSING' : 'LAST STOP RAILWAY', 323, 42);
    }
    party.forEach((a, i) => {
      const x = foot ? 240 + i * 66 : party.length === 1 ? 380 : 220 + i * 160,
        y = foot ? 263 : 251;
      c.fillStyle = '#142a3933';
      c.beginPath();
      c.ellipse(x + 24, y + 61, 18, 4, 0, 0, 7);
      c.fill();
      c.drawImage(
        foot
          ? walking[a.id][s.settings.reducedMotion ? 0 : 1 + (Math.floor(s.time * 7) % 2)]
          : portraits[a.id],
        x,
        y,
        48,
        64,
      );
    });
    c.restore();
  }
  const caption = document.getElementById('journey-caption')!;
  const from = s.world.stations[leg.from].name,
    to = s.world.stations[leg.to].name;
  const service = bus
    ? 'Bus'
    : boat
      ? 'Ferry'
      : foot
        ? 'On foot'
        : leg.kind === 'express'
          ? 'Express train'
          : 'Local train';
  const text = `${service} · ${from} → ${to}`;
  if (caption.dataset.route !== text) {
    caption.dataset.route = text;
    caption.innerHTML =
      '<h2></h2><span class="journey-route"></span><p></p><div class="trip-progress"><i></i></div>';
    caption.querySelector('span')!.textContent = `${service} from ${from}`;
    caption.querySelector('h2')!.textContent = to;
  }
  caption.querySelector('.journey-route')!.textContent =
    `${boarding ? 'Boarding · ' : ''}${service} from ${from}`;
  caption.querySelector('p')!.textContent = stop
    ? `Brief repair · moving again in ${Math.ceil(stop.remaining)}s · your party stays aboard`
    : `${leg.service?.mode === 'fast' ? 'Fast service · ' : progress > 0.7 ? 'Approaching · ' : ''}${Math.ceil(leg.arrive - s.time)} seconds to arrival${party.length > 1 ? ' · Traveling together' : ''}`;
  view.dataset.service = stop ? 'repair' : (leg.service?.mode ?? 'on-time');
  (caption.querySelector('i') as HTMLElement).style.width = `${progress * 100}%`;
}
