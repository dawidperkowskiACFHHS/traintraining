import type { Station, Building, Cover } from './types';
import { insideBuilding } from './local';
import { hash, random } from './random';
import { APPEARANCE_OPTIONS, type Appearance } from './appearance';
export const PALETTE = {
  ink: '#293e3a',
  grass: '#9cc575',
  grassDark: '#92b56c',
  path: '#ddce9e',
  water: '#72b7bb',
  paper: '#f4efdf',
  roofs: ['#b85e49', '#317e7c', '#c9973c', '#63768f'],
};
type C = CanvasRenderingContext2D;
function box(c: C, x: number, y: number, w: number, h: number, color: string) {
  c.fillStyle = color;
  c.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}
function oval(c: C, x: number, y: number, rx: number, ry: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.ellipse(Math.floor(x), Math.floor(y), rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}
export function tree(c: C, x: number, y: number, pine = false) {
  oval(c, x + 10, y + 11, 16, 7, '#244e3f42');
  box(c, x + 5, y - 7, 7, 20, '#58634a');
  box(c, x + 7, y - 5, 3, 17, '#7c7655');
  box(c, x + 3, y + 10, 12, 3, '#526346');
  box(c, x + 6, y + 10, 4, 2, '#94805b');
  if (pine) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i === 2 ? '#527b58' : '#416e52';
      c.beginPath();
      c.moveTo(x + 8, y - 37 + i * 12);
      c.lineTo(x - 8 - i * 2, y - 7 + i * 8);
      c.lineTo(x + 24 + i * 2, y - 7 + i * 8);
      c.fill();
      box(c, x + 5, y - 27 + i * 12, 3, 7, '#739763');
      box(c, x + 1 - i * 3, y - 14 + i * 9, 7 + i * 3, 2, '#7aa36a');
      box(c, x + 11, y - 12 + i * 9, 10 + i * 2, 2, '#2f594b');
    }
  } else {
    const leaf = (cx: number, cy: number, rx: number, ry: number, color: string) => {
      for (let row = -ry; row <= ry; row += 2) {
        const span = Math.round((rx * Math.sqrt(Math.max(0, 1 - (row / ry) ** 2))) / 2) * 2;
        if (span) box(c, cx - span, cy + row, span * 2, 2, color);
      }
    };
    leaf(x + 8, y - 7, 20, 13, '#315f4a');
    leaf(x - 3, y - 17, 15, 14, '#407d50');
    leaf(x + 17, y - 19, 16, 13, '#4f8d54');
    leaf(x + 7, y - 29, 14, 11, '#70a358');
    leaf(x - 2, y - 27, 9, 6, '#8ab968');
    leaf(x + 19, y - 24, 8, 6, '#77a95e');
    leaf(x + 9, y - 10, 9, 5, '#619a56');
    for (const [dx, dy] of [
      [-11, -16],
      [0, -33],
      [10, -23],
      [22, -17],
      [6, -8],
    ]) {
      box(c, x + dx, y + dy, 3, 2, '#a0c772');
      box(c, x + dx + 3, y + dy + 2, 2, 1, '#40744c');
    }
  }
}
function building(c: C, b: Building, open: boolean, labels = true) {
  const x = b.x * 16,
    y = b.y * 16,
    w = b.w * 16,
    h = b.h * 16;
  box(c, x + 5, y + 8, w + 5, h, '#3e674130');
  if (open) {
    box(c, x, y, w, h, '#59645b');
    box(c, x + 3, y + 3, w - 6, h - 6, '#c4ae7c');
    for (let xx = x + 4; xx < x + w - 2; xx += 8) box(c, xx, y + 3, 1, h - 6, '#b39b6c');
    box(c, x + 8, y + 9, w - 16, 12, '#4a675c');
    for (let xx = x + 10; xx < x + w - 8; xx += 6)
      box(c, xx, y + 10, 3, 9, ['#bd7a59', '#e4ca86', '#749984'][(xx / 2) % 3 | 0]);
    box(c, x + 9, y + 30, 20, 14, '#866b50');
    box(c, x + 11, y + 29, 16, 12, '#cfb17b');
    box(c, x + w - 27, y + 30, 18, 28, '#ead9b0');
    box(c, x + w - 25, y + 33, 14, 7, '#769c98');
    box(c, b.door.x * 16 - 7, y + h - 8, 14, 9, '#c5ad7d');
    return;
  }
  box(c, x, y + 32, w, h - 32, '#4e5949');
  const facade =
    b.style === 'coast'
      ? '#e6ece1'
      : b.style === 'city'
        ? ['#c8c9ba', '#b5cacc', '#d5bdad', '#bdc8d9'][b.roof]
        : b.style === 'rail'
          ? '#b48870'
          : b.style === 'forest'
            ? '#b69b70'
            : '#eee0af';
  box(c, x + 3, y + 32, w - 6, h - 35, facade);
  if (b.style === 'forest' || b.style === 'rural')
    for (let yy = y + 34; yy < y + h - 5; yy += 6) box(c, x + 3, yy, w - 6, 1, '#806e4b66');
  // Material and masonry belong to the facade, leaving the walking surface quiet.
  if (['city', 'rail', 'market'].includes(b.style ?? '')) {
    for (let yy = y + 36; yy < y + h - 8; yy += 6) {
      box(c, x + 3, yy, w - 6, 1, '#60727c35');
      for (let xx = x + 4 + (Math.floor(yy / 6) % 2) * 7; xx < x + w - 5; xx += 14)
        box(c, xx, yy + 1, 1, 5, '#60727c35');
    }
  }
  box(c, x + w - 6, y + 35, 3, h - 39, '#52616b48');
  box(c, x + 4, y + h - 8, w - 8, 6, '#c2b583');
  for (let xx = x + 8; xx < x + w - 13; xx += 27) {
    box(c, xx, y + h - 34, 15, 18, '#788f84');
    box(c, xx + 2, y + h - 32, 11, 13, '#b2d1bc');
    box(c, xx + 7, y + h - 32, 1, 13, '#6a897d');
    box(c, xx + 2, y + h - 26, 11, 1, '#6a897d');
    box(c, xx - 2, y + h - 15, 19, 3, '#a3936b');
  }
  const doorX = b.door.x * 16 - 7;
  box(c, doorX - 2, y + h - 25, 18, 25, '#d3bd87');
  box(c, doorX, y + h - 23, 14, 23, ['cafe', 'library', 'home'].includes(b.kind) ? '#4c625a' : '#8b785b');
  box(c, doorX + 3, y + h - 21, 8, 9, '#91b7a7');
  box(c, doorX + 10, y + h - 8, 2, 2, '#e7c478');
  box(c, doorX - 3, y + h, 20, 3, '#b5a373');
  box(c, doorX - 5, y + h + 3, 24, 3, '#7f8e8b');
  box(c, doorX - 4, y + h + 3, 22, 1, '#d5d8bc');
  box(c, doorX - 2, y + h - 28, 18, 3, '#52616b');
  box(c, doorX + 1, y + h - 27, 12, 2, '#d1af68');
  // Entrance lamps, number plaques and flower boxes provide individual addresses.
  box(c, doorX + 17, y + h - 20, 5, 7, '#374f60');
  box(c, doorX + 18, y + h - 19, 3, 4, '#f1d899');
  box(c, doorX - 9, y + h - 17, 5, 4, '#3c6475');
  box(c, doorX - 8, y + h - 16, 2, 1, '#f1e7c7');
  c.fillStyle = '#485951';
  c.beginPath();
  c.moveTo(x - 5, y + 19);
  c.lineTo(x + 8, y + 1);
  c.lineTo(x + w - 8, y + 1);
  c.lineTo(x + w + 5, y + 19);
  c.lineTo(x + w + 5, y + 43);
  c.lineTo(x - 5, y + 43);
  c.fill();
  const roof = PALETTE.roofs[b.roof];
  box(c, x - 3, y + 18, w + 6, 22, roof);
  box(c, x + 7, y + 4, w - 14, 14, roof);
  box(c, x + 1, y + 13, w - 2, 8, roof);
  box(c, x + 8, y + 3, w - 16, 3, '#efc18c');
  box(c, x - 3, y + 36, w + 6, 3, '#664f45');
  for (let yy = y + 9; yy < y + 36; yy += 7) {
    box(c, x + 3, yy, w - 6, 1, '#ffffff26');
    for (let xx = x + (Math.floor(yy / 7) % 2) * 9; xx < x + w - 6; xx += 18)
      box(c, xx, yy + 1, 1, 5, '#344e4438');
  }
  box(c, x + w - 25, y - 6, 11, 20, '#6a7160');
  box(c, x + w - 27, y - 7, 15, 4, '#95947c');
  if (b.style === 'city' || b.style === 'rail') {
    box(c, x - 3, y + 2, w + 6, 31, b.style === 'rail' ? '#667981' : '#627786');
    box(c, x + 2, y + 5, w - 4, 23, b.style === 'rail' ? '#85918c' : '#9cabb2');
    box(c, x - 4, y + 30, w + 8, 5, '#42596a');
    // Rooftop service walk, skylight and ventilation, varied by the address.
    box(c, x + 8, y + 9, w - 18, 1, '#d3dcd4');
    box(c, x + 8, y + 10, 1, 14, '#718b96');
    const ventX = x + (b.x % 2 ? 14 : w - 34);
    box(c, ventX + 3, y + 15, 24, 12, '#4d657343');
    box(c, ventX, y + 10, 23, 13, '#4b6573');
    box(c, ventX + 2, y + 9, 19, 10, '#c8d8d5');
    for (let dx = 4; dx < 19; dx += 4) box(c, ventX + dx, y + 11, 1, 6, '#7d9aa1');
    box(c, x + w / 2 - 4, y + 14, 15, 10, '#4b6573');
    box(c, x + w / 2 - 3, y + 14, 13, 7, '#7eb2c2');
    box(c, x + w / 2 - 3, y + 14, 13, 1, '#d7e5dc');
    for (let xx = x + 8; xx < x + w - 12; xx += 22) {
      box(c, xx, y + 38, 13, 15, '#4b6877');
      box(c, xx + 2, y + 40, 9, 11, '#b6d7d7');
      box(c, xx + 6, y + 40, 1, 11, '#688995');
    }
    if (b.style === 'rail')
      for (let xx = x + 9; xx < x + w - 8; xx += 16) box(c, xx, y + 9, 7, 10, '#c1d8cf');
  }
  if (b.kind === 'cafe' || b.kind === 'library') {
    const label = b.kind === 'cafe' ? 'CAFÉ' : 'BOOKS';
    box(c, x + 7, y + h - 16, 28, 9, '#3e675d');
    c.fillStyle = '#f3e7bb';
    c.font = 'bold 6px monospace';
    if (labels) c.fillText(label, x + 10, y + h - 9);
  }
  if (b.kind === 'cafe') {
    for (let i = 0; i < 6; i++) box(c, x + 3 + i * 9, y + h - 38, 9, 6, i % 2 ? '#f4e4b4' : '#cf835f');
    box(c, x + 3, y + h - 32, 54, 2, '#714d4c');
    box(c, x + 8, y + h - 12, 18, 4, '#a4704d');
    for (let i = 0; i < 4; i++) {
      box(c, x + 9 + i * 4, y + h - 16, 3, 5, '#4f805d');
      box(c, x + 9 + i * 4, y + h - 17, 2, 2, i % 2 ? '#e7bd68' : '#d47d7e');
    }
  } else if (b.kind === 'home' && (b.x + b.y) % 2 === 0) {
    box(c, x + 7, y + h - 14, 19, 4, '#85664d');
    for (let i = 0; i < 4; i++) {
      box(c, x + 9 + i * 4, y + h - 18, 2, 5, '#568360');
      box(c, x + 9 + i * 4, y + h - 19, 2, 2, '#e8b881');
    }
  }
}
export function buildingCanvas(b: Building, open: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = b.w * 16 + 20;
  canvas.height = b.h * 16 + 30;
  const c = canvas.getContext('2d')!;
  c.translate(10 - b.x * 16, 12 - b.y * 16);
  building(c, b, open, false);
  return canvas;
}
export function treeCanvas(pine: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 80;
  tree(canvas.getContext('2d')!, 24, 54, pine);
  return canvas;
}
function marketStall(c: C, x: number, y: number, variant: number) {
  box(c, x + 1, y + 4, 27, 16, '#8e805c');
  box(c, x + 2, y + 2, 25, 12, '#d2b77d');
  box(c, x - 3, y - 15, 35, 12, '#586d56');
  for (let i = 0; i < 5; i++)
    box(c, x - 1 + i * 6, y - 14, 6, 12, i % 2 ? '#f1e5bd' : ['#bc705c', '#537f86', '#a5924c'][variant]);
  for (let i = 0; i < 6; i++)
    oval(c, x + 5 + (i % 3) * 8, y + 5 + Math.floor(i / 3) * 5, 3, 3, i % 2 ? '#c59450' : '#92ad60');
}
export function marketCanvas(variant: number) {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 56;
  marketStall(canvas.getContext('2d')!, 6, 28, variant);
  return canvas;
}
export function townCanvas(
  st: Station,
  open: number | null = null,
  photo = false,
  terrainOnly = false,
): HTMLCanvasElement {
  const t = st.local,
    canvas = document.createElement('canvas');
  canvas.width = t.width * 16;
  canvas.height = t.height * 16;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const r = { rng: hash(st.name) };
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++) {
      const tile = t.tiles[y * t.width + x],
        px = x * 16,
        py = y * 16;
      const grass =
        st.kind === 'hill'
          ? '#acb68a'
          : st.kind === 'rail'
            ? '#a2aaa4'
            : st.kind === 'forest'
              ? '#71a167'
              : st.kind === 'city'
                ? '#a4bc9b'
                : st.kind === 'market'
                  ? '#c5b99b'
                  : st.kind === 'coast'
                    ? '#c9d2a0'
                    : PALETTE.grass;
      box(c, px, py, 16, 16, grass);
      if (tile === 0 && !['city', 'market', 'rail'].includes(st.kind)) {
        const patch = hash(st.name + ':' + Math.floor(x / 4) + ':' + Math.floor(y / 3)) % 7;
        if (patch < 2) box(c, px, py, 16, 16, patch ? '#315f4d0b' : '#e4e99b0c');
      }
      if (tile === 0 || tile === 7) {
        for (let i = 0; i < 3; i++) {
          const dx = Math.floor(random(r) * 15),
            dy = Math.floor(random(r) * 15);
          box(
            c,
            px + dx,
            py + dy,
            2,
            1,
            ['city', 'rail', 'market'].includes(st.kind)
              ? i % 2
                ? '#a5b0a7'
                : '#cdd1bd'
              : st.kind === 'forest'
                ? i % 2
                  ? '#658c64'
                  : '#93af79'
                : i % 2
                  ? '#93b36e'
                  : '#bad28e',
          );
        }
        if (random(r) < 0.1) box(c, px + 6, py + 5, 2, 2, '#d4db9b');
      }
      if (tile === 1 || tile === 9) {
        const paving =
          st.kind === 'city'
            ? '#a7b7bf'
            : st.kind === 'market'
              ? '#cbb190'
              : st.kind === 'rail'
                ? '#a9b4b3'
                : st.kind === 'forest'
                  ? '#b6a482'
                  : st.kind === 'coast'
                    ? '#e1d5aa'
                    : PALETTE.path;
        box(c, px, py, 16, 16, tile === 9 ? '#c5c3a4' : paving);
        if (tile === 9) box(c, px, py + 15, 16, 1, '#afb69c');
        for (let i = 0; i < 2; i++)
          box(c, px + Math.floor(random(r) * 15), py + Math.floor(random(r) * 15), 2, 1, '#bdba8e');
        if (tile === 9) {
          box(c, px + 7, py, 1, 15, '#b3b69c');
          box(c, px, py + 7, 16, 1, '#b3b69c');
        }
        if (tile === 1 && ['city', 'market', 'rail'].includes(st.kind)) {
          box(c, px, py + 7, 16, 1, '#667c7725');
          box(c, px + ((y % 2) * 7 + 2), py, 1, 8, '#667c7725');
          box(c, px + (((y % 2) * 7 + 9) % 16), py + 8, 1, 8, '#667c7725');
        }
        if (t.tiles[y * t.width + x - 1] === 0) box(c, px, py, 2, 16, '#c4ba87');
        if (t.tiles[(y - 1) * t.width + x] === 0) box(c, px, py, 16, 2, '#c4ba87');
        if (t.tiles[y * t.width + x + 1] === 0) {
          box(c, px + 14, py, 2, 16, '#8e9b78');
          box(c, px + 14, py, 1, 16, '#e4d5af');
        }
        if (t.tiles[(y + 1) * t.width + x] === 0) {
          box(c, px, py + 14, 16, 2, '#8e9b78');
          box(c, px, py + 14, 16, 1, '#e4d5af');
        }
      }
      if (tile === 2) {
        box(c, px, py, 16, 16, '#589fae');
        box(c, px + 2 + (y % 2) * 4, py + 6, 7, 1, '#99cbd0');
        box(c, px + 10, py + 12, 5, 1, '#408a9c');
        if (t.tiles[y * t.width + x - 1] !== 2) box(c, px, py, 2, 16, '#c2c594');
        if (t.tiles[(y - 1) * t.width + x] !== 2) box(c, px, py, 16, 2, '#c2c594');
        if (t.tiles[y * t.width + x + 1] !== 2) {
          box(c, px + 13, py, 3, 16, '#3d7d8d');
          box(c, px + 15, py, 1, 16, '#dfd7af');
        }
        if (t.tiles[(y + 1) * t.width + x] !== 2) {
          box(c, px, py + 13, 16, 3, '#3d7d8d');
          box(c, px, py + 15, 16, 1, '#dfd7af');
        }
      }
      if (tile === 5) {
        box(c, px, py, 16, 16, '#ad956b');
        for (let i = 0; i < 4; i++) {
          box(c, px, py + i * 4, 16, 1, '#7d7c5b');
          box(c, px + 2, py + i * 4 + 1, 12, 1, '#d8bd88');
        }
      }
      if (tile === 6) {
        box(c, px, py, 16, 16, '#8b9b87');
        for (let i = 0; i < 4; i++) box(c, px + i * 4, py + 1, 2, 14, '#736a50');
        box(c, px, py + 3, 16, 2, '#525e53');
        box(c, px, py + 4, 16, 1, '#c3c2a5');
        box(c, px, py + 11, 16, 2, '#525e53');
        box(c, px, py + 11, 16, 1, '#c3c2a5');
      }
      if (tile === 11) {
        box(c, px, py + 5, 16, 12, '#3d6857');
        box(c, px, py + 1, 16, 10, '#56865f');
        box(c, px + 2, py, 12, 3, '#8ca66c');
        box(c, px + 4, py + 4, 5, 2, '#719a64');
      }
      if (tile === 12) {
        box(c, px, py + 1, 16, 14, '#627980');
        box(c, px, py, 16, 3, '#b6c2b5');
        box(c, px, py + 8, 16, 1, '#435d66');
        box(c, px + (y % 2 ? 5 : 11), py + 3, 1, 5, '#435d66');
      }
    }
  // Small environmental stories: garden plots, flower boxes, bicycle racks, a market and clock garden.
  for (const p of t.props) {
    const x = p.x * 16,
      y = p.y * 16;
    if (p.kind === 'grass') {
      box(c, x + 3, y + 8, 1, 3, '#7d9f63');
      box(c, x + 6, y + 6, 1, 5, '#7d9f63');
    }
    if (p.kind === 'crop') {
      box(c, x, y + 5, 16, 8, '#907b55');
      for (let i = 0; i < 4; i++) {
        box(c, x + 2 + i * 4, y, 1, 12, '#687c48');
        box(c, x + i * 4, y + 1, 5, 4, '#d4bc6e');
      }
    }
    if (p.kind === 'flower') {
      box(c, x + 6, y + 6, 1, 5, '#7c9d61');
      box(c, x + 4, y + 5, 5, 3, '#f2d69c');
      box(c, x + 6, y + 4, 2, 5, '#e6b078');
    }
    if (p.kind === 'bench') {
      box(c, x - 3, y + 5, 34, 9, '#475e50');
      box(c, x - 3, y + 3, 34, 4, '#b49160');
      box(c, x - 3, y + 8, 34, 3, '#c3a46f');
      box(c, x + 1, y + 12, 3, 5, '#4d6555');
      box(c, x + 24, y + 12, 3, 5, '#4d6555');
    }
    if (p.kind === 'sign') {
      box(c, x + 4, y - 13, 3, 22, '#6e785b');
      box(c, x - 10, y - 15, 31, 13, '#466c5d');
      box(c, x - 8, y - 13, 27, 9, '#f0e3b5');
      c.fillStyle = '#456657';
      c.font = 'bold 7px monospace';
      if (photo) c.fillText('RAIL', x - 5, y - 6);
    }
    if (p.kind === 'clock') {
      box(c, x + 7, y - 12, 3, 26, '#596b56');
      oval(c, x + 8, y - 13, 8, 8, '#4c6658');
      oval(c, x + 8, y - 13, 6, 6, '#f1e5bc');
      box(c, x + 8, y - 17, 1, 5, '#496251');
      box(c, x + 8, y - 13, 4, 1, '#496251');
    }
    if (p.kind === 'lamp') {
      box(c, x + 6, y - 18, 2, 31, '#586d54');
      box(c, x + 1, y - 22, 12, 8, '#546c54');
      box(c, x + 3, y - 20, 8, 4, '#f3dfa1');
    }
    if (p.kind === 'landmark') {
      if (st.landmark === 'Lighthouse') {
        box(c, x - 2, y - 42, 20, 55, '#eee5bb');
        box(c, x - 2, y - 20, 20, 9, '#bd7056');
        box(c, x + 1, y - 38, 14, 10, '#8cb8ad');
        box(c, x - 5, y - 47, 26, 5, '#4f776b');
        box(c, x + 4, y - 53, 8, 6, '#4f776b');
        box(c, x - 5, y + 10, 26, 4, '#8d9171');
      } else if (st.landmark === 'Ancient oak') {
        tree(c, x, y - 1);
        tree(c, x - 12, y - 7);
        tree(c, x + 12, y - 9);
        box(c, x + 4, y - 13, 8, 26, '#7c7655');
        box(c, x + 7, y - 5, 2, 17, '#a09568');
      } else if (st.landmark === 'Windmill') {
        box(c, x - 1, y - 35, 19, 47, '#e5d8a4');
        c.fillStyle = '#7b8e68';
        c.beginPath();
        c.moveTo(x - 5, y - 35);
        c.lineTo(x + 8, y - 51);
        c.lineTo(x + 22, y - 35);
        c.fill();
        for (let i = 0; i < 4; i++) {
          c.save();
          c.translate(x + 8, y - 25);
          c.rotate((i * Math.PI) / 2 + 0.5);
          box(c, -2, -32, 5, 34, '#4a6754');
          box(c, 3, -31, 10, 22, '#d6c78e');
          c.restore();
        }
        oval(c, x + 8, y - 25, 3, 3, '#576d55');
      } else if (st.landmark === 'Boathouse') {
        box(c, x - 15, y - 27, 44, 36, '#e1d3a3');
        box(c, x - 20, y - 36, 54, 12, '#5e8c7c');
        box(c, x - 7, y - 17, 28, 25, '#799a83');
        c.fillStyle = '#b28b5e';
        c.beginPath();
        c.ellipse(x + 7, y - 2, 5, 23, -0.4, 0, Math.PI * 2);
        c.fill();
        box(c, x + 4, y - 12, 4, 15, '#dec28b');
      } else if (st.landmark === 'Water tower') {
        box(c, x - 8, y - 23, 3, 37, '#667d60');
        box(c, x + 22, y - 23, 3, 37, '#667d60');
        box(c, x - 10, y - 47, 37, 26, '#7ca49a');
        oval(c, x + 8, y - 47, 19, 7, '#a3bbae');
        box(c, x - 12, y - 23, 41, 4, '#526e57');
        box(c, x + 28, y - 36, 2, 48, '#61755a');
        for (let yy = y - 33; yy < y + 10; yy += 7) box(c, x + 23, yy, 10, 1, '#61755a');
      } else {
        oval(c, x + 8, y + 8, 22, 10, '#7c8b72');
        oval(c, x + 8, y + 5, 20, 9, '#dbd8aa');
        oval(c, x + 8, y + 3, 16, 7, '#6eadaa');
        box(c, x + 5, y - 15, 6, 20, '#d0d2ac');
        oval(c, x + 8, y - 16, 9, 4, '#e5ddb5');
        box(c, x + 6, y - 23, 3, 8, '#96c2b6');
        box(c, x + 5, y - 31, 7, 8, '#5f7e64');
        box(c, x + 7, y - 29, 3, 4, '#e8ddb2');
      }
    }
    if (p.kind === 'market' && !terrainOnly) marketStall(c, x, y, (p.x + p.y) % 3);
    if (p.kind === 'suitcase') {
      box(c, x, y + 5, 10, 11, '#9b7356');
      box(c, x + 2, y + 2, 6, 4, '#6c6a50');
      box(c, x + 3, y + 5, 2, 11, '#d8bb7d');
    }
    if (p.kind === 'station') {
      box(c, x, y - 3, 87, 24, '#3e5f56');
      box(c, x + 3, y, 81, 18, '#f0e4b6');
      c.fillStyle = '#3c6659';
      c.font = 'bold 9px monospace';
      if (photo) c.fillText(st.name.toUpperCase().slice(0, 13), x + 7, y + 12);
      box(c, x - 2, y - 7, 91, 6, PALETTE.roofs[st.roof]);
    }
  }
  if (!terrainOnly) for (const b of t.buildings) building(c, b, open === t.buildings.indexOf(b), photo);
  const trees: { x: number; y: number }[] = [];
  for (let y = 0; y < t.height; y++)
    for (let x = 0; x < t.width; x++) if (t.tiles[y * t.width + x] === 7) trees.push({ x, y });
  if (!terrainOnly)
    for (const p of trees) {
      if (p.y >= t.height - 2) {
        box(c, p.x * 16, p.y * 16 + 7, 16, 5, '#69825b');
        box(c, p.x * 16 + 2, p.y * 16 + 2, 3, 17, '#69825b');
        continue;
      }
      if ((p.x + p.y) % 2 === 0 || (p.x > 1 && p.x < t.width - 2 && p.y > 1 && p.y < t.height - 2))
        tree(c, p.x * 16, p.y * 16, st.kind === 'forest' && (p.x + p.y) % 3 === 0);
    }
  if (!photo) {
    // a departure arrow painted on the platform, always in the same visual language
    c.fillStyle = '#f3ecc4';
    c.beginPath();
    c.moveTo(t.platform.x * 16, 35 * 16 + 1);
    c.lineTo(t.platform.x * 16 - 5, 35 * 16 + 7);
    c.lineTo(t.platform.x * 16 + 5, 35 * 16 + 7);
    c.fill();
  }
  if (!terrainOnly)
    for (const cover of t.cover ?? [])
      c.drawImage(coverCanvas(cover.kind), cover.x * 16 - 24, cover.y * 16 - 32);
  return canvas;
}
export function coverCanvas(kind: Cover['kind']) {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 40;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  oval(c, 24, 33, kind === 'hedge' ? 19 : 13, 4, '#2c504d48');
  if (kind === 'crate') {
    box(c, 12, 10, 24, 23, '#4c5141');
    box(c, 14, 12, 20, 18, '#b38d59');
    box(c, 14, 12, 20, 3, '#ddbc7c');
    box(c, 14, 23, 20, 3, '#765c40');
    box(c, 17, 13, 2, 17, '#8b6c46');
    box(c, 29, 13, 2, 17, '#8b6c46');
  } else {
    const span = kind === 'hedge' ? 14 : 7;
    box(c, 22, 24, 4, 10, '#536440');
    for (const dx of [-span, 0, span]) {
      box(c, 17 + dx, 19, 14, 13, '#416e52');
      box(c, 15 + dx, 22, 18, 7, '#416e52');
      box(c, 17 + dx, 17, 13, 9, '#608f5c');
      box(c, 19 + dx, 15, 9, 7, '#749e64');
      box(c, 18 + dx, 20, 4, 2, '#92b56c');
    }
  }
  return canvas;
}
export const CHARACTER_POSES = ['idle', 'walk', 'run', 'crouch', 'hide', 'interact', 'caught'] as const;
export type CharacterPose = (typeof CHARACTER_POSES)[number];
export function characterCanvas(
  color: string,
  skin: string,
  dir: number,
  frame: number,
  hat = false,
  appearance?: Appearance,
  pose: CharacterPose = 'walk',
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 24;
  canvas.height = 32;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const tint = (hex: string, light: number) => {
    const n = parseInt(hex.slice(1), 16);
    const channel = (shift: number) =>
      Math.max(0, Math.min(255, ((n >> shift) & 255) + light))
        .toString(16)
        .padStart(2, '0');
    return '#' + channel(16) + channel(8) + channel(0);
  };
  const ink = '#213647',
    side = dir === 1 || dir === 3,
    back = dir === 0;
  const hair = appearance ? APPEARANCE_OPTIONS.hairColor[appearance.hairColor].color : '#445064';
  const trousers = appearance ? APPEARANCE_OPTIONS.trousersColor[appearance.trousersColor].color : '#3a5365';
  const bag = !appearance || appearance.accessory === 2;
  const stride = (frame === 1 ? -1 : frame === 2 ? 1 : 0) * (pose === 'run' ? 2 : pose === 'walk' ? 1 : 0);
  const low = pose === 'hide' || pose === 'crouch';
  const lift = pose === 'run' && frame !== 0 ? -1 : pose === 'idle' && frame === 1 ? -1 : 0;
  oval(c, 12, 29, 7, 2, '#173d4b50');
  c.save();
  c.translate(0, low ? (pose === 'crouch' ? 3 : 6) : lift);
  if (low) c.scale(1, pose === 'crouch' ? 0.9 : 0.78);
  // Boots and independent trouser legs keep the silhouette readable at 2x scale.
  for (const [x, offset] of [
    [7, stride],
    [13, -stride],
  ]) {
    box(c, x, 22, 5, 7 + offset, ink);
    box(c, x + 1, 22, 3, 5 + offset, trousers);
    box(c, x + 1, 23, 1, 4 + offset, tint(trousers, 22));
    box(c, x, 28 + offset, 5, 2, ink);
    box(c, x + 1, 28 + offset, 3, 1, '#e6ddc6');
  }
  // Shirt, cuffed sleeves, collar and a small warm metal belt buckle.
  box(c, 6, 17, 12, 9, ink);
  box(c, 7, 17, 10, 8, color);
  box(c, 7, 18, 3, 6, tint(color, 23));
  box(c, 15, 18, 2, 7, tint(color, -30));
  box(c, 7, 25, 10, 1, ink);
  box(c, 11, 25, 2, 1, '#e5c283');
  const swing = pose === 'walk' || pose === 'run' ? stride : 0;
  for (const [x, offset] of [
    [4, swing],
    [17, -swing],
  ]) {
    box(c, x, 18 + offset, 3, 7, ink);
    box(c, x, 18 + offset, 3, 3, color);
    box(c, x + 1, 21 + offset, 2, 3, skin);
    box(c, x + 1, 21 + offset, 1, 2, tint(skin, 15));
  }
  // A shaped face with a shaded jaw, ears, directional eyes and a two-tone fringe.
  box(c, 7, 7, 11, 10, ink);
  box(c, 8, 6, 9, 12, ink);
  box(c, 8, 8, 9, 9, skin);
  box(c, 9, 16, 7, 2, tint(skin, -24));
  box(c, 6, 12, 2, 3, tint(skin, -16));
  box(c, 17, 12, 2, 3, tint(skin, -16));
  box(c, 7, 6, 11, 6, hair);
  box(c, 9, 4, 7, 3, hair);
  box(c, 8, 6, 8, 2, tint(hair, 30));
  box(c, 7, 9, 3, 4, hair);
  box(c, 15, 9, 3, 3, tint(hair, -16));
  const style = appearance?.hairstyle ?? 0;
  if (style === 1) {
    box(c, 7, 10, 5, 3, hair);
    box(c, 11, 8, 2, 3, tint(hair, 22));
  }
  if (style === 2) {
    for (const [x, y] of [
      [6, 6],
      [10, 3],
      [15, 5],
      [5, 10],
      [17, 10],
    ]) {
      box(c, x, y, 4, 4, hair);
      box(c, x, y, 2, 1, tint(hair, 28));
    }
  }
  if (style === 3) {
    box(c, 5, 9, 3, 11, hair);
    box(c, 17, 9, 3, 11, hair);
    box(c, 5, 11, 1, 7, tint(hair, 23));
  }
  if (style === 4) {
    box(c, dir === 1 ? 3 : 18, 9, 3, 10, hair);
    box(c, dir === 1 ? 3 : 18, 12, 3, 2, '#e4bd64');
  }
  if (back) {
    box(c, 8, 11, 9, 5, hair);
    box(c, 9, 12, 6, 2, tint(hair, 20));
  } else {
    const eye = side ? (dir === 1 ? 15 : 8) : 9;
    box(c, eye, 12, 2, 3, '#f7eee0');
    box(c, eye + (dir === 1 ? 1 : 0), 13, 1, 2, ink);
    if (!side) {
      box(c, 14, 12, 2, 3, '#f7eee0');
      box(c, 14, 13, 1, 2, ink);
    }
    box(c, side ? (dir === 1 ? 17 : 7) : 12, 15, side ? 2 : 1, 1, tint(skin, -38));
  }
  box(c, 9, 17, 6, 1, back ? tint(color, -25) : '#f0e6ce');
  if (hat) {
    box(c, 7, 5, 11, 6, ink);
    box(c, 8, 5, 9, 5, color);
    box(c, 8, 5, 7, 2, tint(color, 35));
    box(c, 7, 10, 11, 2, tint(color, -20));
    box(c, dir === 3 ? 4 : 9, 10, 11, 2, tint(color, -18));
    box(c, 13, 7, 2, 2, '#f3db9b');
  }
  if (bag) {
    if (back) {
      box(c, 8, 18, 9, 8, ink);
      box(c, 9, 18, 7, 7, '#b5814c');
      box(c, 9, 18, 7, 2, '#e1b875');
      box(c, 10, 22, 5, 3, '#d1a566');
      box(c, 12, 22, 1, 1, ink);
    } else if (side) {
      const x = dir === 1 ? 5 : 16;
      box(c, x, 18, 4, 8, ink);
      box(c, x + 1, 19, 2, 5, '#cf9b5c');
    } else {
      box(c, 7, 18, 1, 7, '#674f3f');
      box(c, 16, 18, 1, 7, '#674f3f');
    }
  }
  if (pose === 'interact') {
    box(c, dir === 3 ? 1 : 18, frame === 1 ? 14 : 17, 5, 3, ink);
    box(c, dir === 3 ? 1 : 19, frame === 1 ? 14 : 17, 3, 2, skin);
  }
  if (low) {
    box(c, 7, 22, 11, 4, tint(color, -10));
    box(c, 8, 20, 3, 3, skin);
    box(c, 15, 20, 3, 3, skin);
  }
  if (pose === 'caught') {
    for (const x of [2, 19]) {
      box(c, x, 10, 3, 12, ink);
      box(c, x + 1, 11, 2, 10, skin);
    }
    if (dir === 2) {
      box(c, 9, 12, 2, 3, '#fff8ed');
      box(c, 14, 12, 2, 3, '#fff8ed');
      box(c, 12, 15, 2, 2, ink);
    }
  }
  c.restore();
  return canvas;
}
export function playerCanvas(appearance: Appearance, dir = 2, frame = 0, pose: CharacterPose = 'walk') {
  return characterCanvas(
    APPEARANCE_OPTIONS.shirtColor[appearance.shirtColor].color,
    APPEARANCE_OPTIONS.skinTone[appearance.skinTone].color,
    dir,
    frame,
    appearance.accessory === 1,
    appearance,
    pose,
  );
}
export function residentCanvas(index: number, dir = 2, frame = 0, pose: CharacterPose = 'idle') {
  const canvas = characterCanvas(
    ['#587f9b', '#789663', '#b77c69'][index],
    '#dfb587',
    dir,
    frame,
    false,
    undefined,
    pose,
  );
  const c = canvas.getContext('2d')!;
  if (index === 0) {
    box(c, 6, 6, 14, 4, '#344f65');
    box(c, 15, 9, 6, 2, '#d2b57b');
    box(c, 8, 20, 2, 6, '#e2c78d');
    box(c, 17, 23, 5, 4, '#966c4f');
  } else if (index === 1) {
    box(c, 4, 7, 17, 3, '#d6c28c');
    box(c, 8, 4, 10, 4, '#bfaa73');
    box(c, 8, 20, 8, 7, '#b9b48a');
    box(c, 20, pose === 'interact' && frame === 1 ? 18 : 22, 2, 8, '#8a7552');
    box(c, 19, 27, 4, 3, '#748b8b');
  } else {
    box(c, 8, 20, 8, 7, '#eee0b5');
    box(c, 9, 23, 6, 1, '#c9b78f');
    if (pose === 'interact') {
      box(c, 18, 18, 6, 5, '#bb9866');
      box(c, 20, 17, 3, 2, '#71986c');
    }
  }
  return canvas;
}
const avatarCache = new Map<string, { portrait: string; sheet: string; caught: string }>();
export function avatarArt(appearance: Appearance) {
  const key = JSON.stringify(appearance);
  const cached = avatarCache.get(key);
  if (cached) return cached;
  const sheet = document.createElement('canvas');
  sheet.width = 96;
  sheet.height = 128;
  const context = sheet.getContext('2d')!;
  for (let direction = 0; direction < 4; direction++)
    [0, 1, 0, 2].forEach((frame, column) =>
      context.drawImage(playerCanvas(appearance, direction, frame), column * 24, direction * 32),
    );
  const art = {
    portrait: playerCanvas(appearance).toDataURL(),
    sheet: sheet.toDataURL(),
    caught: playerCanvas(appearance, 2, 0, 'caught').toDataURL(),
  };
  if (avatarCache.size >= 20) avatarCache.delete(avatarCache.keys().next().value!);
  avatarCache.set(key, art);
  return art;
}
export function photoData(st: Station, x: number, y: number, subject: string) {
  const source = townCanvas(st, subject === 'position' ? insideBuilding(st.local, { x, y }) : null, true),
    out = document.createElement('canvas');
  out.width = 288;
  out.height = 176;
  const c = out.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  const sx = Math.max(0, Math.min(source.width - 240, x * 16 - 120)),
    sy = Math.max(0, Math.min(source.height - 144, y * 16 - 72));
  c.drawImage(source, sx, sy, 240, 144, 0, 0, 288, 176);
  return out.toDataURL('image/png');
}
