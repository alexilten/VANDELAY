/**
 * Option search: three real choices from one intent.
 *
 * A fixed, seeded grid of parti × rotation × anchor × foundation is tried.
 * Candidates that break the setbacks are skipped cheaply; the rest are fully
 * evaluated, any with a failed check are dropped, and the best of each parti
 * is kept so the three options differ in kind, not just in position.
 */
import { bbox, createHomeIntent, insideConvex, PARTIS, type HomeIntent, type Parti, type Point2 } from '@vandelay/kernel';
import { evaluateChoice, evaluateWithDefaults, fitsBuildable, frontRotation, siteContext, type Choice } from './evaluate.ts';
import { layoutParti } from './layout.ts';
import type { HomeError, HomeOption, HomeResult } from './types.ts';

/** mulberry32: a tiny deterministic PRNG. The intent's seed is the only source of variation. */
const prng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FOUNDATIONS_FOR: Record<Parti, readonly Choice['foundation'][]> = {
  bar: ['piers'],
  steppedBar: ['steppedPods'],
  L: ['piers', 'steppedPods'],
  courtyard: ['piers', 'steppedPods'],
};

const LABEL: Record<Parti, string> = {
  bar: 'Long bar on piers',
  steppedBar: 'Stepped bar down the slope',
  L: 'L around a deck',
  courtyard: 'Courtyard',
};

export interface SearchOptions {
  /** How many options to return. */
  readonly count?: number;
  /** Rotation step in degrees. */
  readonly rotationStep?: number;
  /** Anchor grid spacing in mm. */
  readonly anchorStep?: number;
  /** Only search these partis (default: all four). */
  readonly partis?: readonly Parti[];
}

interface Scored { readonly choice: Choice; readonly result: HomeResult; readonly order: number }

/** Returns up to `count` options, best first, each a fully resolved intent with its result. */
export const proposeOptions = (intent: HomeIntent, opts: SearchOptions = {}): HomeOption[] | HomeError => {
  const ctx = siteContext(intent);
  if ('ok' in ctx) return ctx;
  const count = opts.count ?? 3;
  const rotStep = opts.rotationStep ?? 15;
  const step = opts.anchorStep ?? 1500;
  if (ctx.buildable.length < 3) return { ok: false, issues: [{ path: '/body/site/zoning/setbacks', message: 'the setbacks leave no buildable area' }] };

  const rnd = prng(intent.body.seed);
  const jx = rnd() * step, jy = rnd() * step;
  // Rotations are set out from the street edge, so square lots get square-on options.
  const base = frontRotation(intent);
  const { min, max } = bbox(ctx.buildable);
  const anchors: Point2[] = [];
  for (let x = min[0] + jx % step; x <= max[0]; x += step) {
    for (let y = min[1] + jy % step; y <= max[1]; y += step) if (insideConvex(ctx.buildable, [x, y])) anchors.push([x, y]);
  }

  const d = intent.body.design;
  const lockedRot = d.placement.rotation !== 'auto' ? d.placement.rotation : undefined;
  const lockedAnchor = d.placement.anchor !== 'auto' ? d.placement.anchor : undefined;
  const rotations: number[] = lockedRot !== undefined ? [lockedRot] : Array.from({ length: Math.ceil(360 / rotStep) }, (_, i) => (((base + i * rotStep) % 360) + 360) % 360);
  const anchorList = lockedAnchor ? [lockedAnchor] : anchors;

  const all: Scored[] = [];
  let order = 0;
  for (const parti of opts.partis ?? PARTIS) {
    const layout = layoutParti(parti, ctx.program, ctx.catalog);
    if (!layout) continue;
    const foundations = d.foundation === 'auto' ? FOUNDATIONS_FOR[parti] : [d.foundation];
    for (const rotation of rotations) {
      for (const anchor of anchorList) {
        if (!fitsBuildable(ctx, layout, { anchor, rotation })) continue;
        for (const foundation of foundations) {
          const choice: Choice = { parti, anchor, rotation, foundation };
          const res = evaluateChoice(ctx, choice, layout);
          if (!res.ok || !res.feasible) continue;
          // Stepped pods that all land at one level are the same home as the single-level version: skip the duplicate.
          if (foundation === 'steppedPods' && new Set(res.resolved.floorDatums).size < 2) continue;
          all.push({ choice, result: res, order: order++ });
        }
      }
    }
  }

  const rank = (a: Scored, b: Scored) => b.result.scores.overall!.value - a.result.scores.overall!.value || a.order - b.order;
  all.sort(rank);

  // Best of each parti first; then fill with the next best that differ clearly from what is already picked.
  const picked: Scored[] = [];
  for (const s of all) {
    if (picked.length >= count) break;
    if (!picked.some((p) => p.choice.parti === s.choice.parti)) picked.push(s);
  }
  for (const s of all) {
    if (picked.length >= count) break;
    const distinct = picked.every((p) => {
      const dr = Math.abs((((p.choice.rotation - s.choice.rotation) % 360) + 540) % 360 - 180);
      const da = Math.hypot(p.choice.anchor[0] - s.choice.anchor[0], p.choice.anchor[1] - s.choice.anchor[1]);
      return p.choice.parti !== s.choice.parti || p.choice.foundation !== s.choice.foundation || dr >= 45 || da >= 4000;
    });
    if (distinct && !picked.includes(s)) picked.push(s);
  }
  picked.sort(rank);

  return picked.map(({ choice }) => {
    // Re-evaluate from the resolved intent (rounded anchor and rotation), so the option reproduces exactly from its own intent.
    const resolved = resolveIntent(intent, choice);
    const result = evaluateWithDefaults(resolved) as HomeResult;
    const stepped = choice.foundation === 'steppedPods' && choice.parti !== 'steppedBar';
    return { label: `${LABEL[choice.parti]}${stepped ? ', stepped' : ''}`, intent: resolved, result };
  });
};

/** Writes the engine's choice back into a copy of the intent, so the option is fully specified and stable to refine. */
export const resolveIntent = (intent: HomeIntent, choice: Choice): HomeIntent => {
  const b = intent.body;
  const note = `chosen by the Home engine option search (seed ${b.seed})`;
  return createHomeIntent({
    ...b,
    design: {
      ...b.design,
      parti: choice.parti,
      placement: { anchor: [Math.round(choice.anchor[0]), Math.round(choice.anchor[1])], rotation: Math.round(choice.rotation * 1e4) / 1e4 },
      foundation: choice.foundation,
    },
    sources: {
      ...b.sources,
      '/body/design/parti': { by: 'default', note },
      '/body/design/placement': { by: 'default', note },
      '/body/design/foundation': { by: 'default', note },
    },
  });
};

/**
 * Evaluates one Home intent. When placement or foundation is 'auto', the engine
 * searches for the best feasible placement of the intent's own parti; if none
 * is feasible it falls back to simple defaults so the failed checks explain why.
 */
export const evaluate = (intent: HomeIntent): HomeResult | HomeError => {
  const d = intent.body.design;
  const needsSearch = d.placement.anchor === 'auto' || d.placement.rotation === 'auto' || d.foundation === 'auto';
  if (needsSearch) {
    const found = proposeOptions(intent, { count: 1, partis: [d.parti] });
    if (!Array.isArray(found)) return found;
    if (found[0]) return found[0].result;
  }
  return evaluateWithDefaults(intent);
};
