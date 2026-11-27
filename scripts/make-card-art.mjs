import { mkdirSync, writeFileSync } from 'node:fs';
const ink = '#344842',
  paper = '#f3d9a0',
  orange = '#d77f55',
  green = '#688b69',
  blue = '#729da7',
  purple = '#9d86a1';
const path = (d, fill = 'none', extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const rect = (x, y, w, h, fill, rx = 3) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>`;
const circle = (x, y, r, fill) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;
const text = (x, y, t, size = 12) =>
  `<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" font-weight="bold" fill="${ink}" stroke="none" text-anchor="middle">${t}</text>`;
const head = (x, y, scared = false) =>
  circle(x, y, 14, '#e9b885') +
  path(`M${x - 14} ${y - 5}q-3-17 13-13q16-3 16 14l-7-4l-5 3l-3-7z`, ink) +
  circle(x - 4, y, 1.2, ink) +
  circle(x + 5, y, 1.2, ink) +
  path(`M${x - 3} ${y + 8}q4 ${scared ? -6 : 3} 8 0`);
const traveler = (x, y, color = blue, scared = false) =>
  path(`M${x - 10} ${y + 12}l-6 34h31l-6-34`, color) +
  path(`M${x - 6} ${y + 46}l-2 13m16-13l4 13m-23-35l-11 14m30-14l13 5`) +
  head(x, y, scared);
const suitcase = (x, y, w = 45, h = 32) =>
  rect(x + 12, y - 7, w - 24, 10, paper) +
  rect(x, y, w, h, orange) +
  path(`M${x + 8} ${y}v${h}m${w - 16} ${-h}v${h}`) +
  circle(x + 9, y + h + 3, 3, ink) +
  circle(x + w - 8, y + h + 3, 3, ink);
const train = (x, y, scale = 1) =>
  `<g transform="translate(${x} ${y}) scale(${scale})">${rect(0, 0, 110, 42, green, 7)}${rect(4, 5, 102, 8, paper)}${[8, 30, 52, 74].map((x) => rect(x, 17, 16, 12, blue, 1)).join('')}${path('M0 34h110')}${circle(20, 44, 6, ink)}${circle(91, 44, 6, ink)}</g>`;
const sheet = (x, y, t = '✓') =>
  rect(x, y, 32, 40, '#f6e8c0', 1) +
  path(`M${x + 6} ${y + 9}h18m-18 8h15m-15 8h10`) +
  text(x + 22, y + 34, t, 13);
const clock = (x, y, r) =>
  circle(x, y, r, paper) + circle(x, y, r - 5, '#f5e5bb') + path(`M${x} ${y - r + 10}v${r - 10}h${r - 12}`);
const bush = (x, y) =>
  circle(x - 16, y, 19, green) +
  circle(x + 10, y - 4, 24, green) +
  circle(x + 28, y + 8, 15, green) +
  path(`M${x - 29} ${y + 17}h70`);
const art = [];
art[0] =
  traveler(104, 64, blue, true) +
  Array.from(
    { length: 14 },
    (_, i) =>
      `<g transform="rotate(${i * 31 - 90} ${75 + (i % 4) * 18} ${89 + Math.floor(i / 4) * 9})">${rect(65 + (i % 4) * 18, 79 + Math.floor(i / 4) * 9, 17, 12, [orange, paper, green][i % 3])}${text(74 + (i % 4) * 18, 89 + Math.floor(i / 4) * 9, ['SEA', 'MOO', 'HI'][i % 3], 5)}</g>`,
  ).join('');
art[1] =
  path('M20 112Q110 160 205 112', 'none', 'stroke="#6dabad" stroke-width="10"') +
  path('M20 99q95-40 185 0M25 84v34m35-45v37m40-43v36m42-34v36m39-27v36') +
  rect(75, 76, 65, 11, orange) +
  [70, 150]
    .map(
      (x, i) =>
        circle(x, 66, 12, '#9ca79a') +
        circle(x + 8, 55, 9, '#b9bfb0') +
        path(`M${x + 15} 56l10 3l-11 3`, paper) +
        path(`M${x - 5} 78v8m9-8v8`) +
        circle(x + 10, 54, 1, ink),
    )
    .join('') +
  sheet(95, 58, 'A');
art[2] =
  sheet(27, 76) +
  sheet(145, 68) +
  traveler(108, 57, green) +
  rect(85, 84, 58, 14, orange) +
  rect(106, 68, 17, 19, orange) +
  rect(101, 65, 27, 9, paper) +
  text(60, 52, 'FORM 27B', 12) +
  path('M51 57l-9 13m120-19l-8 12');
art[3] =
  train(103, 37, 0.9) +
  path('M8 100h205m-205 7h205') +
  traveler(57, 68, orange, true) +
  path('M68 94l18-31l11 2') +
  text(158, 120, 'OTHER SIDE', 10);
art[4] =
  circle(113, 78, 50, paper) +
  path('M113 35l12 34l-12 30l-12-30z', orange) +
  path('M113 69l30 10l-30 10l-31-10z', blue) +
  text(113, 18, 'RIGHT', 12) +
  text(113, 147, 'RIGHT', 12) +
  text(36, 82, 'RIGHT', 10) +
  text(191, 82, 'RIGHT', 10);
art[5] =
  path('M47 35q-6-25 20-22q16-20 35-2q20-22 34 0q30-5 31 24z', '#bdc7bc') +
  path('M65 45l-5 10m34-13l-5 10m37-10l-5 10') +
  circle(98, 90, 26, '#c68d86') +
  circle(125, 88, 25, '#dca59a') +
  path('M94 65q-15 14 0 24q-18 11-4 22m26-44q15 12 0 21q14 12 0 23') +
  path('M96 113l-8 17h-20v-9h12l6-15m38 6l7 18h20v-10h-14l-5-13', green);
art[6] =
  rect(126, 28, 55, 95, ink, 8) +
  rect(131, 35, 45, 77, '#d1dbb7') +
  rect(146, 54, 16, 30, '#f6e5b0') +
  rect(150, 49, 8, 5, orange) +
  rect(148, 75, 12, 6, orange) +
  text(153, 102, '1%', 14) +
  path('M151 123q-5 21-39 4q-25-8-35-23') +
  `<ellipse cx="64" cy="89" rx="33" ry="24" fill="#c3a16b" transform="rotate(-18 64 89)"/>` +
  circle(54, 84, 2, ink) +
  circle(75, 94, 2, ink) +
  path('M51 68v-13m22 14l7-13');
art[7] =
  clock(115, 82, 55) +
  traveler(114, 76, blue) +
  path('M105 78l4-2m9 0l4 2') +
  text(171, 35, 'Z', 18) +
  text(190, 18, 'z', 12) +
  circle(68, 28, 12, orange) +
  circle(161, 28, 12, orange);
art[8] =
  path(
    'M12 137C215 142 207 75 52 111S18 51 143 66S199 17 83 24',
    'none',
    'stroke="#d79862" stroke-width="12"',
  ) +
  path('M113 110V70m0 26q-23-5-18-15q16-3 18 15', green) +
  [0, 1, 2, 3, 4]
    .map((_, i) => circle(113 + Math.sin(i * 1.256) * 11, 63 + Math.cos(i * 1.256) * 11, 8, paper))
    .join('') +
  circle(113, 63, 6, orange);
art[9] =
  suitcase(71, 101, 83, 25) +
  rect(45, 89, 136, 11, paper) +
  path('M68 88V65m0 9l-8-9m8 9l8-9') +
  circle(68, 60, 8, '#e7c993') +
  path('M144 88V57m-8 0h16l-2 14h-12z', blue) +
  path('M85 87l16-26h29l16 26z', orange) +
  circle(112, 53, 5, paper) +
  circle(112, 42, 3, paper) +
  traveler(26, 71, green, true);
art[10] =
  traveler(56, 65, green, true) +
  rect(93, 28, 102, 99, paper) +
  Array.from({ length: 36 }, (_, i) =>
    rect(96 + (i % 6) * 16, 31 + Math.floor(i / 6) * 15, 16, 15, (i * 7) % 5 === 0 ? ink : '#f8ebc9', 0),
  ).join('') +
  text(137, 68, 'L O S T', 9) +
  text(60, 25, '7 LETTERS?', 12);
art[11] =
  suitcase(93, 62, 73, 54) +
  rect(100, 76, 25, 15, paper) +
  rect(134, 76, 25, 15, paper) +
  path('M125 81h9m-34-3l-10-5m69 5l10-5M108 120l-16 15l-17-3m75-12l18 8l6-8m-88-42l-19 16m104-12l15-9') +
  path('M22 72h32m-21 15h20m-29 16h32');
art[12] =
  traveler(47, 82, green) +
  rect(86, 75, 103, 31, orange) +
  rect(124, 40, 27, 37, orange) +
  rect(112, 26, 51, 20, paper) +
  text(138, 97, 'REJECTED', 15) +
  sheet(90, 110, 'X');
art[13] =
  circle(154, 69, 9, ink) +
  [0, 1, 2, 3]
    .map(
      (_, i) => `<g transform="rotate(${i * 90} 154 69)">${path('M155 62q-39-48-39-8q5 19 39 19', blue)}</g>`,
    )
    .join('') +
  circle(154, 69, 6, paper) +
  path('M154 79v54m-20 0h39') +
  sheet(22, 27, '?') +
  `<g transform="rotate(22 74 87)">${sheet(61, 68, '?')}</g>` +
  path('M91 46l19 12m-17 36l19-14');
art[14] =
  traveler(54, 65, green) +
  rect(46, 88, 54, 22, orange) +
  path('M100 91l40-10v16l-40 12', blue) +
  path('M145 79q30-15 49-11m-45 22q34 0 48 10m-45-2q27 13 34 26') +
  sheet(162, 23, '!') +
  suitcase(137, 111, 26, 19);
art[15] =
  path('M79 37l-29 10l-19 48l21 9l15-31l-3 67h97l-8-67l18 31l21-9l-22-48l-29-10z', green) +
  path('M88 37l24 41l23-41', paper) +
  path('M112 78v62') +
  rect(68, 83, 34, 36, orange) +
  rect(123, 83, 31, 36, orange) +
  train(67, 99, 0.35) +
  circle(148, 96, 14, blue) +
  path('M135 95h26m-13-14v28') +
  rect(100, 18, 38, 26, paper) +
  text(119, 35, 'RAIL', 10);
art[16] =
  rect(78, 87, 78, 37, orange) +
  path('M72 87h90l-10-12H83z', paper) +
  path('M91 81l-29-39l21-12l28 49m18 0l27-49l22 12l-31 40', paper) +
  text(76, 45, 'RAIL', 7) +
  text(161, 45, 'RAIL', 7) +
  path('M100 95q8 12 13 0q10 13 19 0');
art[17] =
  traveler(111, 77, orange) +
  circle(97, 64, 19, green) +
  circle(129, 64, 19, green) +
  circle(97, 64, 12, blue) +
  circle(129, 64, 12, blue) +
  path('M108 57h10') +
  `<g transform="translate(70 -11) scale(.65)">${circle(97, 64, 19, green) + circle(129, 64, 19, green) + circle(97, 64, 12, paper) + circle(129, 64, 12, paper)}</g>` +
  path('M72 39l-14-9m11 23l-19-2');
art[18] =
  traveler(53, 64, purple) +
  rect(96, 86, 103, 10, paper) +
  path('M106 96l-9 34m89-34l9 34') +
  path('M105 86l23-29l12 29m6 0l23-29l12 29', orange) +
  path('M69 89l38-17m-7-8l15 15') +
  text(148, 37, 'SORRY!', 16);
art[19] =
  bush(112, 83) +
  rect(84, 102, 69, 12, orange) +
  circle(95, 124, 10, ink) +
  circle(143, 124, 10, ink) +
  circle(95, 124, 4, paper) +
  circle(143, 124, 4, paper) +
  path('M55 92H24m32 12H35m25 13H16') +
  circle(110, 77, 2, ink) +
  circle(124, 77, 2, ink);
art[20] =
  traveler(95, 83, blue) +
  path('M69 101l62 4l-8 23H61z', green) +
  rect(136, 36, 58, 13, paper) +
  path('M147 49l-6 49m42-49l5 49m-9-49l29 73') +
  traveler(188, 87, orange) +
  text(81, 31, 'Z', 20) +
  text(104, 18, 'z', 12);
art[21] =
  traveler(45, 88, blue, true) +
  path('M72 65Q132-17 197 65z', paper) +
  path('M72 65l125 0l-8 15H80z', green) +
  path('M79 81h113l-8 13H85z', orange) +
  path('M83 96h104l-13 15H96z', paper) +
  path('M64 121l135-1') +
  circle(117, 41, 1, ink) +
  circle(141, 38, 1, ink) +
  circle(165, 47, 1, ink);
art[22] =
  path('M88 30h51l-5 49l-19 14l-22-14z', paper) +
  path('M88 40H67q-8 42 29 33m43-33h21q9 42-28 33M114 92v27m-20 0h41l9 14H84z', orange) +
  Array.from({ length: 9 }, (_, i) =>
    rect(88 + (i % 3) * 15, 35 + Math.floor(i / 3) * 16, 15, 13, [orange, blue, green][i % 3]),
  ).join('') +
  text(114, 70, 'WOW', 9);
art[23] =
  traveler(113, 92, orange) +
  path('M113 18l-35 41h16L65 88h96l-25-29h14z', green) +
  path('M97 135l-7 6h18m14-6l13 6h11') +
  text(185, 65, '?', 30) +
  path('M166 49l-7-11');
mkdirSync('public/cards', { recursive: true });
for (let id = 0; id < 24; id++)
  writeFileSync(
    `public/cards/${id}.svg`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 224 154"><rect width="224" height="154" fill="${id < 12 ? '#eed4a5' : id < 20 ? '#d1e0d8' : '#e2d5dc'}"/><circle cx="114" cy="79" r="65" fill="${id < 12 ? '#f3dfb7' : id < 20 ? '#e2eadd' : '#ece2e5'}"/><g stroke="${ink}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">${art[id]}</g></svg>`,
  );
console.log('Wrote 24 original card illustrations.');
