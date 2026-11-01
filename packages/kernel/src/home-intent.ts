/**
 * Intent schema v0 for the Home category.
 *
 * Intent holds only decisions: the site as given, the brief as asked, and a
 * few design choices. Everything else (module positions, pier heights, areas,
 * scores) is derived by the Home engine and never written back here.
 *
 * Units and frame: lengths in mm, areas in mm², angles in degrees. The site
 * frame is +X east, +Y north, +Z up; Z is elevation above `site.datum`.
 *
 * `'auto'` means "engine, choose this". The engine reports what it chose in
 * its result; to lock a value, set it explicitly.
 */
import { CATEGORIES, createIntent, INTENT_SCHEMA, INTENT_SCHEMA_VERSION, type IntentEnvelope, type ParseResult } from './intent.ts';
import { hasPointer, joinPointer, type JsonPointer } from './pointer.ts';

/** Plain numbers in intent JSON, documented by unit. */
export type MmValue = number;
export type Mm2Value = number;
export type Deg = number;
export type Point2 = readonly [x: MmValue, y: MmValue];

export type Terrain =
  /** A tilted plane: `slopePct` rise per 100 run, falling toward `aspect` (compass bearing, 0 = north, 90 = east). */
  | { readonly kind: 'plane'; readonly z0: MmValue; readonly slopePct: number; readonly aspect: Deg }
  /** Regular height grid, row-major from `origin` (+X along a row, +Y between rows). */
  | {
      readonly kind: 'grid';
      readonly origin: Point2;
      readonly spacing: MmValue;
      readonly nx: number;
      readonly ny: number;
      readonly z: readonly MmValue[];
    };

export interface SiteIntent {
  /** What Z = 0 means, e.g. "survey benchmark" or "example site datum". */
  readonly datum: string;
  /** Closed polygon, counter-clockwise, no repeated last point. Convex in v0. */
  readonly boundary: readonly Point2[];
  /** Index of the street edge (from vertex i to i+1); sets which setback is the front. */
  readonly frontEdge: number;
  readonly terrain: Terrain;
  readonly zoning: {
    readonly setbacks: { readonly front: MmValue; readonly side: MmValue; readonly rear: MmValue };
    readonly maxHeight?: MmValue;
    /** Fraction of lot area, 0..1. */
    readonly maxCoverage?: number;
  };
  /** Where the path or driveway meets the lot. */
  readonly access?: { readonly point: Point2 };
  /** Direction the owner wants to face (compass bearing). */
  readonly view?: { readonly bearing: Deg };
  /** For sun studies only; never moves geometry. */
  readonly geo?: { readonly lat: number; readonly lon: number };
}

export const PRIORITIES = ['view', 'sun', 'privacy', 'cost', 'lessGrading'] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Brief {
  /** The person's own words, kept verbatim. */
  readonly prompt: string;
  readonly bedrooms: number;
  /** Halves allowed (1.5 = one full bath and one half bath). */
  readonly bathrooms: number;
  readonly area: { readonly min?: Mm2Value; readonly target?: Mm2Value; readonly max?: Mm2Value };
  readonly maxStories: 1 | 2;
  readonly stepFreeEntry: boolean;
  readonly parking?: 0 | 1 | 2;
  /** Weights 0..1. Missing = 0. */
  readonly priorities: Partial<Record<Priority, number>>;
}

export const PARTIS = ['bar', 'L', 'courtyard', 'steppedBar'] as const;
export type Parti = (typeof PARTIS)[number];

export const FOUNDATIONS = ['auto', 'piers', 'steppedPods'] as const;
export type FoundationChoice = (typeof FOUNDATIONS)[number];

export interface HomeDesign {
  readonly catalog: { readonly id: string; readonly version: string };
  readonly parti: Parti;
  readonly placement: {
    /** Centre of the parti in site coordinates. */
    readonly anchor: Point2 | 'auto';
    /** About +Z, counter-clockwise from +X. */
    readonly rotation: Deg | 'auto';
  };
  readonly foundation: FoundationChoice;
  readonly levels: { readonly maxStep: MmValue | 'auto'; readonly floorDatum: MmValue | 'auto' };
}

export const SOURCE_KINDS = ['user', 'agent', 'default', 'lookup', 'example'] as const;
export interface Source {
  readonly by: (typeof SOURCE_KINDS)[number];
  readonly note?: string;
  readonly ruleId?: string;
}

