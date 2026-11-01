/**
 * Home engine v0: Home intent → placed modules, piers, solids, quantities,
 * checks and scores. Pure and deterministic: no clock, no randomness, and
 * output lengths rounded to whole millimetres.
 */
import {
  bearingDelta, centroid, convexMargin, edgeNormal, hashIntent, insetConvex, insideConvex, polygonArea,
  rotate2, terrainSampler, validateHomeIntent, vecToBearing,
  type GroundSampler, type HomeIntent, type Parti, type Point2,
} from '@vandelay/kernel';
import { findCatalog, type Catalog } from './catalog.ts';
import { layoutParti, sizeProgram, type LocalLayout, type LocalModule } from './layout.ts';
import { deriveFacts, jurisdictionChecks } from './jurisdiction.ts';
import { RULES } from './rules.ts';
import type {
  CheckResult, HomeError, HomeResult, PlacedModule, Pier, ScoreId, Solid, Traced,
} from './types.ts';

export const ENGINE_VERSION = '0.1.0';

const r0 = (v: number) => Math.round(v);
const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const P = '/body';

const traced = (value: number, unit: Traced['unit'], formula: string, reads: string[], rules: string[] = []): Traced => ({
  value: unit === 'score' || unit === 'ratio' || unit === 'index' ? r4(value) : r0(value),
  unit, formula, reads, rules,
});

// ── site ─────────────────────────────────────────────────────────────────────

/** Setback for each lot edge: the street edge is front, the edge facing most away from it is rear, the rest are sides. */
export const edgeSetbacks = (intent: HomeIntent): number[] => {
  const { boundary, frontEdge, zoning } = intent.body.site;
  const nf = edgeNormal(boundary, frontEdge);
  let rear = -1, best = Infinity;
  boundary.forEach((_, i) => {
    if (i === frontEdge) return;
    const n = edgeNormal(boundary, i);
    const dot = n[0] * nf[0] + n[1] * nf[1];
    if (dot < best) { best = dot; rear = i; }
  });
  return boundary.map((_, i) => (i === frontEdge ? zoning.setbacks.front : i === rear ? zoning.setbacks.rear : zoning.setbacks.side));
};

export interface SiteContext {
  readonly intent: HomeIntent;
  readonly catalog: Catalog;
  readonly ground: GroundSampler;
  readonly buildable: Point2[];
  readonly lotArea: number;
  readonly program: ReturnType<typeof sizeProgram>;
}

export const siteContext = (intent: HomeIntent): SiteContext | HomeError => {
  const issues = validateHomeIntent(intent);
  if (issues.length) return { ok: false, issues };
  const { catalog: c } = intent.body.design;
  const catalog = findCatalog(c.id, c.version);
  if (!catalog) return { ok: false, issues: [{ path: `${P}/design/catalog`, message: `unknown catalog ${c.id}@${c.version}` }] };
  const site = intent.body.site;
  return {
    intent,
    catalog,
    ground: terrainSampler(site.terrain),
    buildable: insetConvex(site.boundary, edgeSetbacks(intent)),
    lotArea: polygonArea(site.boundary),
    program: sizeProgram(intent.body.brief),
  };
};

/** Bearing along the street edge, used when rotation is 'auto' and no search ran. */
export const frontRotation = (intent: HomeIntent): number => {
  const { boundary, frontEdge } = intent.body.site;
  const a = boundary[frontEdge]!, b = boundary[(frontEdge + 1) % boundary.length]!;
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
};

// ── placement ────────────────────────────────────────────────────────────────

interface Frame { readonly anchor: Point2; readonly rotation: number }

/** A straight run of retaining wall beside benched module `i`, centred at (u, v) in its frame, running along its X (0) or Y (90). */
interface RetainingWall { readonly i: number; readonly u: number; readonly v: number; readonly along: 0 | 90; readonly length: number; readonly height: number; readonly base: number }

const toSite = (f: Frame, p: Point2): Point2 => {
  const q = rotate2(p, f.rotation);
  return [f.anchor[0] + q[0], f.anchor[1] + q[1]];
};

/** Maps a point in a module's own frame (u along its length, v across) to the site. */
const moduleToSite = (f: Frame, m: LocalModule, u: number, v: number): Point2 => {
  const local = rotate2([u, v], m.rot);
  return toSite(f, [m.cx + local[0], m.cy + local[1]]);
};

const footprint = (f: Frame, m: LocalModule, extraV: [number, number] = [0, 0]): Point2[] => {
  const hl = m.length / 2, hw = m.width / 2;
  return [
    moduleToSite(f, m, -hl, -hw - extraV[0]),
    moduleToSite(f, m, hl, -hw - extraV[0]),
    moduleToSite(f, m, hl, hw + extraV[1]),
    moduleToSite(f, m, -hl, hw + extraV[1]),
  ];
};

/** Deck depth on each long side of a module: [−v side, +v side]. Only the living module gets a deck, on its glass side. */
const deckSides = (m: LocalModule, c: Catalog): [number, number] =>
  m.kind !== 'living' ? [0, 0] : m.glassSide === 1 ? [0, c.deck.depth] : [c.deck.depth, 0];

/**
 * Puts the living deck, and the glass that opens onto it, on the downhill long side when the
 * catalog asks for it: the floor then only has to clear the ground under the module, not the
 * higher ground on the uphill side, which keeps the home lower on a slope.
 */
