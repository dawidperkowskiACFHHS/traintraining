import type { Leg } from './types';

const cache = new Map<string, HTMLCanvasElement>();
/** Shared vehicle silhouettes for the platform and the boarding cut-in. */
export function serviceCanvas(kind: Leg['kind'], open = true) {
  const key = kind + open;
  if (cache.has(key)) return cache.get(key)!;
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 56;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const r = (x: number, y: number, w: number, h: number, color: string) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const bus = kind === 'bus',
    boat = kind === 'ferry';
  const ink = '#20384c',
    paint = bus ? '#c17d47' : boat ? '#e9e7cf' : '#376f8b';
  r(9, 45, 204, 5, '#1833483b');
  if (boat) {
    r(4, 38, 214, 6, ink);
    r(11, 44, 200, 5, '#9c564a');
    r(24, 49, 174, 3, ink);
    r(22, 20, 174, 18, paint);
    r(49, 7, 125, 13, '#f2ecd6');
    r(45, 5, 133, 4, ink);
    r(137, 0, 9, 7, '#a05e4e');
    r(15, 31, 193, 3, '#4f7e97');
  } else {
    r(6, 7, 210, 36, ink);
    r(2, 14, 220, 22, ink);
    r(7, 9, 208, 32, paint);
    r(12, 6, 197, 3, '#b3c9cb');
    r(8, 33, 207, 4, '#ead1a0');
    r(10, 39, 204, 4, '#2d4e63');
    for (const x of [26, 177]) {
      r(x, 40, 18, 10, ink);
      r(x + 4, 42, 10, 6, '#769092');
      r(x + 7, 43, 4, 4, ink);
    }
  }
  for (let x = 22; x < 202; x += 30) {
    r(x, boat ? 21 : 15, 22, 14, ink);
    r(x + 2, boat ? 22 : 16, 18, 10, '#92becb');
    r(x + 3, boat ? 22 : 16, 9, 2, '#d7e7dc');
    r(x + 17, boat ? 22 : 16, 1, 10, '#5c8f9f');
  }
  const doorY = boat ? 20 : 12;
  r(102, doorY, 20, 31, ink);
  r(104, doorY + 2, 16, 27, open ? '#182d42' : '#668a98');
  if (open) {
    r(105, doorY + 2, 3, 27, '#dac18e');
    r(108, 40, 14, 3, '#efd8a2');
  } else {
    r(111, doorY + 2, 1, 27, '#d0d5bb');
    r(105, doorY + 4, 5, 10, '#a5c6ca');
    r(113, doorY + 4, 5, 10, '#a5c6ca');
  }
  r(78, 9, 22, 4, kind === 'express' ? '#ecc36a' : '#c8dde0');
  r(208, 26, 6, 4, '#ffe3a0');
  r(9, 26, 3, 4, '#cf7b63');
  cache.set(key, canvas);
  return canvas;
}