export interface HomeBody {
  /** Stable id across edits. */
  readonly id: string;
  /** Integer seed for option search. The only source of variation. */
  readonly seed: number;
  readonly site: SiteIntent;
  readonly brief: Brief;
  readonly design: HomeDesign;
  /** Who set each field, keyed by JSON Pointer into this intent (e.g. "/body/site/zoning/setbacks"). */
  readonly sources: Readonly<Record<JsonPointer, Source>>;
}

export type HomeIntent = IntentEnvelope<HomeBody> & { readonly category: 'home' };

export const createHomeIntent = (body: HomeBody): HomeIntent => createIntent('home', body) as HomeIntent;

// ── validation ───────────────────────────────────────────────────────────────

export interface Issue {
  readonly path: JsonPointer;
  readonly message: string;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

class Checker {
  readonly issues: Issue[] = [];
  fail(path: JsonPointer, message: string): false {
    this.issues.push({ path, message });
    return false;
  }
  obj(v: unknown, path: JsonPointer): v is Obj {
    return isObj(v) || this.fail(path, 'must be an object');
  }
  num(v: unknown, path: JsonPointer, opts: { min?: number; max?: number; int?: boolean; gt?: number } = {}): v is number {
    if (!isNum(v)) return this.fail(path, 'must be a finite number');
    if (opts.int && !Number.isInteger(v)) return this.fail(path, 'must be an integer');
    if (opts.min !== undefined && v < opts.min) return this.fail(path, `must be ≥ ${opts.min}`);
    if (opts.gt !== undefined && v <= opts.gt) return this.fail(path, `must be > ${opts.gt}`);
    if (opts.max !== undefined && v > opts.max) return this.fail(path, `must be ≤ ${opts.max}`);
    return true;
  }
  str(v: unknown, path: JsonPointer, nonEmpty = true): v is string {
    if (typeof v !== 'string') return this.fail(path, 'must be a string');
    if (nonEmpty && v.trim() === '') return this.fail(path, 'must not be empty');
    return true;
  }
  oneOf<T extends string | number>(v: unknown, options: readonly T[], path: JsonPointer): v is T {
    return options.includes(v as T) || this.fail(path, `must be one of ${options.map((o) => JSON.stringify(o)).join(', ')}`);
  }
  point(v: unknown, path: JsonPointer): v is Point2 {
    if (!Array.isArray(v) || v.length !== 2) return this.fail(path, 'must be [x, y] in mm');
    return this.num(v[0], joinPointer(path, 0)) && this.num(v[1], joinPointer(path, 1));
  }
  /** Rejects keys the schema does not define, so typos never pass silently. */
  keys(v: Obj, allowed: readonly string[], path: JsonPointer): void {
    for (const k of Object.keys(v)) if (!allowed.includes(k)) this.fail(joinPointer(path, k), 'unknown field');
  }
}

/** Twice the signed area of a polygon (positive = counter-clockwise). */
export const signedArea2 = (pts: readonly Point2[]): number => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s;
};

const isStrictlyConvexCCW = (pts: readonly Point2[]): boolean => {
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!, c = pts[(i + 2) % pts.length]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross <= 0) return false;
  }
  return true;
};

