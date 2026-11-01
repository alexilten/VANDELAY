/*
 * EXAMPLE GEOMETRY ONLY.
 * Stand-in for engine output so the viewer can be built before the Home engine
 * lands. Sites and buildings here are illustrative, not designs: no real
 * parcel, code check or structure stands behind them.
 *
 * Architectural character (the project's architecture standard): buildings sit
 * lightly in the landscape. Timber volumes on blackened steel piers, deep steel
 * roof plates that overhang, big glass walls toward the view, weathered-steel
 * accents and board-formed concrete where a building meets the slope.
 */
import type { CategoryId } from '../design/categories';
import { terrainZ, type MaterialId, type OptionGeometry, type Plant, type Point2, type Solid, type SolidRole, type Terrain } from './geometry';

const FT = 304.8;

class Builder {
  readonly solids: Solid[] = [];
  private n = 0;
  constructor(readonly terrain: Terrain) {}

  ground(x: number, y: number): number {
    return terrainZ(this.terrain, x, y);
  }

  /** Adds a box whose base sits at `z0`. */
  box(role: SolidRole, material: MaterialId, c: Point2, z0: number, size: readonly [number, number, number], rotation = 0, tilt?: number) {
    this.solids.push({
      id: `${role}-${this.n++}`,
      role,
      material,
      center: [c[0], c[1], z0 + size[2] / 2],
      size,
      rotation,
      ...(tilt === undefined ? {} : { tilt }),
    });
  }
}

/** Local (lx, ly) in a frame centred at c and rotated by deg → site coordinates. */
const at = (c: Point2, deg: number, lx: number, ly: number): Point2 => {
  const r = (deg * Math.PI) / 180;
  return [c[0] + lx * Math.cos(r) - ly * Math.sin(r), c[1] + lx * Math.sin(r) + ly * Math.cos(r)];
};

type BarOpts = {
  clad?: MaterialId;
  /** Which end is glass: +1 is the local +X end, -1 the -X end, 0 both long sides get a glass band. */
  glass?: 1 | -1 | 0;
  roofOverhang?: number;
  /** Raise the floor this far above the highest corner of ground. */
  lift?: number;
  /** Force a floor level instead of reading the ground. */
  floor?: number;
  /** Leave off the flat roof plate, e.g. when a pitched roof is added. */
  roof?: boolean;
};

/** A single timber volume with a steel roof plate, glass toward the view, and piers or a plinth to the ground. */
function bar(b: Builder, c: Point2, len: number, wid: number, hgt: number, rot: number, o: BarOpts = {}): number {
  const corners = [at(c, rot, -len / 2, -wid / 2), at(c, rot, len / 2, -wid / 2), at(c, rot, len / 2, wid / 2), at(c, rot, -len / 2, wid / 2)];
  const grounds = corners.map(([x, y]) => b.ground(x, y));
  const hi = Math.max(...grounds);
  const lo = Math.min(...grounds);
  const floor = o.floor ?? hi + (o.lift ?? 450);

  b.box('module', o.clad ?? 'timber', c, floor, [len, wid, hgt], rot);
  const ov = o.roofOverhang ?? 900;
  if (o.roof !== false) b.box('roof', 'blackSteel', c, floor + hgt, [len + ov * 2, wid + ov, 160], rot);

  const g = o.glass ?? 1;
  if (g === 0) {
    for (const side of [-1, 1]) b.box('glazing', 'glass', at(c, rot, 0, (side * (wid + 60)) / 2), floor + 400, [len - 1200, 60, hgt - 800], rot);
  } else {
    b.box('glazing', 'glass', at(c, rot, (g * (len + 60)) / 2, 0), floor + 150, [60, wid - 300, hgt - 300], rot);
  }

  // Meet the ground: a concrete plinth where it is close, steel piers where it falls away.
  if (floor - lo < 900) {
    b.box('plinth', 'concrete', c, lo - 300, [len - 600, wid - 600, floor - lo + 300], rot);
  } else {
    const step = 3600;
    const nx = Math.max(2, Math.round(len / step) + 1);
    for (let i = 0; i < nx; i++) {
      for (const side of [-1, 1]) {
        const lx = -len / 2 + 450 + (i * (len - 900)) / (nx - 1);
        const p = at(c, rot, lx, side * (wid / 2 - 450));
        const gz = b.ground(p[0], p[1]);
        if (floor - gz > 150) b.box('pier', 'blackSteel', p, gz - 200, [220, 220, floor - gz + 200], rot);
      }
    }
  }
  return floor;
}

