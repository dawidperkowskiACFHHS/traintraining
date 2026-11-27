import type { Archetype, Point } from './types';
import { hash, random } from './random';

type Lane = { points: Point[]; width: number };
type Plot = [number, number, number, number];
export interface DistrictPlan {
  platform: Point;
  plots: Plot[];
  lanes: Lane[];
  barriers: { x: number; y: number; length: number; vertical?: boolean; stone?: boolean }[];
  stalls: Point[];
  landmark: Point;
  scenic: Point;
}
const points = (pairs: number[][]): Point[] => pairs.map(([x, y]) => ({ x, y }));

/** Street loops, building blocks and shortcuts are authored per district, then seeded. */
export function districtPlan(seed: string, kind: Archetype): DistrictPlan {
  const rng = { rng: hash(seed + ':streets') };
  const lanes: Lane[] = [];
  const lane = (pairs: number[][], width = 3) => lanes.push({ points: points(pairs), width });
  let plots: Plot[],
    platform: Point,
    landmark = { x: 36, y: 16 },
    scenic = { x: 10.5, y: 17.5 };
  const barriers: DistrictPlan['barriers'] = [],
    stalls: Point[] = [];
  switch (kind) {
    case 'city':
      platform = { x: 44.5, y: 36.5 };
      plots = [
        [6, 5, 8, 7],
        [19, 4, 8, 8],
        [37, 4, 8, 7],
        [48, 11, 7, 8],
        [7, 24, 8, 7],
        [25, 25, 8, 6],
        [43, 25, 8, 6],
      ];
      lane(
        [
          [44, 37],
          [42, 32],
          [36, 24],
          [35, 14],
          [30, 10],
          [29, 3],
        ],
        4,
      );
      lane(
        [
          [4, 18],
          [18, 17],
          [29, 14],
          [42, 20],
          [56, 22],
        ],
        4,
      );
      lane(
        [
          [10, 13],
          [17, 13],
          [18, 23],
          [20, 33],
          [40, 33],
          [46, 22],
          [46, 4],
        ],
        2,
      );
      landmark = { x: 29, y: 17 };
      barriers.push(
        { x: 18, y: 25, length: 5, vertical: true, stone: true },
        { x: 37, y: 25, length: 6, vertical: true, stone: true },
      );
      break;
    case 'market':
      platform = { x: 16.5, y: 36.5 };
      plots = [
        [5, 4, 8, 7],
        [20, 4, 8, 6],
        [43, 4, 9, 7],
        [5, 23, 8, 7],
        [44, 25, 8, 6],
      ];
      lane(
        [
          [16, 37],
          [16, 29],
          [22, 25],
          [21, 12],
          [34, 11],
          [39, 4],
        ],
        4,
      );
      lane(
        [
          [4, 17],
          [15, 17],
          [26, 15],
          [39, 17],
          [55, 15],
        ],
        4,
      );
      lane(
        [
          [17, 32],
          [37, 31],
          [40, 25],
          [39, 11],
          [53, 12],
        ],
        2,
      );
      lane(
        [
          [28, 13],
          [29, 25],
          [37, 27],
        ],
        2,
      );
      for (const y of [13, 18, 24]) for (const x of [18, 22, 26, 33, 37, 41]) stalls.push({ x, y });
      landmark = { x: 31, y: 29 };
      barriers.push({ x: 15, y: 22, length: 5, vertical: true });
      break;
    case 'coast':
      platform = { x: 43.5, y: 36.5 };
      plots = [
        [6, 5, 7, 7],
        [19, 6, 7, 6],
        [34, 4, 7, 7],
        [6, 25, 8, 6],
        [28, 26, 8, 6],
      ];
      lane(
        [
          [43, 37],
          [46, 28],
          [48, 20],
          [48, 8],
          [45, 3],
        ],
        4,
      );
      lane(
        [
          [4, 17],
          [16, 16],
          [29, 18],
          [46, 17],
          [54, 17],
        ],
        3,
      );
      lane(
        [
          [14, 31],
          [19, 26],
          [17, 18],
          [29, 12],
          [43, 12],
        ],
        2,
      );
      lane(
        [
          [19, 27],
          [23, 33],
          [40, 32],
          [46, 28],
        ],
        2,
      );
      landmark = { x: 46, y: 11 };
      scenic = { x: 53.5, y: 17.5 };
      barriers.push({ x: 38, y: 22, length: 7, vertical: true, stone: true });
      break;
    case 'forest':
      platform = { x: 13.5, y: 36.5 };
      plots = [
        [7, 5, 6, 5],
        [40, 27, 7, 6],
        [39, 4, 6, 6],
      ];
      lane(
        [
          [13, 37],
          [19, 31],
          [16, 25],
          [24, 19],
          [18, 13],
          [24, 5],
        ],
        2,
      );
      lane(
        [
          [18, 13],
          [30, 11],
          [38, 16],
          [44, 23],
          [39, 34],
          [23, 33],
          [19, 31],
        ],
        2,
      );
      lane(
        [
          [24, 19],
          [31, 25],
          [44, 23],
        ],
        1,
      );
      landmark = { x: 30, y: 14 };
      scenic = { x: 44.5, y: 24.5 };
      barriers.push({ x: 25, y: 27, length: 8 }, { x: 31, y: 4, length: 5, vertical: true });
      break;
    case 'lake':
      platform = { x: 17.5, y: 36.5 };
      plots = [
        [6, 5, 7, 7],
        [21, 4, 7, 6],
        [6, 25, 7, 6],
        [33, 26, 8, 6],
        [46, 26, 7, 6],
      ];
      lane(
        [
          [17, 37],
          [18, 28],
          [24, 23],
          [30, 17],
          [33, 8],
          [37, 3],
        ],
        3,
      );
      lane(
        [
          [18, 28],
          [28, 33],
          [43, 34],
          [54, 23],
          [53, 17],
          [43, 16],
          [30, 17],
        ],
        2,
      );
      lane(
        [
          [5, 18],
          [18, 15],
          [30, 17],
        ],
        2,
      );
      landmark = { x: 36, y: 17 };
      barriers.push({ x: 22, y: 27, length: 4, vertical: true });
      break;
    case 'hill':
      platform = { x: 42.5, y: 36.5 };
      plots = [
        [5, 5, 7, 6],
        [24, 4, 7, 6],
        [44, 7, 7, 6],
        [7, 26, 7, 6],
        [25, 26, 7, 6],
      ];
      lane(
        [
          [42, 37],
          [50, 30],
          [39, 25],
          [21, 24],
          [16, 18],
          [37, 15],
          [40, 10],
          [33, 3],
        ],
        3,
      );
      lane(
        [
          [16, 18],
          [8, 16],
          [6, 22],
          [18, 34],
          [35, 33],
          [42, 37],
        ],
        2,
      );
      lane(
        [
          [29, 24],
          [30, 18],
          [37, 15],
        ],
        1,
      );
      landmark = { x: 38, y: 8 };
      barriers.push({ x: 20, y: 12, length: 8, stone: true }, { x: 35, y: 28, length: 7, stone: true });
      break;
    case 'rail':
      platform = { x: 30.5, y: 35.5 };
      plots = [
        [5, 4, 10, 8],
        [24, 4, 10, 7],
        [43, 4, 11, 8],
        [5, 24, 9, 7],
        [43, 24, 10, 7],
      ];
      lane(
        [
          [30, 37],
          [30, 27],
          [36, 24],
          [36, 13],
          [40, 3],
        ],
        4,
      );
      lane(
        [
          [4, 17],
          [19, 17],
          [36, 17],
          [55, 17],
        ],
        4,
      );
      lane(
        [
          [17, 7],
          [18, 28],
          [23, 32],
          [40, 32],
          [40, 23],
          [54, 22],
        ],
        2,
      );
      landmark = { x: 38, y: 25 };
      barriers.push({ x: 22, y: 23, length: 6 }, { x: 22, y: 25, length: 6 });
      break;
    default:
      platform = { x: 15.5, y: 36.5 };
      plots = [
        [6, 4, 7, 7],
        [28, 5, 8, 6],
        [45, 7, 7, 6],
        [7, 26, 8, 6],
        [39, 27, 8, 6],
      ];
      lane(
        [
          [15, 37],
          [20, 30],
          [17, 23],
          [21, 16],
          [19, 10],
          [24, 3],
        ],
        2,
      );
      lane(
        [
          [21, 16],
          [34, 17],
          [42, 14],
          [54, 17],
        ],
        2,
      );
      lane(
        [
          [20, 30],
          [31, 33],
          [36, 25],
          [34, 17],
        ],
        2,
      );
      landmark = { x: 49, y: 22 };
      barriers.push(
        { x: 26, y: 24, length: 7 },
        { x: 39, y: 6, length: 6, vertical: true },
        { x: 7, y: 16, length: 7 },
      );
  }
  // Vary the geometry inside each recognizable district structure, preserving endpoints.
  for (const road of lanes)
    for (let i = 1; i < road.points.length - 1; i++) {
      road.points[i].x += Math.floor(random(rng) * 3) - 1;
      road.points[i].y += Math.floor(random(rng) * 3) - 1;
    }
  return { platform, plots, lanes, barriers, stalls, landmark, scenic };
}