const checkSite = (c: Checker, s: unknown, p: JsonPointer): void => {
  if (!c.obj(s, p)) return;
  c.keys(s, ['datum', 'boundary', 'frontEdge', 'terrain', 'zoning', 'access', 'view', 'geo'], p);
  c.str(s.datum, `${p}/datum`);

  const bp = `${p}/boundary`;
  let n = 0;
  if (!Array.isArray(s.boundary) || s.boundary.length < 3) {
    c.fail(bp, 'must be a polygon of at least 3 points');
  } else {
    n = s.boundary.length;
    const ok = s.boundary.every((pt, i) => c.point(pt, joinPointer(bp, i)));
    if (ok) {
      const pts = s.boundary as Point2[];
      if (signedArea2(pts) <= 0) c.fail(bp, 'must be counter-clockwise (positive area)');
      else if (!isStrictlyConvexCCW(pts)) c.fail(bp, 'must be convex in v0, with no repeated or collinear points');
    }
  }
  if (c.num(s.frontEdge, `${p}/frontEdge`, { int: true, min: 0 }) && n > 0 && s.frontEdge >= n) {
    c.fail(`${p}/frontEdge`, `must index an edge (0..${n - 1})`);
  }

  const tp = `${p}/terrain`;
  const t = s.terrain;
  if (c.obj(t, tp)) {
    if (t.kind === 'plane') {
      c.keys(t, ['kind', 'z0', 'slopePct', 'aspect'], tp);
      c.num(t.z0, `${tp}/z0`);
      c.num(t.slopePct, `${tp}/slopePct`, { min: 0, max: 100 });
      c.num(t.aspect, `${tp}/aspect`, { min: 0, max: 360 });
    } else if (t.kind === 'grid') {
      c.keys(t, ['kind', 'origin', 'spacing', 'nx', 'ny', 'z'], tp);
      c.point(t.origin, `${tp}/origin`);
      c.num(t.spacing, `${tp}/spacing`, { gt: 0 });
      const nxOk = c.num(t.nx, `${tp}/nx`, { int: true, min: 2 });
      const nyOk = c.num(t.ny, `${tp}/ny`, { int: true, min: 2 });
      if (!Array.isArray(t.z)) c.fail(`${tp}/z`, 'must be an array of heights in mm');
      else {
        if (nxOk && nyOk && t.z.length !== (t.nx as number) * (t.ny as number)) c.fail(`${tp}/z`, 'must have nx × ny heights');
        const bad = t.z.findIndex((z) => !isNum(z));
        if (bad >= 0) c.fail(joinPointer(`${tp}/z`, bad), 'must be a finite number');
      }
    } else {
      c.fail(`${tp}/kind`, 'must be "plane" or "grid"');
    }
  }

  const zp = `${p}/zoning`;
  if (c.obj(s.zoning, zp)) {
    const z = s.zoning;
    c.keys(z, ['setbacks', 'maxHeight', 'maxCoverage'], zp);
    if (c.obj(z.setbacks, `${zp}/setbacks`)) {
      c.keys(z.setbacks, ['front', 'side', 'rear'], `${zp}/setbacks`);
      for (const k of ['front', 'side', 'rear']) c.num(z.setbacks[k], `${zp}/setbacks/${k}`, { min: 0 });
    }
    if (z.maxHeight !== undefined) c.num(z.maxHeight, `${zp}/maxHeight`, { gt: 0 });
    if (z.maxCoverage !== undefined) c.num(z.maxCoverage, `${zp}/maxCoverage`, { gt: 0, max: 1 });
  }

  if (s.access !== undefined && c.obj(s.access, `${p}/access`)) {
    c.keys(s.access, ['point'], `${p}/access`);
    c.point(s.access.point, `${p}/access/point`);
  }
  if (s.view !== undefined && c.obj(s.view, `${p}/view`)) {
    c.keys(s.view, ['bearing'], `${p}/view`);
    c.num(s.view.bearing, `${p}/view/bearing`, { min: 0, max: 360 });
  }
  if (s.geo !== undefined && c.obj(s.geo, `${p}/geo`)) {
    c.keys(s.geo, ['lat', 'lon'], `${p}/geo`);
    c.num(s.geo.lat, `${p}/geo/lat`, { min: -90, max: 90 });
    c.num(s.geo.lon, `${p}/geo/lon`, { min: -180, max: 180 });
  }
};

const checkBrief = (c: Checker, b: unknown, p: JsonPointer): void => {
  if (!c.obj(b, p)) return;
  c.keys(b, ['prompt', 'bedrooms', 'bathrooms', 'area', 'maxStories', 'stepFreeEntry', 'parking', 'priorities'], p);
  c.str(b.prompt, `${p}/prompt`, false);
  c.num(b.bedrooms, `${p}/bedrooms`, { int: true, min: 0, max: 8 });
  if (c.num(b.bathrooms, `${p}/bathrooms`, { min: 1, max: 8 }) && !Number.isInteger(b.bathrooms * 2)) {
    c.fail(`${p}/bathrooms`, 'must be a whole or half number');
  }
  const ap = `${p}/area`;
  if (c.obj(b.area, ap)) {
    c.keys(b.area, ['min', 'target', 'max'], ap);
    const vals: [string, number][] = [];
    for (const k of ['min', 'target', 'max']) {
      const v = b.area[k];
      if (v !== undefined && c.num(v, `${ap}/${k}`, { gt: 0 })) vals.push([k, v]);
    }
    for (let i = 1; i < vals.length; i++) {
      if (vals[i]![1] < vals[i - 1]![1]) c.fail(ap, 'must satisfy min ≤ target ≤ max');
    }
  }
  c.oneOf(b.maxStories, [1, 2] as const, `${p}/maxStories`);
  if (typeof b.stepFreeEntry !== 'boolean') c.fail(`${p}/stepFreeEntry`, 'must be true or false');
  if (b.parking !== undefined) c.oneOf(b.parking, [0, 1, 2] as const, `${p}/parking`);
  const pp = `${p}/priorities`;
  if (c.obj(b.priorities, pp)) {
    c.keys(b.priorities, PRIORITIES, pp);
    for (const [k, v] of Object.entries(b.priorities)) if (PRIORITIES.includes(k as Priority)) c.num(v, `${pp}/${k}`, { min: 0, max: 1 });
  }
};