function deck(b: Builder, c: Point2, len: number, wid: number, floor: number, rot: number) {
  b.box('deck', 'timber', c, floor - 200, [len, wid, 200], rot);
  // A thin steel rail on the three open sides.
  b.box('rail', 'blackSteel', at(c, rot, len / 2 - 25, 0), floor, [50, wid, 1050], rot);
  b.box('rail', 'blackSteel', at(c, rot, 0, wid / 2 - 25), floor, [len, 50, 1050], rot);
  b.box('rail', 'blackSteel', at(c, rot, 0, -wid / 2 + 25), floor, [len, 50, 1050], rot);
  const gz = b.ground(...at(c, rot, len / 2 - 300, 0));
  if (floor - gz > 400) for (const s of [-1, 1]) b.box('pier', 'blackSteel', at(c, rot, len / 2 - 300, s * (wid / 2 - 300)), gz - 200, [180, 180, floor - gz], rot);
}

const rect = (w: number, d: number, x0 = 0, y0 = 0): Point2[] => [[x0, y0], [x0 + w, y0], [x0 + w, y0 + d], [x0, y0 + d]];

/** Deterministic scatter of trees in a ring around the lot and along its edges. */
function plants(seed: number, w: number, d: number, count: number, scale = 1): Plant[] {
  let s = seed;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const out: Plant[] = [];
  for (let i = 0; out.length < count && i < count * 6; i++) {
    const x = (rnd() * 1.6 - 0.3) * w;
    const y = (rnd() * 1.6 - 0.3) * d;
    const inside = x > w * 0.12 && x < w * 0.88 && y > d * 0.12 && y < d * 0.88;
    // Keep the side facing the default camera (south-west) open, so trees frame the view instead of blocking it.
    const towardCamera = ((x - w / 2) / w) * -0.55 + ((y - d / 2) / d) * -0.83 > -0.05;
    if (inside || towardCamera) continue;
    out.push({ at: [x, y], height: (4000 + rnd() * 5000) * scale });
  }
  return out;
}

/** 0.85–1.2 from the first brief answer, so the model responds as the person changes it. */
const sizeFactor = (picks: readonly number[], options: number) => 0.85 + ((picks[0] ?? 1) / Math.max(1, options - 1)) * 0.35;

function home(i: number, picks: readonly number[]): OptionGeometry {
  const W = 50 * FT, D = 100 * FT;
  const terrain: Terrain = { kind: 'plane', z0: 0, slopePct: 6, aspect: 270 }; // falls to the west
  const b = new Builder(terrain);
  const k = sizeFactor(picks, 4);
  const c: Point2 = [W / 2, D * 0.55];
  if (i === 0) {
    // Two modules stepping down the slope, the lower one opening west to a cantilevered deck.
    const f1 = bar(b, [c[0] + 3200, c[1] + 1400], 8400 * k, 4300, 3300, 0, { glass: -1 });
    b.box('module', 'corten', [c[0] + 3200 + (8400 * k) / 2 + 40, c[1] + 1400], f1 + 300, [80, 3200, 2700]);
    const f2 = bar(b, [c[0] - 3600, c[1] - 1200], 8400 * k, 4300, 3300, 0, { glass: -1, floor: f1 - 900, lift: 0 });
    deck(b, [c[0] - 3600 - (8400 * k) / 2 - 1600, c[1] - 1200], 3200, 4300, f2, 0);
    // A weathered-steel shutter that slides aside to open the glass wall.
    b.solids.push({
      id: 'shutter-west',
      role: 'shutter',
      material: 'corten',
      center: [c[0] - 3600 - (8400 * k) / 2 - 140, c[1] - 1200, f2 + 1650],
      size: [60, 3900, 3000],
      rotation: 0,
      mechanism: { kind: 'slide', axis: [0, 1], travel: 3700 },
    });
  } else if (i === 1) {
    // A taller panel cottage with a shed roof and a loft, set on a concrete plinth.
    const len = 9600 * k;
    const f = bar(b, c, len, 5600, 5200, 90, { glass: 0, roof: false });
    b.box('roof', 'blackSteel', c, f + 5200 + 420, [len + 1200, 6600, 160], 90, 8);
    b.box('glazing', 'glass', at(c, 90, len / 2 + 30, 0), f + 200, [60, 4000, 4600], 90);
    deck(b, [c[0] - 4600, c[1]], 3000, 6000, f, 0);
  } else {
    // One module cantilevered off a concrete core, with a long deck to the view.
    const len = 7600 * k;
    const core: Point2 = [c[0] + 1800, c[1]];
    const gz = b.ground(core[0], core[1]);
    b.box('plinth', 'concrete', core, gz - 300, [2600, 3600, 1300]);
    const f = gz + 1000;
    bar(b, [c[0], c[1]], len, 4200, 3200, 0, { glass: -1, floor: f });
    deck(b, [c[0] - len / 2 - 2400, c[1]], 4800, 4200, f, 0);
  }
  return {
    site: { boundary: rect(W, D), terrain, buildable: rect(W - 2 * 5 * FT, D - 20 * FT - 15 * FT, 5 * FT, 20 * FT) },
    solids: b.solids,
    plants: plants(7 + i, W, D, 18),
    example: true,
  };
}

