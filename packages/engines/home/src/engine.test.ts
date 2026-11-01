import { EXAMPLE_SITES, exampleHomeIntent, hashIntent, insideConvex, patchHomeIntent, validateHomeIntent, type HomeIntent } from '@vandelay/kernel';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_CATALOG, MATERIALS } from './catalog.ts';
import { evaluate, proposeOptions, RULES, type HomeOption, type HomeResult } from './index.ts';

const SITES = Object.keys(EXAMPLE_SITES) as (keyof typeof EXAMPLE_SITES)[];
const options = (site: keyof typeof EXAMPLE_SITES): HomeOption[] => {
  const res = proposeOptions(exampleHomeIntent(site));
  if (!Array.isArray(res)) throw new Error(JSON.stringify(res.issues));
  return res;
};
const cache = new Map(SITES.map((s) => [s, options(s)] as const));

describe.each(SITES)('options on the example %s site', (site) => {
  const opts = cache.get(site)!;

  it('gives three feasible options of different partis, best first', () => {
    expect(opts).toHaveLength(3);
    expect(new Set(opts.map((o) => o.result.resolved.parti)).size).toBe(3);
    expect(opts.every((o) => o.result.feasible)).toBe(true);
    const overall = opts.map((o) => o.result.scores.overall!.value);
    expect([...overall].sort((a, b) => b - a)).toEqual(overall);
  });

  it('returns fully resolved, valid intents that reproduce their result exactly', () => {
    for (const o of opts) {
      expect(validateHomeIntent(o.intent)).toEqual([]);
      expect(o.intent.body.design.placement.anchor).not.toBe('auto');
      expect(o.intent.body.design.foundation).not.toBe('auto');
      expect(o.result.intentHash).toBe(hashIntent(o.intent));
      expect(evaluate(o.intent)).toEqual(o.result);
    }
  });

  it('keeps every module, deck and pier inside the setbacks', () => {
    for (const { result: r } of opts) {
      const buildable = r.geometry.site.buildable;
      for (const m of r.modules) for (const p of m.footprint) expect(insideConvex(buildable, p, 1)).toBe(true);
      for (const p of r.piers) expect(insideConvex(buildable, p.at, 1)).toBe(true);
    }
  });

  it('stands every module on piers that reach the ground within the limits', () => {
    for (const { result: r } of opts) {
      const floors = new Map(r.modules.map((m) => [m.id, m.center[2]] as const));
      for (const p of r.piers) {
        expect(p.top).toBe(floors.get(p.module)! - EXAMPLE_CATALOG.floorDepth);
        expect(p.height).toBe(p.top - p.ground);
        expect(p.height).toBeGreaterThanOrEqual(RULES['vandelay.assumption.floor-clearance'].value - 1);
        expect(p.height).toBeLessThanOrEqual(RULES['vandelay.assumption.pier-height'].value);
      }
    }
  });

  it('emits finite, whole-millimetre solids in the architectural palette', () => {
    for (const { result: r } of opts) {
      const roles = new Set(r.geometry.solids.map((s) => s.role));
      for (const role of ['module', 'wall', 'roof', 'glazing', 'pier', 'deck', 'shutter'] as const) expect(roles).toContain(role);
      for (const s of r.geometry.solids) {
        expect(Object.keys(MATERIALS)).toContain(s.material);
        for (const v of [...s.center, ...s.size]) expect(Number.isInteger(v)).toBe(true);
        expect(s.size.every((v) => v >= 0)).toBe(true);
        expect(Number.isFinite(s.rotation)).toBe(true);
      }
      expect(new Set(r.geometry.solids.map((s) => s.id)).size).toBe(r.geometry.solids.length);
      const shutter = r.geometry.solids.find((s) => s.role === 'shutter')!;
      expect(shutter.mechanism?.kind).toBe('slide');
    }
  });

  it('traces every quantity and score back to intent fields', () => {
    for (const { result: r } of opts) {
      for (const t of [...Object.values(r.quantities), ...Object.values(r.scores)]) {
        expect(t.formula.length).toBeGreaterThan(0);
        expect(t.reads.length).toBeGreaterThan(0);
        expect(t.reads.every((p) => p.startsWith('/body/'))).toBe(true);
      }
      for (const c of r.checks) expect(Object.keys(RULES)).toContain(c.ruleId);
    }
  });
});