export const orientDecks = (ctx: SiteContext, layout: LocalLayout, f: Frame): LocalLayout => {
  if (ctx.catalog.deck.side !== 'downhill') return layout;
  const d = ctx.catalog.deck.depth;
  let changed = false;
  const modules = layout.modules.map((m) => {
    if (m.kind !== 'living') return m;
    const plus = ctx.ground(moduleToSite(f, m, 0, m.width / 2 + d / 2));
    const minus = ctx.ground(moduleToSite(f, m, 0, -m.width / 2 - d / 2));
    const side: 1 | -1 = plus < minus - 1 ? 1 : minus < plus - 1 ? -1 : m.glassSide;
    if (side === m.glassSide) return m;
    changed = true;
    return { ...m, glassSide: side };
  });
  return changed ? { ...layout, modules } : layout;
};

/** Cheap pre-check for option search: is every module and deck corner inside the buildable area? */
export const fitsBuildable = (ctx: SiteContext, layoutIn: LocalLayout, f: Frame): boolean => {
  if (ctx.buildable.length < 3) return false;
  const layout = orientDecks(ctx, layoutIn, f);
  return layout.modules.every((m) => footprint(f, m, deckSides(m, ctx.catalog)).every((p) => insideConvex(ctx.buildable, p)));
};

// ── evaluation ───────────────────────────────────────────────────────────────

export interface Choice {
  readonly parti: Parti;
  readonly anchor: Point2;
  readonly rotation: number;
  readonly foundation: 'piers' | 'steppedPods' | 'benched';
}

/** What the engine picks for each 'auto' field when evaluating a single intent without a search. */
export const defaultChoice = (ctx: SiteContext): Choice => {
  const d = ctx.intent.body.design;
  return {
    parti: d.parti,
    anchor: d.placement.anchor === 'auto' ? (ctx.buildable.length ? centroid(ctx.buildable) : centroid(ctx.intent.body.site.boundary)) : d.placement.anchor,
    rotation: d.placement.rotation === 'auto' ? frontRotation(ctx.intent) : d.placement.rotation,
    foundation: d.foundation === 'auto' ? (d.parti === 'steppedBar' ? 'steppedPods' : 'piers') : d.foundation,
  };
};

/** Samples the ground under a module and its deck, on a grid of about `step` mm. */
const groundUnder = (ctx: SiteContext, f: Frame, m: LocalModule, step = 1000): number[] => {
  const [d0, d1] = deckSides(m, ctx.catalog);
  const v0 = -m.width / 2 - d0, span = m.width + d0 + d1;
  const nu = Math.max(2, Math.ceil(m.length / step) + 1), nv = Math.max(2, Math.ceil(span / step) + 1);
  const out: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      out.push(ctx.ground(moduleToSite(f, m, -m.length / 2 + (m.length * i) / (nu - 1), v0 + (span * j) / (nv - 1))));
    }
  }
  return out;
};

/** Samples the ground under a module's own footprint (no deck), on a grid of about `step` mm. */
const groundUnderModule = (ctx: SiteContext, f: Frame, m: LocalModule, step = 1000): number[] => {
  const nu = Math.max(2, Math.ceil(m.length / step) + 1), nv = Math.max(2, Math.ceil(m.width / step) + 1);
  const out: number[] = [];
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      out.push(ctx.ground(moduleToSite(f, m, -m.length / 2 + (m.length * i) / (nu - 1), -m.width / 2 + (m.width * j) / (nv - 1))));
    }
  }
  return out;
};

/** Pier positions in a module's frame: both long edges, evenly spaced at or under the catalog spacing. */
const pierPoints = (c: Catalog, length: number, vEdges: readonly number[]): [number, number][] => {
  const inset = c.pier.size / 2;
  const n = Math.ceil((length - 2 * inset) / c.pier.spacing) + 1;
  const pts: [number, number][] = [];
  for (const v of vEdges) for (let i = 0; i < n; i++) pts.push([-length / 2 + inset + ((length - 2 * inset) * i) / (n - 1), v]);
  return pts;
};

