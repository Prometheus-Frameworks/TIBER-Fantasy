/**
 * Drawing layout for the Architecture Lab sheet (TIBER-Fantasy #434).
 *
 * Positions and edge routes are presentation only. Edges are routed by hand as
 * orthogonal runs, the way services are drawn on a building section, so that
 * parallel contracts between the same two repositories stay separately
 * traceable instead of collapsing into one line.
 */
import type { LayerId, RepoId } from './types';

export const SHEET = { width: 1000, height: 1280 };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const NODE_BOXES: Record<RepoId, Box> = {
  data: { x: 405, y: 78, w: 190, h: 84 },
  teamstate: { x: 135, y: 288, w: 190, h: 84 },
  rop: { x: 405, y: 288, w: 190, h: 84 },
  rookies: { x: 675, y: 288, w: 190, h: 84 },
  forecast: { x: 270, y: 498, w: 190, h: 84 },
  forge: { x: 595, y: 658, w: 190, h: 84 },
  fantasy: { x: 350, y: 858, w: 300, h: 84 },
  ops: { x: 155, y: 1048, w: 190, h: 84 },
  research: { x: 655, y: 1048, w: 190, h: 84 },
};

export interface LayerBand {
  id: LayerId;
  level: string;
  title: string;
  caption: string;
  y: number;
  h: number;
}

/** Bands follow TIBER-Data's layer doctrine, top (source-grounded) to bottom (product). */
export const LAYER_BANDS: LayerBand[] = [
  { id: 'contracts', level: 'L0', title: 'Contracts & governed data', caption: 'canonical contracts, identity, provenance', y: 44, h: 152 },
  { id: 'reality', level: 'L1', title: 'Reality / friction', caption: 'source-grounded football context', y: 254, h: 152 },
  { id: 'projection', level: 'L2', title: 'Projection', caption: 'derived opinions, not evidence', y: 464, h: 152 },
  { id: 'adjudication', level: 'L3', title: 'Adjudication', caption: 'described in doctrine; repository archived', y: 624, h: 152 },
  { id: 'product', level: 'L4', title: 'Product / decision surface', caption: 'not upstream evidence by default', y: 824, h: 152 },
  { id: 'offflow', level: '—', title: 'Off the data path', caption: 'coordination and research records', y: 1014, h: 152 },
];

type Point = [number, number];

/** Waypoints per edge id. Consecutive points differ in exactly one axis. */
export const EDGE_ROUTES: Record<string, Point[]> = {
  // Data → Fantasy: three parallel runs down the left riser.
  'data-fantasy-identity-crosswalk': [[405, 104], [56, 104], [56, 884], [350, 884]],
  'data-fantasy-player-ownership': [[405, 120], [74, 120], [74, 900], [350, 900]],
  'data-fantasy-team-state': [[405, 136], [92, 136], [92, 916], [350, 916]],

  'data-teamstate-team-week-raw': [[440, 162], [440, 222], [230, 222], [230, 288]],
  'data-forecast-weekly-ppr-outcomes': [[470, 162], [470, 246], [365, 246], [365, 498]],
  'data-rop-compatibility-api': [[500, 162], [500, 288]],
  'data-rookies-draft-results': [[560, 162], [560, 222], [770, 222], [770, 288]],
  // Data → FORGE: right riser.
  'data-forge-weekly-player-input': [[595, 120], [930, 120], [930, 700], [785, 700]],

  'teamstate-forecast-team-week-values': [[262, 372], [262, 440], [320, 440], [320, 498]],
  'rop-forecast-doctrine': [[462, 372], [462, 440], [410, 440], [410, 498]],
  'rookies-forecast-transition-profile': [[730, 372], [730, 418], [440, 418], [440, 498]],

  'teamstate-fantasy-environment-movement': [[190, 372], [190, 800], [452, 800], [452, 858]],
  'rop-fantasy-role-opportunity-api': [[530, 372], [530, 858]],
  'rookies-fantasy-rookie-alpha': [[820, 372], [820, 812], [632, 812], [632, 858]],

  'forecast-fantasy-weekly-player-card': [[380, 582], [380, 858]],
  'fantasy-forecast-weekly-player-request': [[416, 858], [416, 582]],

  'forecast-forge-doctrine': [[460, 540], [690, 540], [690, 658]],
  'forge-fantasy-player-static': [[630, 742], [630, 770], [568, 770], [568, 858]],
  'forge-fantasy-evaluations-http': [[662, 742], [662, 790], [600, 790], [600, 858]],

  'ops-fantasy-operator-gate': [[250, 1048], [250, 996], [385, 996], [385, 942]],
  'fantasy-research-league-context-candidate': [[615, 942], [615, 996], [750, 996], [750, 1048]],
};

const CORNER = 10;

/** Rounded orthogonal path through the waypoints. */
export function routePath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i += 1) {
    const [x, y] = points[i];
    const next = points[i + 1];
    if (!next) {
      d += ` L ${x} ${y}`;
      break;
    }
    const [px, py] = points[i - 1];
    const inLen = Math.hypot(x - px, y - py);
    const outLen = Math.hypot(next[0] - x, next[1] - y);
    const r = Math.min(CORNER, inLen / 2, outLen / 2);
    const ax = x - Math.sign(x - px) * r;
    const ay = y - Math.sign(y - py) * r;
    const bx = x + Math.sign(next[0] - x) * r;
    const by = y + Math.sign(next[1] - y) * r;
    d += ` L ${ax} ${ay} Q ${x} ${y} ${bx} ${by}`;
  }
  return d;
}

/** Midpoint of the longest segment: where the evidence tag sits. */
export function routeLabelPoint(points: Point[]): Point {
  let best: Point = points[0];
  let bestLen = -1;
  for (let i = 1; i < points.length; i += 1) {
    const [x1, y1] = points[i - 1];
    const [x2, y2] = points[i];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len > bestLen) {
      bestLen = len;
      best = [(x1 + x2) / 2, (y1 + y2) / 2];
    }
  }
  return best;
}

/** Arrowhead triangle at the end of a route, pointing along its last segment. */
export function arrowHead(points: Point[], size = 7): string {
  const [x, y] = points[points.length - 1];
  const [px, py] = points[points.length - 2];
  const dx = Math.sign(x - px);
  const dy = Math.sign(y - py);
  const bx = x - dx * size * 1.5;
  const by = y - dy * size * 1.5;
  return `${x},${y} ${bx - dy * size * 0.7},${by + dx * size * 0.7} ${bx + dy * size * 0.7},${by - dx * size * 0.7}`;
}