describe('determinism', () => {
  it('gives byte-identical options for the same intent', () => {
    const a = proposeOptions(exampleHomeIntent('slopeCross')) as HomeOption[];
    expect(JSON.stringify(a)).toBe(JSON.stringify(cache.get('slopeCross')));
  });

  it('pins the example results (update the snapshot only on purpose)', () => {
    const summary = Object.fromEntries(
      SITES.map((s) => [s, cache.get(s)!.map((o) => ({ label: o.label, resolved: o.result.resolved, hash: hashIntent(o.result) }))]),
    );
    expect(summary).toMatchSnapshot();
  });
});

describe('slopes', () => {
  it('steps floors down a slope instead of raising one long floor', () => {
    const stepped = cache.get('slopeAlong')!.find((o) => o.result.resolved.parti === 'steppedBar')!.result;
    expect(new Set(stepped.resolved.floorDatums).size).toBeGreaterThan(1);
    expect(stepped.geometry.solids.some((s) => s.role === 'stair')).toBe(true);
  });

  it('sits one level on flat ground with short piers', () => {
    for (const o of cache.get('flat')!) {
      expect(o.result.resolved.floorDatums).toHaveLength(1);
      expect(o.result.quantities.maxPierHeight!.value).toBe(RULES['vandelay.assumption.floor-clearance'].value);
    }
  });

  it('finds a level steel bridge to uphill grade when step-free entry is asked for', () => {
    const best = cache.get('slopeAlong')![0]!.result;
    expect(best.quantities.bridgeLength!.value).toBeGreaterThan(0);
    expect(best.geometry.solids.find((s) => s.role === 'bridge')?.material).toBe('blackSteel');
    expect(best.checks.find((c) => c.ruleId === 'vandelay.assumption.step-free-bridge')?.status).toBe('pass');
  });
});

describe('evaluate', () => {
  it('rejects an invalid intent with paths, before any geometry', () => {
    const bad = { ...exampleHomeIntent(), body: { ...exampleHomeIntent().body, seed: -1 } } as HomeIntent;
    expect(evaluate(bad)).toEqual({ ok: false, issues: [{ path: '/body/seed', message: 'must be ≥ 0' }] });
  });

  it('reports failed checks with reasons when the design cannot fit', () => {
    const intent = patchHomeIntent(exampleHomeIntent('slopeAlong'), [
      { op: 'replace', path: '/body/design/placement', value: { anchor: [9000, 18000], rotation: 0 } },
      { op: 'replace', path: '/body/design/foundation', value: 'piers' },
    ]);
    if (!intent.ok) throw new Error('patch failed');
    const r = evaluate(intent.value) as HomeResult;
    expect(r.feasible).toBe(false);
    const setbacks = r.checks.find((c) => c.ruleId === 'vandelay.zoning.setbacks')!;
    expect(setbacks.status).toBe('fail');
    expect(setbacks.measured!.value).toBeLessThan(0);
  });

  it('responds to an agent patch: turning the home changes the view score', () => {
    const base = cache.get('slopeAlong')![0]!;
    const turned = patchHomeIntent(base.intent, [{ op: 'replace', path: '/body/design/placement/rotation', value: (base.result.resolved.rotation + 180) % 360 }]);
    if (!turned.ok) throw new Error('patch failed');
    const r = evaluate(turned.value);
    expect(r.ok && r.scores.view!.value).not.toBe(base.result.scores.view!.value);
  });

  it('marks the example catalog as an example', () => {
    expect(EXAMPLE_CATALOG.example).toBe(true);
  });
});
