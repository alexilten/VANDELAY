/**
 * Runs the cited rules library (packages/kernel/src/rules) on a solved Home
 * design. The engine derives the facts the rules read (areas, height,
 * clearances to each lot line) from its own geometry, so each rule result can
 * say both where the limit comes from (its citations) and how the measured
 * value was computed (its trace).
 */
import {
  CA_MAX_SIDE_REAR_SETBACK, edgeNormal, regionLookup, rotate2, runRules, US_CA,
  type AduInput, type GroundSampler, type CheckResult as RuleCheck, type HomeIntent, type Point2, type Region, type RuleReport,
} from '@vandelay/kernel';
import type { Catalog } from './catalog.ts';
import type { CheckResult, PlacedModule, Solid, Traced } from './types.ts';

const REGIONS: readonly Region<AduInput>[] = [US_CA];
const lookup = regionLookup(REGIONS);

/** Readings the engine makes when it turns its model into rule facts. Shown with every ADU result they touch. */
export const ENGINE_INTERPRETATIONS = {
  livable: 'Interior livable space is taken as each module’s floor inside its walls (Vandelay reading; the catalog does not yet separate unconditioned space).',
  height: 'Height is measured from the lowest existing grade under the footprint to the top of the roof (the default, conservative method; the local code sets the method, and the intent can choose aboveGrade instead).',
  heightAbove: 'Height is measured as the greatest height of the roof above the existing grade directly below it, as the intent\'s zoning says the local code does (verify against the local code).',
  clearance: 'Clearances are measured from the module walls to each lot line; the deck, bridge and roof eaves are not counted (Vandelay reading). Raised decks and eaves may count toward setbacks under local code; see the projections check.',
} as const;

export interface DerivedFacts {
  readonly interiorLivableArea: Traced;
  readonly totalFloorArea: Traced;
  readonly footprintArea: Traced;
  readonly height: Traced;
  readonly clearances: { readonly front: Traced; readonly side: Traced; readonly rear: Traced };
  readonly coverage: Traced;
}

const P = '/body';
const t = (value: number, unit: Traced['unit'], formula: string, reads: string[], rules: string[] = []): Traced => ({
  value: unit === 'ratio' ? Math.round(value * 1e4) / 1e4 : Math.round(value), unit, formula, reads, rules,
});

/** Which lot edges are front, side and rear (same reading as the setback check). */
export const edgeKinds = (intent: HomeIntent): ('front' | 'side' | 'rear')[] => {
  const { boundary, frontEdge } = intent.body.site;
  const nf = edgeNormal(boundary, frontEdge);
  let rear = -1, best = Infinity;
  boundary.forEach((_, i) => {
    if (i === frontEdge) return;
    const n = edgeNormal(boundary, i);
    const dot = n[0] * nf[0] + n[1] * nf[1];
    if (dot < best) { best = dot; rear = i; }
  });
  return boundary.map((_, i) => (i === frontEdge ? 'front' : i === rear ? 'rear' : 'side'));
};

export const deriveFacts = (
  intent: HomeIntent, catalog: Catalog, modules: readonly PlacedModule[], height: Traced, lotArea: number,
): DerivedFacts => {
  const w = catalog.wall;
  const interior = modules.reduce((s, m) => s + (m.length - 2 * w) * (m.width - 2 * w), 0);
  const gross = modules.reduce((s, m) => s + m.length * m.width, 0);
  const boundary = intent.body.site.boundary;
  const kinds = edgeKinds(intent);
  const corners: Point2[] = modules.flatMap((m) => m.footprint);
  const dist = { front: Infinity, side: Infinity, rear: Infinity };
  boundary.forEach((a, i) => {
    const n = edgeNormal(boundary, i);
    for (const p of corners) {
      const d = -((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1]);
      dist[kinds[i]!] = Math.min(dist[kinds[i]!], d);
    }
  });
  const reads = [`${P}/site/boundary`, `${P}/site/frontEdge`, `${P}/design/placement`];
  const clearance = (k: 'front' | 'side' | 'rear') =>
    t(dist[k], 'mm', `shortest distance from any module corner to a ${k} lot line`, reads);
  return {
    interiorLivableArea: t(interior, 'mm2', 'sum of (module length − 2 walls) × (module width − 2 walls)', [`${P}/brief`, `${P}/design/catalog`]),
    totalFloorArea: t(gross, 'mm2', 'sum of module length × width (outside dimensions)', [`${P}/brief`, `${P}/design/catalog`]),
    footprintArea: t(gross, 'mm2', 'module footprint area (single storey, so equal to the total floor area)', [`${P}/brief`, `${P}/design/catalog`]),
    height,
    clearances: { front: clearance('front'), side: clearance('side'), rear: clearance('rear') },
    coverage: t(gross / lotArea, 'ratio', 'module footprint area ÷ lot area', [`${P}/site/boundary`, `${P}/brief`]),
  };
};

