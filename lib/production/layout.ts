import type { StageCable, StageMapData, ZoneId } from './types';

// Where everything sits on the hotel stage map, seen from above: crowd to the
// left, singers below, keys player on the wall side of the keyboards. Positions
// and cable anchor points are code (they match the drawings in drawings.ts);
// devices and cables themselves come from the stored map data. A device whose
// `prop` has no entry here (e.g. a quick-added mic) simply isn't drawn.

export const FULL_VIEWBOX: [number, number, number, number] = [330, 128, 550, 650];

export type PropLayout = { x: number; y: number; w: number; h: number; zone: ZoneId; label?: string; lx?: number; ly?: number };

export const PROPS: Record<string, PropLayout> = {
  laptop: { x: 378, y: 266, w: 36, h: 52, zone: 'instruments', label: 'Computer', ly: -38 },
  keys: { x: 482, y: 340, w: 164, h: 70, zone: 'instruments', label: 'Keys 1 + 2', ly: -48 },
  iface: { x: 416, y: 326, w: 30, h: 18, zone: 'instruments' },
  talkback: { x: 624, y: 318, w: 26, h: 28, zone: 'mics', label: 'Talkback', lx: 48, ly: -2 },
  p16k: { x: 594, y: 320, w: 24, h: 20, zone: 'musician_ears', label: 'Keys P16', lx: 6, ly: 26 },
  di: { x: 650, y: 196, w: 68, h: 30, zone: 'di', label: 'DI box', ly: 32 },
  tx: { x: 650, y: 182, w: 62, h: 16, zone: 'vocal_ears', label: 'Vocalist In-Ears', ly: -28 },
  guitar: { x: 614, y: 440, w: 66, h: 36, zone: 'instruments', label: 'Guitar', lx: -40, ly: 22 },
  bass: { x: 708, y: 452, w: 76, h: 36, zone: 'instruments', label: 'Bass', lx: 48, ly: 0 },
  p16gb: { x: 664, y: 520, w: 52, h: 20, zone: 'musician_ears', label: 'Guitar + Bass P16', ly: 24 },
  p16d: { x: 786, y: 588, w: 24, h: 20, zone: 'musician_ears', label: 'Drums P16', lx: -54, ly: 0 },
  drums: { x: 770, y: 690, w: 92, h: 96, zone: 'instruments', label: 'Drums', ly: 62 },
  stagebox: { x: 850, y: 478, w: 32, h: 94, zone: 'stagebox', label: 'Stage box', lx: -12, ly: 64 },
  hub: { x: 850, y: 446, w: 30, h: 18, zone: 'musician_ears', label: 'P16 hub', lx: -56, ly: -2 },
  rx: { x: 850, y: 330, w: 30, h: 58, zone: 'mics', label: 'Receivers', lx: -58, ly: 0 },
};
/** Drawing order (later = on top). */
export const PROP_ORDER = ['laptop', 'keys', 'iface', 'talkback', 'p16k', 'di', 'tx', 'guitar', 'bass', 'p16gb', 'p16d', 'drums', 'stagebox', 'hub', 'rx'];

/** The folding table the stage box, P16 hub and receivers sit on. */
export const TABLE = { x: 822, y: 288, w: 54, h: 250 };

const SBIN = (n: number): [number, number] => [834, 460 + (n - 1) * 1.35];
const SBOUT = (n: number): [number, number] => [834, 504 + (n - 1) * 1.1];
const DIIN = (n: number): [number, number] => [616, 186 + (n - 1) * 2.2];
const DIOUT = (n: number): [number, number] => [684, 186 + (n - 1) * 2.2];
const DRUM_POS: Record<string, [number, number]> = {
  'Kick mic': [-30, 0], 'Snare mic': [12, 21], 'High tom mic': [-4, 10], 'Mid tom mic': [-4, -10],
  'Floor tom mic': [19, -26], 'Overhead L': [-14, 24], 'Overhead R': [-14, -26],
};
// Keys/tracks cables leave the backs of the keyboards and run around the singer side.
const KEY_LANE: Record<string, number> = { k1l: 0, k1r: 1, k2l: 2, k2r: 3, trl: 4, trr: 5 };

const num = (p: string) => parseInt(p.replace(/\D+/g, ''), 10);