const checkDesign = (c: Checker, d: unknown, p: JsonPointer): void => {
  if (!c.obj(d, p)) return;
  c.keys(d, ['catalog', 'parti', 'placement', 'foundation', 'levels'], p);
  if (c.obj(d.catalog, `${p}/catalog`)) {
    c.keys(d.catalog, ['id', 'version'], `${p}/catalog`);
    c.str(d.catalog.id, `${p}/catalog/id`);
    c.str(d.catalog.version, `${p}/catalog/version`);
  }
  c.oneOf(d.parti, PARTIS, `${p}/parti`);
  const pl = `${p}/placement`;
  if (c.obj(d.placement, pl)) {
    c.keys(d.placement, ['anchor', 'rotation'], pl);
    if (d.placement.anchor !== 'auto') c.point(d.placement.anchor, `${pl}/anchor`);
    if (d.placement.rotation !== 'auto') c.num(d.placement.rotation, `${pl}/rotation`, { min: -360, max: 360 });
  }
  c.oneOf(d.foundation, FOUNDATIONS, `${p}/foundation`);
  const lv = `${p}/levels`;
  if (c.obj(d.levels, lv)) {
    c.keys(d.levels, ['maxStep', 'floorDatum'], lv);
    if (d.levels.maxStep !== 'auto') c.num(d.levels.maxStep, `${lv}/maxStep`, { min: 0 });
    if (d.levels.floorDatum !== 'auto') c.num(d.levels.floorDatum, `${lv}/floorDatum`);
  }
};

/** Validates a whole Home intent and returns every issue found, each with its JSON Pointer. */
export const validateHomeIntent = (doc: unknown): Issue[] => {
  const c = new Checker();
  if (!c.obj(doc, '')) return c.issues;
  c.keys(doc, ['schema', 'version', 'units', 'up', 'category', 'body'], '');
  if (doc.schema !== INTENT_SCHEMA) c.fail('/schema', `must be "${INTENT_SCHEMA}"`);
  if (doc.version !== INTENT_SCHEMA_VERSION) c.fail('/version', `must be "${INTENT_SCHEMA_VERSION}" (v0 has no migrations yet)`);
  if (doc.units !== 'mm') c.fail('/units', 'must be "mm"');
  if (doc.up !== 'z') c.fail('/up', 'must be "z"');
  if (!CATEGORIES.includes(doc.category as never)) c.fail('/category', 'unknown category');
  else if (doc.category !== 'home') c.fail('/category', 'must be "home" for a Home intent');

  const body = doc.body;
  if (!c.obj(body, '/body')) return c.issues;
  c.keys(body, ['id', 'seed', 'site', 'brief', 'design', 'sources'], '/body');
  c.str(body.id, '/body/id');
  c.num(body.seed, '/body/seed', { int: true, min: 0, max: 0xffffffff });
  checkSite(c, body.site, '/body/site');
  checkBrief(c, body.brief, '/body/brief');
  checkDesign(c, body.design, '/body/design');

  if (c.obj(body.sources, '/body/sources')) {
    for (const [ptr, src] of Object.entries(body.sources)) {
      const sp = joinPointer('/body/sources', ptr);
      if (!hasPointer(doc, ptr)) c.fail(sp, 'must be a JSON Pointer to a field in this intent');
      if (c.obj(src, sp)) {
        c.keys(src, ['by', 'note', 'ruleId'], sp);
        c.oneOf(src.by, SOURCE_KINDS, `${sp}/by`);
        if (src.note !== undefined) c.str(src.note, `${sp}/note`);
        if (src.ruleId !== undefined) c.str(src.ruleId, `${sp}/ruleId`);
      }
    }
  }
  return c.issues;
};

export const isHomeIntent = (doc: unknown): doc is HomeIntent => validateHomeIntent(doc).length === 0;

/** Parses and validates Home intent JSON. Errors list every failing path. */
export const parseHomeIntent = (json: string): ParseResult<HomeIntent> & { issues?: Issue[] } => {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not valid JSON', issues: [{ path: '', message: 'not valid JSON' }] };
  }
  const issues = validateHomeIntent(data);
  if (issues.length) return { ok: false, error: issues.map((i) => `${i.path || '/'}: ${i.message}`).join('; '), issues };
  return { ok: true, value: data as HomeIntent };
};