/** The rules input for a detached ADU built from this design. */
export const aduInput = (intent: HomeIntent, facts: DerivedFacts, lotArea: number): AduInput | undefined => {
  const j = intent.body.site.jurisdiction;
  if (!j?.lot) return undefined;
  const z = intent.body.site.zoning;
  const src = intent.body.sources['/body/site'] ?? intent.body.sources['/body/site/zoning'];
  return {
    adu: {
      kind: 'detached',
      interiorLivableArea: facts.interiorLivableArea.value,
      totalFloorArea: facts.totalFloorArea.value,
      footprintArea: facts.footprintArea.value,
      bedrooms: intent.body.brief.bedrooms,
      height: facts.height.value,
      stories: 1,
      clearances: { front: facts.clearances.front.value, side: facts.clearances.side.value, rear: facts.clearances.rear.value },
    },
    lot: { ...j.lot, lotArea: j.lot.lotArea ?? lotArea },
    local: {
      setbacks: { ...z.setbacks },
      ...(z.maxHeight !== undefined ? { maxHeight: z.maxHeight } : {}),
      ...(z.maxCoverage !== undefined ? { maxCoverage: z.maxCoverage } : {}),
      source: src?.by === 'example' ? 'example zoning values in the intent, not real zoning' : src ? `intent zoning (set by ${src.by})` : 'intent zoning',
    },
  };
};

/** Picks the engine trace that produced a rule's measured value. */
const traceFor = (r: RuleCheck, f: DerivedFacts): Traced | undefined => {
  if (r.measured === undefined) return undefined;
  const pool = [f.height, f.interiorLivableArea, f.totalFloorArea, f.footprintArea, f.coverage, f.clearances.front, f.clearances.side, f.clearances.rear];
  const hit = pool.find((p) => Math.abs(p.value - r.measured!) < (r.unit === 'ratio' ? 1e-3 : 1));
  const unit = r.unit === 'mm' || r.unit === 'mm2' || r.unit === 'ratio' || r.unit === 'count' ? r.unit : 'mm';
  return hit
    ? { ...hit, value: r.unit === 'ratio' ? r.measured : Math.round(r.measured), rules: [...hit.rules, r.ruleId] }
    : { value: r.measured, unit, formula: 'measured by the rule from the engine facts', reads: [`${P}/site`], rules: [r.ruleId] };
};

const interpretationsFor = (r: RuleCheck, intent: HomeIntent): string[] => {
  const out = [...r.interpretations];
  if (r.ruleId.includes('.height.') || r.ruleId.includes('.path.')) {
    out.push(intent.body.site.zoning.heightMethod === 'aboveGrade' ? ENGINE_INTERPRETATIONS.heightAbove : ENGINE_INTERPRETATIONS.height);
  }
  if (r.ruleId.includes('.size.') || r.ruleId.includes('.path.')) out.push(ENGINE_INTERPRETATIONS.livable);
  if (r.ruleId.includes('.setback.') || r.ruleId.includes('.path.')) out.push(ENGINE_INTERPRETATIONS.clearance);
  return out;
};

/** Deck height above grade at which many local codes start counting a deck toward setbacks (about 30 in; common, unverified, varies by city). */
export const RAISED_DECK_HEIGHT = 762;

const corners = (s: Solid): Point2[] => {
  const hx = s.size[0] / 2, hy = s.size[1] / 2;
  return ([[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]] as Point2[]).map((p) => {
    const q = rotate2(p, s.rotation);
    return [s.center[0] + q[0], s.center[1] + q[1]] as Point2;
  });
};