function business(i: number, picks: readonly number[]): OptionGeometry {
  const W = 60 * FT, D = 120 * FT;
  const terrain: Terrain = { kind: 'plane', z0: 0, slopePct: 1, aspect: 180 };
  const b = new Builder(terrain);
  const k = sizeFactor(picks, 4);
  const c: Point2 = [W / 2, D * 0.5];
  const gz = b.ground(...c);
  if (i === 0) {
    // A glass pavilion under a deep steel canopy, with a timber terrace.
    b.box('plinth', 'concrete', c, gz - 300, [17000 * k, 12000, 600]);
    b.box('module', 'glass', [c[0], c[1] + 1000], gz + 300, [13000 * k, 8000, 3800]);
    b.box('module', 'corten', [c[0] + (13000 * k) / 2 - 1500, c[1] + 1000], gz + 300, [3000, 8000, 3800]);
    b.box('canopy', 'blackSteel', c, gz + 4100, [19000 * k, 15000, 300]);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) b.box('pier', 'blackSteel', [c[0] + x * 8500 * k, c[1] + y * 6500], gz + 300, [200, 200, 3800]);
    b.box('deck', 'timber', [c[0], c[1] - 9500], gz - 100, [17000 * k, 6000, 300]);
  } else if (i === 1) {
    // Two storeys: a glass ground floor and a timber flat above that cantilevers to the street.
    b.box('module', 'glass', c, gz, [14000 * k, 10000, 3800]);
    b.box('module', 'concrete', [c[0] + (14000 * k) / 2 - 1800, c[1]], gz, [3600, 10000, 3800]);
    bar(b, [c[0], c[1] - 1500], 15000 * k, 9000, 3300, 0, { glass: 0, floor: gz + 3800 });
  } else {
    // A small weathered-steel kiosk with a canopy in a garden.
    b.box('module', 'corten', c, gz, [4600 * k, 3200, 3000]);
    b.box('canopy', 'blackSteel', [c[0], c[1] - 1200], gz + 3000, [7600 * k, 6400, 180]);
    b.box('deck', 'timber', [c[0], c[1] - 4600], gz - 100, [9000 * k, 4200, 200]);
  }
  return { site: { boundary: rect(W, D), terrain }, solids: b.solids, plants: plants(21 + i, W, D, i === 2 ? 30 : 16), example: true };
}