export const evaluateChoice = (ctx: SiteContext, choice: Choice, layoutIn?: LocalLayout): HomeResult | HomeError => {
  const { intent, catalog: c, ground } = ctx;
  const body = intent.body;
  const planned = layoutIn ?? layoutParti(choice.parti, ctx.program, c);
  if (!planned) {
    return { ok: false, issues: [{ path: `${P}/design/parti`, message: `a ${choice.parti} needs at least two bedroom or bath modules besides living and core` }] };
  }
  const f: Frame = { anchor: choice.anchor, rotation: choice.rotation };
  const layout = orientDecks(ctx, planned, f);
  const pods = choice.foundation === 'piers' ? layout.modules.map(() => 0) : layout.modules.map((m) => m.wing);
  const benched = choice.foundation === 'benched';
  const podIds = [...new Set(pods)].sort((a, b) => a - b);
  const clear = RULES['vandelay.assumption.floor-clearance'].value;
  const levels = body.design.levels;
  const maxStep = levels.maxStep === 'auto' ? RULES['vandelay.assumption.pod-step'].value : levels.maxStep;

  // Floor level per pod. On piers: the lowest finished floor that keeps the underside clear of grade under every
  // module in it. Benched: the floor slab sits on a level bench cut down to the lowest grade under the pod's modules.
  const under = layout.modules.map((m) => groundUnder(ctx, f, m));
  const underModule = layout.modules.map((m) => groundUnderModule(ctx, f, m));
  const datum = new Map<number, number>();
  for (const pod of podIds) {
    if (levels.floorDatum !== 'auto') { datum.set(pod, levels.floorDatum); continue; }
    let need = benched ? Infinity : -Infinity;
    layout.modules.forEach((m, i) => {
      if (pods[i] !== pod) return;
      need = benched ? Math.min(need, Math.min(...underModule[i]!) + c.floorDepth) : Math.max(need, Math.max(...under[i]!) + clear + c.floorDepth);
    });
    datum.set(pod, Math.ceil(need / 10) * 10);
  }
  const ffl = (i: number) => datum.get(pods[i]!)!;

  const modules: PlacedModule[] = layout.modules.map((m, i) => {
    const ctr = toSite(f, [m.cx, m.cy]);
    return {
      id: m.id, kind: m.kind, catalogId: `${c.id}@${c.version}/${m.kind}`,
      center: [r0(ctr[0]), r0(ctr[1]), r0(ffl(i))], length: m.length, width: m.width,
      rotation: r4(choice.rotation + m.rot), pod: pods[i]!,
      footprint: footprint(f, m).map(([x, y]) => [r0(x), r0(y)] as Point2),
    };
  });

  // Piers under each module, plus a row along the outer edge of the deck. A benched module bears on its slab, so only its deck stands on piers.
  const piers: Pier[] = [];
  const deckPier = new Set<number>();
  layout.modules.forEach((m, i) => {
    const top = ffl(i) - c.floorDepth;
    const deck = deckSides(m, c);
    const edges = benched ? [] : [-m.width / 2, m.width / 2];
    if (deck[0]) edges.push(-m.width / 2 - deck[0] + c.pier.size / 2);
    if (deck[1]) edges.push(m.width / 2 + deck[1] - c.pier.size / 2);
    for (const [u, v] of pierPoints(c, m.length, edges)) {
      const vv = Math.abs(v) === m.width / 2 ? v - Math.sign(v) * (c.pier.size / 2) : v;
      const at = moduleToSite(f, m, u, vv);
      const g = ground(at);
      // Where grade stands above a benched deck, the bench runs on under it and the deck bears on the ground: no pier.
      if (benched && top - g < 0) continue;
      if (benched) deckPier.add(piers.length);
      piers.push({ id: `${m.id}/pier-${piers.length}`, at: [r0(at[0]), r0(at[1])], ground: r0(g), top: r0(top), height: r0(top - g), module: m.id });
    }
  });

  // Benched pods: the cut under each module, and board-formed concrete retaining walls wherever grade stands above the bench.
  const walls: RetainingWall[] = [];
  let cutVolume = 0, wallArea = 0, maxCut = 0;
  if (benched) {
    const prints = layout.modules.map((m) => footprint(f, m));
    layout.modules.forEach((m, i) => {
      const bench = ffl(i) - c.floorDepth;
      // The bench runs under the module and its deck.
      const [d0, d1] = deckSides(m, c);
      const cuts = under[i]!.map((z) => Math.max(0, z - bench));
      maxCut = Math.max(maxCut, ...cuts);
      cutVolume += (cuts.reduce((a, b) => a + b, 0) / cuts.length) * m.length * (m.width + d0 + d1);
      const t = c.bench.wall;
      for (const [u0, v0, du, dv, len] of [
        [-m.length / 2, -m.width / 2 - t / 2, 1, 0, m.length], [-m.length / 2, m.width / 2 + t / 2, 1, 0, m.length],
        [-m.length / 2 - t / 2, -m.width / 2, 0, 1, m.width], [m.length / 2 + t / 2, -m.width / 2, 0, 1, m.width],
      ] as const) {
        const n = Math.max(2, Math.ceil(len / 500) + 1);
        let lo = Infinity, hi = -Infinity, top = 0, sum = 0, free = 0;
        for (let k = 0; k < n; k++) {
          const s = (len * k) / (n - 1);
          const p = moduleToSite(f, m, u0 + du * s, v0 + dv * s);
          // Where another module adjoins, there is no open face to retain.
          if (prints.some((q, j) => j !== i && insideConvex(q, p, t))) continue;
          const h = Math.max(0, ground(p) - bench);
          free++; sum += h;
          if (h > 50) { lo = Math.min(lo, s); hi = Math.max(hi, s); top = Math.max(top, h); }
        }
        if (!free) continue;
        wallArea += (sum / n) * len;
        if (hi > lo) walls.push({ i, u: u0 + du * (lo + hi) / 2, v: v0 + dv * (lo + hi) / 2, along: du ? 0 : 90, length: hi - lo + t, height: top, base: bench });
      }
    });
  }

  // Steps between adjoining pods.
  const byId = new Map(layout.modules.map((m, i) => [m.id, i] as const));
  const steps = layout.joins
    .map(([a, b]) => ({ a: byId.get(a)!, b: byId.get(b)! }))
    .filter(({ a, b }) => pods[a] !== pods[b])
    .map(({ a, b }) => ({ a, b, rise: Math.abs(ffl(a) - ffl(b)) }))
    .filter((s) => s.rise > 0);

  // Step-free entry: the shortest level bridge from any module edge to where the ground reaches its floor.
  const bridgeMax = RULES['vandelay.assumption.step-free-bridge'].value;
  let bridge: { i: number; u: number; v: number; dir: Point2; length: number } | undefined;
  const blocks = layout.modules.map((m) => footprint(f, m, deckSides(m, c)));
  layout.modules.forEach((m, i) => {
    const floor = ffl(i);
    const deck = deckSides(m, c);
    for (const [u, v, du, dv] of [
      [m.length / 2, 0, 1, 0], [-m.length / 2, 0, -1, 0], [0, m.width / 2 + deck[1], 0, 1], [0, -m.width / 2 - deck[0], 0, -1],
    ] as const) {
      const start = moduleToSite(f, m, u, v);
      const tip = moduleToSite(f, m, u + du, v + dv);
      const dir: Point2 = [tip[0] - start[0], tip[1] - start[1]];
      for (let d = 250; d <= bridgeMax; d += 250) {
        const p: Point2 = [start[0] + dir[0] * d, start[1] + dir[1] * d];
        if (!insideConvex(body.site.boundary, p) || blocks.some((b) => insideConvex(b, p, -1))) break;
        if (ground(p) >= floor - 50) {
          if (!bridge || d < bridge.length) bridge = { i, u, v, dir, length: d };
          break;
        }
      }
    }
  });

  const solids = buildSolids(c, f, layout, ffl, piers, steps, bridge, walls);

  // ── quantities
  const floorArea = layout.modules.reduce((s, m) => s + m.length * m.width, 0);
  const interiorArea = layout.modules.reduce((s, m) => s + (m.length - 2 * c.wall) * (m.width - 2 * c.wall), 0);
  const pierLength = piers.reduce((s, p) => s + Math.max(0, p.height), 0);
  const maxPier = piers.reduce((s, p) => Math.max(s, p.height), 0);
  // A benched deck may sit right on grade, so its piers need no clearance, only to stay out of the ground.
  const minPierHeight = piers.reduce((s, p, k) => (deckPier.has(k) ? s : Math.min(s, p.height)), Infinity);
  const allGround = under.flat();
  const minGround = Math.min(...allGround);
  const meanGround = allGround.reduce((s, g) => s + g, 0) / allGround.length;
  const padEarthwork = layout.modules.reduce((s, m, i) => {
    const g = under[i]!;
    return s + (g.reduce((a, z) => a + Math.abs(z - meanGround), 0) / g.length) * m.length * m.width;
  }, 0);
  const top = Math.max(...layout.modules.map((m, i) => ffl(i) + c.modules[m.kind].height));
  const heightLowest = top - minGround;
  // Greatest height of each module's roof above the existing grade directly below it.
  const heightAbove = Math.max(...layout.modules.map((m, i) => {
    const roof = ffl(i) + c.modules[m.kind].height;
    return Math.max(...groundUnderModule(ctx, f, m).map((g) => roof - g));
  }));
  const heightMethod = body.site.zoning.heightMethod ?? 'lowestGrade';
  const height = heightMethod === 'aboveGrade' ? heightAbove : heightLowest;
  const heightWords = heightMethod === 'aboveGrade' ? 'above the grade directly below it' : 'above the lowest grade under it';
  const moduleCost = layout.modules.reduce((s, m) => s + c.modules[m.kind].costUnits, 0);
  const stairRise = steps.reduce((s, st) => s + st.rise, 0);
  const costIndex =
    (moduleCost + (pierLength / 1000) * c.costPerMetre.pier + ((bridge?.length ?? 0) / 1000) * c.costPerMetre.bridge + (stairRise / 1000) * c.costPerMetre.stair +
      (cutVolume / 1e9) * c.bench.costPerCubicMetre + (wallArea / 1e6) * c.bench.costPerSquareMetre) /
    moduleCost;

  const quantities: Record<string, Traced> = {
    floorArea: traced(floorArea, 'mm2', 'sum of module length × width (gross, outside dimensions)', [`${P}/brief`, `${P}/design/catalog`]),
    interiorArea: traced(interiorArea, 'mm2', 'sum of (module length − 2 walls) × (module width − 2 walls): the interior livable area the ADU size rules check', [`${P}/brief`, `${P}/design/catalog`]),
    moduleCount: traced(layout.modules.length, 'count', 'living + core + one per bedroom + one per extra bathroom', [`${P}/brief/bedrooms`, `${P}/brief/bathrooms`]),
    pierCount: traced(piers.length, 'count', 'both long edges of each module and the deck edge, at or under the catalog spacing', [`${P}/design/catalog`]),
    pierLength: traced(pierLength, 'mm', 'sum of pier heights, ground to floor underside', [`${P}/site/terrain`, `${P}/design/placement`]),
    maxPierHeight: traced(maxPier, 'mm', 'tallest pier, ground to floor underside', [`${P}/site/terrain`, `${P}/design/placement`], ['vandelay.assumption.pier-height']),
    bridgeLength: traced(bridge?.length ?? 0, 'mm', 'shortest level bridge from a floor edge to existing grade (0 = none found)', [`${P}/site/terrain`, `${P}/site/boundary`], ['vandelay.assumption.step-free-bridge']),
    stairCount: traced(steps.length, 'count', 'one stair at each join between pods at different floor levels', [`${P}/design/foundation`]),
    padEarthwork: traced(padEarthwork, 'mm3', 'earth a level pad under the footprint would move (cut + fill at mean grade). Not designed in v0: the home stands on piers', [`${P}/site/terrain`]),
    height: heightMethod === 'aboveGrade'
      ? traced(heightAbove, 'mm', 'greatest height of the roof above the existing grade directly below it (zoning heightMethod: aboveGrade)', [`${P}/site/terrain`, `${P}/site/zoning/heightMethod`], ['vandelay.assumption.height-measurement'])
      : traced(heightLowest, 'mm', 'top of roof minus lowest existing grade under the footprint (zoning heightMethod: lowestGrade, the default)', [`${P}/site/terrain`, `${P}/site/zoning`], ['vandelay.assumption.height-measurement']),
    heightLowestGrade: traced(heightLowest, 'mm', 'top of roof minus lowest existing grade under the footprint', [`${P}/site/terrain`]),
    heightAboveGrade: traced(heightAbove, 'mm', 'greatest height of the roof above the existing grade directly below it', [`${P}/site/terrain`]),
    costIndex: traced(costIndex, 'index', 'relative cost: (module weights + pier, bridge and stair metres, bench cut m³ and retaining wall m² × example weights) ÷ module weights. 1.00 = modules only. Not dollars', [`${P}/design/catalog`]),
    cutVolume: traced(cutVolume, 'mm3', 'earth cut to bench the pods into the slope, under the modules and their decks (0 on piers)', [`${P}/site/terrain`, `${P}/design/foundation`], ['vandelay.assumption.bench-cut']),
    maxCut: traced(maxCut, 'mm', 'deepest cut below existing grade under a benched module or its deck (0 on piers)', [`${P}/site/terrain`, `${P}/design/foundation`], ['vandelay.assumption.bench-cut']),
    retainingWallArea: traced(wallArea, 'mm2', 'face area of retaining wall where grade stands above a bench, open faces only (0 on piers)', [`${P}/site/terrain`, `${P}/design/foundation`]),
  };

  // ── checks
  const checks: CheckResult[] = [];
  const z = body.site.zoning;
  const allPlan: Point2[] = [
    ...layout.modules.flatMap((m) => footprint(f, m, deckSides(m, c))),
    ...piers.map((p) => p.at),
    ...walls.flatMap((w) => {
      const m = layout.modules[w.i]!;
      const [hu, hv] = w.along === 0 ? [w.length / 2, c.bench.wall / 2] : [c.bench.wall / 2, w.length / 2];
      return ([[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]] as const).map(([a, b]) => moduleToSite(f, m, w.u + a, w.v + b));
    }),
  ];
  const margin = ctx.buildable.length >= 3 ? Math.min(...allPlan.map((p) => convexMargin(ctx.buildable, p))) : -Infinity;
  checks.push(
    ctx.buildable.length < 3
      ? { ruleId: 'vandelay.zoning.setbacks', status: 'fail', message: 'The setbacks leave no buildable area on this lot.' }
      : {
          ruleId: 'vandelay.zoning.setbacks',
          status: margin >= -0.5 ? 'pass' : 'fail',
          measured: traced(margin, 'mm', 'smallest distance from any module, deck or pier corner to the setback line (negative = over the line)', [`${P}/site/zoning/setbacks`, `${P}/design/placement`], ['vandelay.zoning.setbacks']),
          limit: 0,
          message: margin >= -0.5 ? 'Everything sits inside the setbacks.' : `Part of the home is ${Math.round(-margin)} mm over a setback line.`,
        },
  );
  checks.push(
    z.maxHeight === undefined
      ? { ruleId: 'vandelay.assumption.height-measurement', status: 'n/a', message: 'No height limit in the intent.' }
      : {
          ruleId: 'vandelay.assumption.height-measurement',
          status: height <= z.maxHeight ? 'pass' : 'fail',
          measured: quantities.height!, limit: z.maxHeight,
          message: `Roof is ${Math.round(height)} mm ${heightWords}; the limit is ${z.maxHeight} mm.`,
        },
  );
  const coverage = floorArea / ctx.lotArea;
  checks.push(
    z.maxCoverage === undefined
      ? { ruleId: 'vandelay.zoning.coverage', status: 'n/a', message: 'No coverage limit in the intent.' }
      : {
          ruleId: 'vandelay.zoning.coverage',
          status: coverage <= z.maxCoverage ? 'pass' : 'fail',
          measured: traced(coverage, 'ratio', 'module footprint area ÷ lot area (decks not counted)', [`${P}/site/boundary`, `${P}/brief`], ['vandelay.zoning.coverage']),
          limit: z.maxCoverage,
          message: `Covers ${(coverage * 100).toFixed(1)}% of the lot; the limit is ${(z.maxCoverage * 100).toFixed(0)}%.`,
        },
  );
  const area = body.brief.area;
  const tol = RULES['vandelay.program.area'].value;
  if (area.target === undefined && area.min === undefined && area.max === undefined) {
    checks.push({ ruleId: 'vandelay.program.area', status: 'n/a', message: 'The brief gives no floor area.' });
  } else {
    const lo = Math.max(area.min ?? 0, area.target !== undefined ? area.target * (1 - tol) : 0);
    const hi = Math.min(area.max ?? Infinity, area.target !== undefined ? area.target * (1 + tol) : Infinity);
    const ok = floorArea >= lo && floorArea <= hi;
    checks.push({
      ruleId: 'vandelay.program.area', status: ok ? 'pass' : 'warn', measured: quantities.floorArea!,
      message: `${(floorArea / 1e6).toFixed(0)} m² of modules${area.target !== undefined ? ` against a ${(area.target / 1e6).toFixed(0)} m² target` : ''}${ok ? '.' : ': outside the brief, so the rooms need adjusting.'}`,
    });
  }
  const pierLimit = RULES['vandelay.assumption.pier-height'].value;
  checks.push({
    ruleId: 'vandelay.assumption.pier-height', status: maxPier <= pierLimit ? 'pass' : 'fail', measured: quantities.maxPierHeight!, limit: pierLimit,
    message: `Tallest pier is ${Math.round(maxPier)} mm; the assumed limit is ${pierLimit} mm.`,
  });
  checks.push(
    benched
      ? { ruleId: 'vandelay.assumption.floor-clearance', status: 'pass', message: 'The floors bear on slabs on the bench; no floor stands over open ground.' }
      : {
          ruleId: 'vandelay.assumption.floor-clearance', status: minPierHeight >= clear - 0.5 ? 'pass' : 'fail',
          measured: traced(minPierHeight, 'mm', 'smallest gap between floor underside and grade', [`${P}/site/terrain`, `${P}/design/levels/floorDatum`], ['vandelay.assumption.floor-clearance']),
          limit: clear,
          message: minPierHeight >= clear - 0.5 ? 'The floor clears the ground everywhere.' : `The floor is only ${Math.round(minPierHeight)} mm above the ground in places.`,
        },
  );
  const cutLimit = RULES['vandelay.assumption.bench-cut'].value;
  checks.push(
    !benched
      ? { ruleId: 'vandelay.assumption.bench-cut', status: 'n/a', message: 'The home stands on piers, with no cut.' }
      : {
          ruleId: 'vandelay.assumption.bench-cut', status: maxCut <= cutLimit + 0.5 ? 'pass' : 'fail', measured: quantities.maxCut!, limit: cutLimit,
          message: `The deepest cut is ${(maxCut / 1000).toFixed(1)} m, with ${(wallArea / 1e6).toFixed(0)} m² of retaining wall; the assumed limit is ${(cutLimit / 1000).toFixed(1)} m.`,
        },
  );
  const maxRise = steps.reduce((s, st) => Math.max(s, st.rise), 0);
  checks.push(
    podIds.length < 2
      ? { ruleId: 'vandelay.assumption.pod-step', status: 'n/a', message: 'The whole home is on one floor level.' }
      : {
          ruleId: 'vandelay.assumption.pod-step', status: maxRise <= maxStep ? 'pass' : 'fail',
          measured: traced(maxRise, 'mm', 'largest floor step between adjoining pods', [`${P}/design/levels/maxStep`, `${P}/site/terrain`], ['vandelay.assumption.pod-step']),
          limit: maxStep,
          message: steps.length ? `${steps.length} stair${steps.length > 1 ? 's' : ''} between levels; the largest step is ${Math.round(maxRise)} mm.` : 'The pods land at the same level.',
        },
  );
  checks.push(
    !body.brief.stepFreeEntry
      ? { ruleId: 'vandelay.assumption.step-free-bridge', status: 'n/a', message: 'The brief does not ask for step-free entry.' }
      : bridge
        ? { ruleId: 'vandelay.assumption.step-free-bridge', status: 'pass', measured: quantities.bridgeLength!, limit: bridgeMax, message: `A ${(bridge.length / 1000).toFixed(1)} m level bridge reaches the ground from the entry floor.` }
        : { ruleId: 'vandelay.assumption.step-free-bridge', status: 'warn', limit: bridgeMax, message: 'No short level bridge reaches the ground; step-free entry would need a ramp or a lift.' },
  );
  const facts = deriveFacts(intent, c, modules, quantities.height!, ctx.lotArea);
  const juris = jurisdictionChecks(intent, facts, ctx.lotArea, solids, ground);
  checks.push(...juris.checks);
  if (benched) checks.push({ ruleId: 'vandelay.review.grading', status: 'review', message: RULES['vandelay.review.grading'].statement });
  checks.push({ ruleId: 'vandelay.review.structure', status: 'review', message: RULES['vandelay.review.structure'].statement });
  checks.push({ ruleId: 'vandelay.review.delivery', status: 'review', message: RULES['vandelay.review.delivery'].statement });

  // ── scores (0..1)
  const living = layout.modules.find((m) => m.kind === 'living')!;
  const glassDir = (() => {
    const a = moduleToSite(f, living, 0, 0), b = moduleToSite(f, living, 0, living.glassSide);
    return vecToBearing([b[0] - a[0], b[1] - a[1]]);
  })();
  const facing = (bearing: number) => (1 + Math.cos((bearingDelta(glassDir, bearing) * Math.PI) / 180)) / 2;
  const scores: Partial<Record<ScoreId, Traced>> = {};
  const view = body.site.view;
  if (view) scores.view = traced(facing(view.bearing), 'score', '(1 + cos(angle between the living glass and the view)) ÷ 2', [`${P}/site/view/bearing`, `${P}/design/placement/rotation`]);
  const geo = body.site.geo;
  if (geo) scores.sun = traced(facing(geo.lat >= 0 ? 180 : 0), 'score', '(1 + cos(angle between the living glass and the equator-facing bearing)) ÷ 2', [`${P}/site/geo/lat`, `${P}/design/placement/rotation`]);
  const fe = body.site.frontEdge;
  const fa = body.site.boundary[fe]!, fn = edgeNormal(body.site.boundary, fe);
  const livingCtr = toSite(f, [living.cx, living.cy]);
  const streetDist = -((livingCtr[0] - fa[0]) * fn[0] + (livingCtr[1] - fa[1]) * fn[1]);
  scores.privacy = traced(clamp01(streetDist / 15000), 'score', 'distance from the living module to the street edge ÷ 15 m, capped at 1', [`${P}/site/frontEdge`, `${P}/design/placement/anchor`]);
  const meanPier = piers.length ? pierLength / piers.length : 0;
  scores.lessGrading = traced(clamp01(1 - meanPier / pierLimit - cutVolume / floorArea / cutLimit), 'score', '1 − mean pier height ÷ pier height limit − mean bench cut depth ÷ cut limit (lighter touch on the ground scores higher)', [`${P}/site/terrain`, `${P}/design/foundation`], ['vandelay.assumption.pier-height', 'vandelay.assumption.bench-cut']);
  scores.cost = traced(clamp01(2 - costIndex), 'score', '2 − relative cost index, clamped to 0..1', [`${P}/design/catalog`]);
  if (body.brief.stepFreeEntry) {
    scores.access = traced(bridge ? 1 : 0, 'score', '1 when a short level bridge gives step-free entry, else 0', [`${P}/brief/stepFreeEntry`, `${P}/site/terrain`], ['vandelay.assumption.step-free-bridge']);
  }

  // Fast-track (ministerial) approval matters a lot for an ADU: it saves months. Score it when the rules ran.
  const fastTrack = checks.find((ch) => ch.ruleId === 'us-ca.adu.path.ministerial-detached');
  if (fastTrack && fastTrack.status !== 'n/a') {
    scores.approval = traced(fastTrack.status === 'pass' ? 1 : fastTrack.status === 'review' ? 0.5 : 0, 'score', '1 when the design qualifies for fast-track (ministerial) ADU approval, 0.5 when that needs review, else 0', [`${P}/brief/use`, `${P}/site/jurisdiction`], [fastTrack.ruleId]);
  }

  const weights = body.brief.priorities;
  const ids = (Object.keys(scores) as ScoreId[]).filter((k) => k !== 'overall');
  const fixedWeight: Partial<Record<ScoreId, number>> = { access: 0.5, approval: 0.5 };
  const anyWeight = ids.some((k) => fixedWeight[k] === undefined && (weights[k as keyof typeof weights] ?? 0) > 0);
  let wsum = 0, ssum = 0;
  for (const k of ids) {
    // Step-free entry and fast-track approval are requirements, not priority weights: each counts half when it applies.
    const w = fixedWeight[k] ?? (anyWeight ? (weights[k as keyof typeof weights] ?? 0) : 1);
    wsum += w; ssum += w * scores[k]!.value;
  }
  scores.overall = traced(wsum ? ssum / wsum : 0, 'score', 'weighted mean of the scores, weighted by the brief priorities (equal weights when none are set); step-free access and fast-track ADU approval count 0.5 each when they apply', [`${P}/brief/priorities`, `${P}/brief/stepFreeEntry`, `${P}/brief/use`]);

  return {
    ok: true,
    intentHash: hashIntent(intent),
    engine: { id: 'home', version: ENGINE_VERSION },
    resolved: {
      parti: choice.parti, anchor: [r0(choice.anchor[0]), r0(choice.anchor[1])], rotation: r4(choice.rotation), foundation: choice.foundation,
      floorDatums: podIds.map((p) => r0(datum.get(p)!)), maxStep,
    },
    modules,
    piers,
    geometry: {
      site: { boundary: body.site.boundary, terrain: body.site.terrain, buildable: ctx.buildable.map(([x, y]) => [r0(x), r0(y)] as Point2) },
      solids,
    },
    quantities,
    checks,
    scores,
    ...(juris.report ? { rules: juris.report } : {}),
    feasible: !checks.some((ch) => ch.status === 'fail'),
  };
};

