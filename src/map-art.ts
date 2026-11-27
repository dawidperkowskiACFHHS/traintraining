import type { World, Station } from './types';
import { buildingCanvas, treeCanvas, marketCanvas } from './art';
const miniatures = new WeakMap<Station, string>();
export function districtMiniature(station: Station) {
  const previous = miniatures.get(station);
  if (previous) return previous;
  const canvas = document.createElement('canvas');
  canvas.width = 56;
  canvas.height = 40;
  const c = canvas.getContext('2d')!;
  c.imageSmoothingEnabled = false;
  c.fillStyle = '#608d7250';
  c.fillRect(4, 25, 48, 9);
  c.fillStyle = '#d7ccaa';
  c.fillRect(12, 27, 38, 4);
  if (['coast', 'lake'].includes(station.kind)) {
    c.fillStyle = '#73afbd';
    c.fillRect(1, 29, 22, 6);
    c.fillStyle = '#d1e3d7';
    c.fillRect(3, 30, 12, 1);
  }
  const buildings = station.local.buildings.slice(0, 3);
  buildings.forEach((building, i) =>
    c.drawImage(buildingCanvas(building, false), 5 + i * 15, 9 - (i % 2) * 5, 23, 25),
  );
  if (station.kind === 'market') c.drawImage(marketCanvas(station.id % 3), 22, 14, 28, 28);
  if (['forest', 'rural', 'hill'].includes(station.kind)) {
    c.drawImage(treeCanvas(station.kind === 'forest'), 0, 0, 25, 34);
    c.drawImage(treeCanvas(station.kind === 'forest'), 32, 1, 24, 33);
  }
  const data = canvas.toDataURL();
  miniatures.set(station, data);
  return data;
}
export const mapX = (x: number) => x * 6 + 16;
export const mapY = (y: number) => y * 5.1 + 24;
export function landscape(w: World) {
  const lake = w.landmarks.find((feature) => feature.kind === 'lake')!;
  const forests = w.stations
    .filter((station) => station.kind === 'forest')
    .map(
      (station) =>
        `<path d="M-29 1Q-43-19-20-28Q1-43 25-23Q46-11 29 13Q9 38-19 23Z" transform="translate(${mapX(station.x)} ${mapY(station.y)})" fill="#d8e8d9" stroke="#b9d0be"/>`,
    )
    .join('');
  return `<rect width="650" height="550" fill="#eef3ec"/>
    <path d="M27 93Q89 34 154 65T301 84T469 44Q530 36 543 101T514 198Q458 222 413 177T271 171T117 158Q45 172 27 93Z" fill="#e0eadc"/>
    <path d="M22 342Q102 286 172 326T323 353T516 316Q561 384 543 488Q420 470 318 496T117 478Q19 486 22 342Z" fill="#e4ead8"/>
    <path d="M551-10Q530 48 548 100T541 205T555 319T540 421T548 560H660V-10Z" fill="#acd4eb" stroke="#609ac2" stroke-width="2"/>
    <path d="M564 7Q547 68 562 107T557 203T568 322T556 424T565 550" fill="none" stroke="#d2e9e9" stroke-width="4"/>
    <g stroke="#8dbad1" stroke-width="1.5" fill="none"><path d="M587 82h21m9 0h12M577 294h29m12 0h14M586 407h21m9 0h15M578 493h25"/></g>
    <path d="M7 233Q72 204 122 237T225 258T334 230T431 246T548 282" fill="none" stroke="#b9d7e4" stroke-width="7"/>
    <path d="M7 233Q72 204 122 237T225 258T334 230T431 246T548 282" fill="none" stroke="#84b5cf" stroke-width="1"/>
    ${forests}
    <path d="M-29 0Q-34-22-10-19Q4-35 25-18Q45-9 26 8Q5 27-18 14Z" transform="translate(${mapX(lake.x)} ${mapY(lake.y)})" fill="#aed4e9" stroke="#83b2cc"/>
    <g fill="none" stroke="#c4cbbb" stroke-width="1"><path d="M100 345Q141 265 205 274T287 339M113 350Q148 282 205 289T273 337M130 352Q160 301 206 306T256 338"/></g>
    <g fill="#bbc8bd" stroke="#81998e"><path d="M145 325l23-38l24 38l-25-15ZM181 340l28-47l29 47l-29-19Z"/></g>
    <text x="602" y="190" transform="rotate(90 602 190)" class="map-sea">THE PATIENT SEA</text>`;
}
export function stationLabels(w: World) {
  const occupied: { x: number; y: number; width: number }[] = [];
  return new Map(
    w.stations.map((station) => {
      const width = station.name.length * 6.6;
      const options = [
        { dx: 0, dy: 20 },
        { dx: 0, dy: -14 },
        { dx: width / 2 + 12, dy: 4 },
        { dx: -width / 2 - 12, dy: 4 },
        { dx: 0, dy: 32 },
        { dx: 0, dy: -26 },
      ];
      const scored = options
        .map((option) => {
          const x = mapX(station.x) + option.dx - width / 2,
            y = mapY(station.y) + option.dy - 11;
          const overlaps = occupied.filter(
            (box) => x < box.x + box.width + 5 && x + width + 5 > box.x && y < box.y + 18 && y + 18 > box.y,
          ).length;
          return {
            ...option,
            x,
            y,
            score: overlaps * 100 + (x < 5 || x + width > 555 || y < 8 || y > 510 ? 1000 : 0),
          };
        })
        .sort((a, b) => a.score - b.score);
      const best = scored[0];
      occupied.push({ x: best.x, y: best.y, width });
      return [station.id, { x: mapX(station.x) + best.dx, y: mapY(station.y) + best.dy }];
    }),
  );
}