function mixedUse(i: number, picks: readonly number[]): OptionGeometry {
  const W = 100 * FT, D = 150 * FT;
  const terrain: Terrain = { kind: 'plane', z0: 0, slopePct: 4, aspect: 180 };
  const b = new Builder(terrain);
  const c: Point2 = [W / 2, D * 0.5];
  const gz = b.ground(c[0], c[1] - 10000);
  const floors = i === 0 ? 6 : i === 1 ? 8 : 0;
  const k = sizeFactor(picks, 4);
  if (floors) {
    // Shops in a concrete and glass base; timber floors with steel-framed glass bands above.
    const w = 24000 * k, d = 18000;
    b.box('plinth', 'concrete', c, gz - 1500, [w + 2000, d + 2000, 1500 + b.ground(c[0], c[1] + 10000) - gz + 300]);
    b.box('module', 'glass', c, gz, [w, d, 4500]);
    b.box('canopy', 'blackSteel', [c[0], c[1] - d / 2 - 1200], gz + 4500, [w + 2400, 2600, 220]);
    const tw = w - 3000, td = d - 2000;
    let z = gz + 4500;
    for (let f = 0; f < floors; f++) {
      b.box('module', i === 1 ? 'timber' : f % 2 ? 'timber' : 'timber', c, z, [tw, td, 1100]);
      b.box('glazing', 'glass', c, z + 1100, [tw - 200, td - 200, 2000]);
      z += 3100;
    }
    b.box('roof', 'blackSteel', c, z, [tw + 1600, td + 1600, 300]);
    if (i === 1) b.box('module', 'corten', [c[0] + tw / 2 - 2400, c[1] + td / 2 - 2400], gz + 4500, [4000, 4000, floors * 3100 + 2000]);
  } else {
    // A row of townhouses stepping up the street, and a café at the corner.
    for (let t = 0; t < 5; t++) {
      const p: Point2 = [c[0] - 12000 + t * 6000, c[1] + 2000];
      const f = bar(b, p, 5600, 11000, 6200, 90, { glass: 1, roof: false });
      b.box('roof', 'blackSteel', p, f + 6200, [5800, 12000, 160], 0, -7);
    }
    b.box('module', 'glass', [c[0] + 19000, c[1] - 6000], gz, [8000, 7000, 3600]);
    b.box('canopy', 'corten', [c[0] + 19000, c[1] - 6000], gz + 3600, [10000, 9000, 200]);
  }
  return { site: { boundary: rect(W, D), terrain }, solids: b.solids, plants: plants(33 + i, W, D, 14), example: true };
}

function venue(i: number, picks: readonly number[]): OptionGeometry {
  const W = 300000, D = 300000;
  const terrain: Terrain = { kind: 'plane', z0: 0, slopePct: 1.5, aspect: 180 };
  const b = new Builder(terrain);
  const c: Point2 = [W / 2, D / 2];
  const gz = b.ground(...c);
  const k = 0.9 + ((picks[1] ?? 1) / 3) * 0.25;
  const pw = 105000, pd = 68000;
  b.box('field', 'grass', c, gz - 100, [pw + 8000, pd + 8000, 100]);
  const rake = 32;
  const depth = (i === 0 ? 30000 : 26000) * k;
  const sides: [Point2, number, number][] = [
    [[c[0], c[1] - pd / 2 - 6000 - depth / 2], pw + 10000, 0],
    [[c[0], c[1] + pd / 2 + 6000 + depth / 2], pw + 10000, 180],
    [[c[0] - pw / 2 - 6000 - depth / 2, c[1]], pd + 10000, 90],
    [[c[0] + pw / 2 + 6000 + depth / 2, c[1]], pd + 10000, 270],
  ];
  sides.forEach(([p, len, rot], s) => {
    const steep = i === 1 && s === 3;
    const dep = steep ? depth * 0.8 : depth;
    const t = steep ? rake + 8 : rake;
    const h = dep * Math.tan((t * Math.PI) / 180);
    b.box('stand', 'concrete', p, gz + h / 2 - 600, [len, dep / Math.cos((t * Math.PI) / 180), 1200], rot, -t);
    b.box('stand', 'concrete', p, gz + h / 2 - 600, [len, 1500, 1200], rot);
    // Upper tier and club level for option A.
    if (i === 0) b.box('stand', 'concrete', at(p, rot, 0, -dep * 0.55), gz + h * 0.95, [len, dep * 0.5, 1000], rot, -t - 4);
    if (i === 0) b.box('glazing', 'glass', at(p, rot, 0, -dep * 0.25), gz + h * 0.62, [len * 0.8, 1500, 3500], rot);
    // Canopy: deep on A and B, a light lip on the open-skyline option.
    const cover = i === 2 ? 0.3 : 0.6;
    b.box('canopy', i === 1 ? 'corten' : 'blackSteel', at(p, rot, 0, -dep * (1 - cover / 2) + dep * 0.5), gz + h * 1.3 + (i === 0 ? 9000 : 4000), [len + 4000, dep * cover + 8000, 1200], rot, -6);
  });
  return { site: { boundary: rect(W, D), terrain }, solids: b.solids, plants: plants(51 + i, W, D, 60, 1.4), example: true };
}

const BUILDERS: Record<CategoryId, (i: number, picks: readonly number[]) => OptionGeometry> = {
  home,
  business,
  'mixed-use': mixedUse,
  venue,
};

/** Example geometry for one of the three options shown for a category. */
export function mockOptionGeometry(category: CategoryId, option: number, picks: readonly number[] = []): OptionGeometry {
  return BUILDERS[category](Math.min(Math.max(option, 0), 2), picks);
}