function anchorFrom(c: StageCable, rxOrder: string[]): [number, number] | null {
  const [d, p] = c.from;
  const n = num(p);
  switch (d) {
    case 'keys1': return [p === 'Out L' ? 551 : 555, 345];
    case 'keys2': return [p === 'Out L' ? 534 : 538, 376];
    case 'iface': return [401, p === 'Monitor 1' ? 324 : 328];
    case 'laptop': return [384, 290];
    case 'guitar': return [600, 452];
    case 'bass': return [692, 467];
    case 'drums': { const o = DRUM_POS[p]; return o ? [770 + o[0], 690 + o[1]] : null; }
    case 'di': return DIOUT(n);
    case 'talk': return [628, 328];
    case 'sb': return p === 'Ultranet' ? [866, 466] : p.startsWith('Out ') && n <= 3 ? SBOUT(n) : null;
    case 'hub': return [835, 440 + (n - 1) * 3];
  }
  const i = rxOrder.indexOf(d);
  return i >= 0 && i < 8 ? [835, 308 + i * 6.8] : null;
}
function anchorTo(c: StageCable): [number, number] | null {
  const [d, p] = c.to;
  const n = num(p);
  switch (d) {
    case 'di': return DIIN(n);
    case 'sb': return SBIN(n);
    case 'iface': return [408, 320];
    case 'hub': return [864, 446];
    case 'p16k': return [594, 320];
    case 'p16g': return [651, 520];
    case 'p16b': return [677, 520];
    case 'p16d': return [786, 588];
    case 'txL': return [631, 176];
    case 'txB': return [650, 176];
    case 'txG': return [669, 176];
  }
  return null;
}

/** Polyline with rounded corners. */
function rounded(pts: [number, number][], r = 12): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py) || 1;
    const l2 = Math.hypot(nx - x, ny - y) || 1;
    const rr = Math.min(r, l1 / 2, l2 / 2);
    d += ` L${(x - ((x - px) / l1) * rr).toFixed(1)},${(y - ((y - py) / l1) * rr).toFixed(1)} Q${x},${y} ${(x + ((nx - x) / l2) * rr).toFixed(1)},${(y + ((ny - y) / l2) * rr).toFixed(1)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx},${ly}`;
}

/** The SVG path for one cable on the map, or null if it isn't drawn. */
export function cableRoute(c: StageCable, rxOrder: string[]): string | null {
  if (c.type === 'Wireless') return null;
  const a = anchorFrom(c, rxOrder);
  const b = anchorTo(c);
  if (!a || !b) return null;
  const [x1, y1] = a;
  const [x2, y2] = b;
  if (c.id in KEY_LANE) {
    const i = KEY_LANE[c.id];
    const laneY = 392 + i * 2.4;
    const laneX = 566 + i * 2.4;
    const pts: [number, number][] = c.from[0] === 'iface'
      ? [a, [394 - i * 2, y1], [394 - i * 2, laneY], [laneX, laneY], [laneX, y2], b]
      : [a, [x1, laneY], [laneX, laneY], [laneX, y2], b];
    return rounded(pts, 10);
  }
  if (c.from[0] === 'sb' && c.to[0] === 'hub') return `M${x1},${y1} C${x1 + 14},${y1} ${x2 + 14},${y2} ${x2},${y2}`;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dy) > Math.abs(dx) * 1.3) return `M${x1},${y1} C${x1},${y1 + dy * 0.5} ${x2},${y2 - dy * 0.5} ${x2},${y2}`;
  return `M${x1},${y1} C${x1 + dx * 0.5},${y1} ${x2 - dx * 0.5},${y2} ${x2},${y2}`;
}

export function rxOrderOf(data: StageMapData): string[] {
  return data.devices.filter((d) => d.kind === 'rx').map((d) => d.id);
}

/** View box that frames one zone (or the whole stage). */
export function zoneViewBox(zone: ZoneId | null): [number, number, number, number] {
  if (!zone) return FULL_VIEWBOX;
  const pts = Object.values(PROPS).filter((p) => p.zone === zone);
  if (zone === 'stagebox') pts.push(PROPS.hub, PROPS.rx);
  if (zone === 'di' || zone === 'vocal_ears') pts.push(PROPS.di, PROPS.tx);
  if (!pts.length) return FULL_VIEWBOX;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x - p.w / 2 - 70);
    y0 = Math.min(y0, p.y - p.h / 2 - 45);
    x1 = Math.max(x1, p.x + p.w / 2 + 70);
    y1 = Math.max(y1, p.y + p.h / 2 + 50);
  }
  let w = Math.max(240, x1 - x0);
  let h = Math.max(240, y1 - y0);
  const [fx, fy, fw, fh] = FULL_VIEWBOX;
  const ratio = fw / fh;
  if (w / h > ratio) h = w / ratio;
  else w = h * ratio;
  if (w >= fw) return FULL_VIEWBOX;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  return [Math.min(Math.max(cx - w / 2, fx), fx + fw - w), Math.min(Math.max(cy - h / 2, fy), fy + fh - h), w, h];
}