/** Evaluates one Home intent, resolving any 'auto' fields with simple defaults (no search). `evaluate` in options.ts searches instead. */
export const evaluateWithDefaults = (intent: HomeIntent): HomeResult | HomeError => {
  const ctx = siteContext(intent);
  if ('ok' in ctx) return ctx;
  return evaluateChoice(ctx, defaultChoice(ctx));
};

// ── solids ───────────────────────────────────────────────────────────────────

const buildSolids = (
  c: Catalog,
  f: Frame,
  layout: LocalLayout,
  ffl: (i: number) => number,
  piers: readonly Pier[],
  steps: readonly { a: number; b: number; rise: number }[],
  bridge: { i: number; u: number; v: number; dir: Point2; length: number } | undefined,
  walls: readonly RetainingWall[] = [],
): Solid[] => {
  const solids: Solid[] = [];
  const box = (
    id: string, role: Solid['role'], material: Solid['material'], m: LocalModule,
    u: number, v: number, z0: number, du: number, dv: number, dz: number, extra: Partial<Solid> = {},
  ) => {
    const p = moduleToSite(f, m, u, v);
    solids.push({
      id, role, material, module: m.id,
      center: [r0(p[0]), r0(p[1]), r0(z0 + dz / 2)], size: [r0(du), r0(dv), r0(dz)], rotation: r4(f.rotation + m.rot), ...extra,
    });
  };

  layout.modules.forEach((m, i) => {
    const spec = c.modules[m.kind];
    const floor = ffl(i);
    const L = m.length, W = m.width, t = c.wall;
    const wallH = spec.height - c.roof.thickness;
    const clad = m.kind === 'core' ? 'corten' : 'timber';
    const gs = m.glassSide;

    box(`${m.id}/floor`, 'module', 'blackSteel', m, 0, 0, floor - c.floorDepth, L, W, c.floorDepth);
    // Solid long side and the two ends.
    box(`${m.id}/wall-back`, 'wall', clad, m, 0, -gs * (W / 2 - t / 2), floor, L, t, wallH);
    box(`${m.id}/wall-end-a`, 'wall', clad, m, -L / 2 + t / 2, 0, floor, t, W - 2 * t, wallH);
    box(`${m.id}/wall-end-b`, 'wall', clad, m, L / 2 - t / 2, 0, floor, t, W - 2 * t, wallH);
    // Glass side: a centred band of glass with cladding either side.
    const gl = (L - 2 * t) * spec.glazing;
    const solidEach = (L - 2 * t - gl) / 2;
    const vg = gs * (W / 2 - t / 2);
    box(`${m.id}/glass`, 'glazing', 'glass', m, 0, vg, floor, gl, 30, wallH);
    if (solidEach > 1) {
      box(`${m.id}/wall-glass-a`, 'wall', clad, m, -L / 2 + t + solidEach / 2, vg, floor, solidEach, t, wallH);
      box(`${m.id}/wall-glass-b`, 'wall', clad, m, L / 2 - t - solidEach / 2, vg, floor, solidEach, t, wallH);
    }
    // Roof: a thin steel plate with a deep overhang over the glass.
    const ro = c.roof;
    const vMin = gs === 1 ? -W / 2 - ro.overhangOther : -W / 2 - ro.overhangGlass;
    const vMax = gs === 1 ? W / 2 + ro.overhangGlass : W / 2 + ro.overhangOther;
    box(`${m.id}/roof`, 'roof', 'blackSteel', m, 0, (vMin + vMax) / 2, floor + wallH, L + 2 * ro.overhangOther, vMax - vMin, ro.thickness);

    if (m.kind === 'living') {
      // Deck on the glass side, and a weathering-steel shutter that slides along it.
      const vd = gs * (W / 2 + c.deck.depth / 2);
      box(`${m.id}/deck`, 'deck', 'timber', m, 0, vd, floor - 150, L, c.deck.depth, 150);
      const sl = gl * 0.45;
      const axis = rotate2(rotate2([1, 0], m.rot), f.rotation);
      box(`${m.id}/shutter`, 'shutter', 'corten', m, -gl / 2 + sl / 2, gs * (W / 2 + 120), floor, sl, 40, wallH - 100, {
        mechanism: { kind: 'slide', axis: [r4(axis[0]), r4(axis[1])], travel: r0(gl - sl) },
      });
    }
  });

  // Board-formed concrete retaining walls holding the slope back from benched modules.
  walls.forEach((w, k) => {
    const m = layout.modules[w.i]!;
    const [du, dv] = w.along === 0 ? [w.length, c.bench.wall] : [c.bench.wall, w.length];
    box(`${m.id}/retaining-${k}`, 'plinth', 'concrete', m, w.u, w.v, w.base - c.floorDepth, du, dv, w.height + c.floorDepth);
  });

  for (const p of piers) {
    solids.push({ id: p.id, role: 'pier', material: 'concrete', module: p.module, center: [p.at[0], p.at[1], r0(p.ground + p.height / 2)], size: [c.pier.size, c.pier.size, Math.max(0, p.height)], rotation: r4(f.rotation) });
  }

  steps.forEach((s, k) => {
    const A = layout.modules[s.a]!, B = layout.modules[s.b]!;
    const lower = ffl(s.a) < ffl(s.b) ? A : B;
    const lowFloor = Math.min(ffl(s.a), ffl(s.b));
    // Midpoint of the shared wall, in the parti frame.
    const ext = (m: LocalModule) => {
      const hx = (m.rot === 0 ? m.length : m.width) / 2, hy = (m.rot === 0 ? m.width : m.length) / 2;
      return [m.cx - hx, m.cy - hy, m.cx + hx, m.cy + hy] as const;
    };
    const ea = ext(A), eb = ext(B);
    const mid: Point2 = [(Math.max(ea[0], eb[0]) + Math.min(ea[2], eb[2])) / 2, (Math.max(ea[1], eb[1]) + Math.min(ea[3], eb[3])) / 2];
    const p = toSite(f, mid);
    const run = Math.ceil(s.rise / 180) * 280;
    solids.push({ id: `stair-${k}`, role: 'stair', material: 'blackSteel', module: lower.id, center: [r0(p[0]), r0(p[1]), r0(lowFloor + s.rise / 2)], size: [r0(run), 1000, r0(s.rise)], rotation: r4(f.rotation + lower.rot) });
  });

  if (bridge) {
    const m = layout.modules[bridge.i]!;
    const start = moduleToSite(f, m, bridge.u, bridge.v);
    const ctr: Point2 = [start[0] + (bridge.dir[0] * bridge.length) / 2, start[1] + (bridge.dir[1] * bridge.length) / 2];
    const rot = (Math.atan2(bridge.dir[1], bridge.dir[0]) * 180) / Math.PI;
    solids.push({ id: 'bridge', role: 'bridge', material: 'blackSteel', module: m.id, center: [r0(ctr[0]), r0(ctr[1]), r0(ffl(bridge.i) - 100)], size: [r0(bridge.length), 1500, 200], rotation: r4(rot) });
  }
  return solids;
};