/**
 * Raised decks and roof eaves inside the 4 ft side and rear clearance that
 * California guarantees. Not a state rule: local codes decide whether they
 * count, so this is a 'review' item, never a fail.
 */
export const projectionCheck = (intent: HomeIntent, solids: readonly Solid[], ground: GroundSampler): CheckResult => {
  const boundary = intent.body.site.boundary;
  const kinds = edgeKinds(intent);
  const id = 'vandelay.assumption.projections-in-setback';
  const near: string[] = [];
  let closest = Infinity;
  for (const s of solids) {
    if (s.role !== 'deck' && s.role !== 'roof') continue;
    const pts = corners(s);
    const top = s.center[2] + s.size[2] / 2;
    if (s.role === 'deck' && !pts.some((p) => top - ground(p) > RAISED_DECK_HEIGHT)) continue;
    boundary.forEach((a, i) => {
      if (kinds[i] === 'front') return;
      const n = edgeNormal(boundary, i);
      const d = Math.min(...pts.map((p) => -((p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1])));
      if (d < CA_MAX_SIDE_REAR_SETBACK) {
        closest = Math.min(closest, d);
        const what = s.role === 'deck' ? 'raised deck' : 'roof eave';
        if (!near.includes(`${what} (${kinds[i]})`)) near.push(`${what} (${kinds[i]})`);
      }
    });
  }
  const interpretations = [
    `A deck counts as raised when its surface is more than ${RAISED_DECK_HEIGHT} mm (about 30 in) above existing grade, a threshold many local codes use; unverified and city-specific.`,
    'Whether raised decks and roof eaves count toward ADU setbacks is set by local code, not state law.',
  ];
  if (!near.length) {
    return { ruleId: id, status: 'pass', message: 'No raised deck or roof eave sits within 4 ft of a side or rear lot line.', interpretations };
  }
  return {
    ruleId: id,
    status: 'review',
    message: `A ${near.join(' and a ')} sits within 4 ft of the lot line. Check whether the local code counts it toward the setback.`,
    measured: { value: Math.round(closest), unit: 'mm', formula: 'shortest distance from a raised deck or roof eave corner to a side or rear lot line', reads: ['/body/site/boundary', '/body/design/placement'], rules: [id] },
    limit: CA_MAX_SIDE_REAR_SETBACK,
    interpretations,
  };
};

export interface JurisdictionChecks {
  readonly checks: readonly CheckResult[];
  readonly report?: Omit<RuleReport, 'results'>;
}

/** Runs the jurisdiction's rules when the intent names one; otherwise returns nothing. */
export const jurisdictionChecks = (
  intent: HomeIntent, facts: DerivedFacts, lotArea: number, solids: readonly Solid[], ground: GroundSampler,
): JurisdictionChecks => {
  const j = intent.body.site.jurisdiction;
  if (!j) return { checks: [] };
  const region = lookup(j.region);
  if (!region) {
    return { checks: [{ ruleId: 'vandelay.jurisdiction.loaded', status: 'review', message: `No rules are loaded for region "${j.region}" yet, so only the intent's zoning values were checked.` }] };
  }
  if ((intent.body.brief.use ?? 'home') !== 'adu') {
    return { checks: [{ ruleId: 'vandelay.jurisdiction.loaded', status: 'review', message: `${region.name} rules cover ADUs only so far; rules for a main home are not loaded, so only the intent's zoning values were checked.` }] };
  }
  const input = aduInput(intent, facts, lotArea);
  if (!input) {
    return { checks: [{ ruleId: 'vandelay.jurisdiction.loaded', status: 'review', message: 'The lot facts (zoning and main home) are missing, so state ADU rules could not run.' }] };
  }
  const { results, ...report } = runRules(region, input, lookup);
  return {
    report,
    checks: [...results.map((r) => {
      const measured = traceFor(r, facts);
      return {
        ruleId: r.ruleId,
        status: r.status,
        message: r.message,
        why: r.why,
        citations: r.citations,
        interpretations: interpretationsFor(r, intent),
        ...(measured ? { measured } : {}),
        ...(r.limit !== undefined ? { limit: r.limit } : {}),
      };
    }), projectionCheck(intent, solids, ground)],
  };
};
