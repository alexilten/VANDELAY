import { exampleAduIntent, exampleHomeIntent, patchHomeIntent, validateHomeIntent, type HomeIntent } from '@vandelay/kernel';
import { describe, expect, it } from 'vitest';
import { evaluate, proposeOptions, RULES, type HomeOption, type HomeResult } from './index.ts';

const opts = (i: HomeIntent): HomeOption[] => {
  const r = proposeOptions(i);
  if (!Array.isArray(r)) throw new Error(JSON.stringify(r.issues));
  return r;
};
const fastTrack = (r: HomeResult) => r.checks.find((c) => c.ruleId === 'us-ca.adu.path.ministerial-detached')?.status;
const FT16 = 16 * 304.8;

describe('pods benched into the slope', () => {
  const along = opts(exampleAduIntent('slopeAlong'));
  const cross = opts(exampleAduIntent('slopeCross'));
  const benched = [...along, ...cross].filter((o) => o.result.resolved.foundation === 'benched');

  it('the intent schema accepts a benched foundation', () => {
    const r = patchHomeIntent(exampleHomeIntent('slopeAlong'), [{ op: 'replace', path: '/body/design/foundation', value: 'benched' }]);
    expect(r.ok && validateHomeIntent(r.value)).toEqual([]);
  });

  it('gets a hillside ADU under 16 ft, so it qualifies for fast-track approval, on both example slopes', () => {
    for (const set of [along, cross]) {
      const best = set.find((o) => o.result.resolved.foundation === 'benched' && fastTrack(o.result) === 'pass');
      expect(best).toBeDefined();
      expect(best!.result.quantities.height!.value).toBeLessThanOrEqual(FT16 + 1);
      expect(best!.label).toMatch(/into the slope/);
    }
  });

  it('stands no module on piers, and holds the slope back with concrete retaining walls', () => {
    expect(benched.length).toBeGreaterThan(0);
    for (const o of benched) {
      const r = o.result;
      const deckIds = new Set(r.modules.filter((m) => m.kind === 'living').map((m) => m.id));
      expect(r.piers.every((p) => deckIds.has(p.module))).toBe(true);
      const walls = r.geometry.solids.filter((s) => s.role === 'plinth' && s.id.includes('/retaining-'));
      expect(walls.length).toBeGreaterThan(0);
      expect(walls.every((s) => s.material === 'concrete')).toBe(true);
      expect(r.quantities.cutVolume!.value).toBeGreaterThan(0);
      expect(r.quantities.retainingWallArea!.value).toBeGreaterThan(0);
    }
  });

  it('keeps the cut within the assumed limit and sends grading to an engineer', () => {
    for (const o of benched) {
      const cut = o.result.checks.find((c) => c.ruleId === 'vandelay.assumption.bench-cut')!;
      expect(cut.status).toBe('pass');
      expect(o.result.quantities.maxCut!.value).toBeLessThanOrEqual(RULES['vandelay.assumption.bench-cut'].value);
      expect(o.result.checks.find((c) => c.ruleId === 'vandelay.review.grading')?.status).toBe('review');
    }
  });

  it('counts the cut and the walls in the cost index and the grading score', () => {
    const r = benched[0]!.result;
    expect(r.quantities.costIndex!.formula).toMatch(/retaining wall/);
    expect(r.scores.lessGrading!.value).toBeLessThan(1);
  });

  it('reproduces a benched option exactly from its own intent', () => {
    for (const o of benched) {
      const again = evaluate(o.intent);
      expect(again.ok && again.intentHash).toBe(o.result.intentHash);
      expect(again.ok && again.quantities.cutVolume!.value).toBe(o.result.quantities.cutVolume!.value);
    }
  });

  it('does not bench on flat ground, where piers already sit low', () => {
    const flat = opts(exampleAduIntent('flat'));
    expect(flat.some((o) => o.result.resolved.foundation === 'benched')).toBe(false);
    for (const o of flat) {
      expect(o.result.quantities.cutVolume!.value).toBe(0);
      expect(o.result.checks.find((c) => c.ruleId === 'vandelay.assumption.bench-cut')?.status).toBe('n/a');
    }
  });
});
