import { applyPatch, exampleAduIntent, exampleHomeIntent, patchHomeIntent, validateHomeIntent, type HomeIntent } from '@vandelay/kernel';
import { describe, expect, it } from 'vitest';
import { evaluate, proposeOptions, type HomeOption, type HomeResult } from './index.ts';
import { projectionCheck } from './jurisdiction.ts';

const opts = (i: HomeIntent) => {
  const r = proposeOptions(i);
  if (!Array.isArray(r)) throw new Error(JSON.stringify(r.issues));
  return r;
};
const patched = (i: HomeIntent, path: string, value: unknown) => {
  const r = patchHomeIntent(i, [{ op: path.endsWith('/use') || path.endsWith('/jurisdiction') ? 'add' : 'replace', path, value }]);
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
};

describe('California ADU rules on Home options', () => {
  it('the example ADU intents are valid', () => {
    for (const s of ['flat', 'slopeAlong', 'slopeCross'] as const) expect(validateHomeIntent(exampleAduIntent(s))).toEqual([]);
  });

  const flat = opts(exampleAduIntent('flat'));
  const slope = opts(exampleAduIntent('slopeAlong'));

  it('runs every state rule with a why and its citations', () => {
    const r = flat[0]!.result;
    expect(r.rules?.region).toBe('us-ca');
    const ca = r.checks.filter((c) => c.ruleId.startsWith('us-ca.'));
    expect(ca.length).toBeGreaterThanOrEqual(10);
    for (const c of ca) {
      expect(c.why?.length).toBeGreaterThan(0);
      expect(c.citations?.length).toBeGreaterThan(0);
      for (const cite of c.citations!) expect(cite.url).toMatch(/^https:\/\//);
    }
  });

  it('traces measured values back to the engine geometry', () => {
    const height = flat[0]!.result.checks.find((c) => c.ruleId === 'us-ca.adu.height.detached')!;
    expect(height.status).toBe('pass');
    expect(height.measured?.formula).toMatch(/lowest existing grade/);
    expect(height.measured?.rules).toContain('us-ca.adu.height.detached');
    expect(height.interpretations?.some((t) => t.includes('local code sets the method'))).toBe(true);
    const side = flat[0]!.result.checks.find((c) => c.ruleId === 'us-ca.adu.setback.side')!;
    expect(side.measured?.formula).toMatch(/side lot line/);
  });

  it('a one-storey ADU on flat ground qualifies for fast-track approval', () => {
    expect(flat.every((o) => o.result.checks.find((c) => c.ruleId === 'us-ca.adu.path.ministerial-detached')?.status === 'pass')).toBe(true);
  });

  it('on a slope, explains why a tall option misses fast-track approval but stays allowed', () => {
    const all = slope.flatMap((o: HomeOption) => o.result.checks.filter((c) => c.ruleId === 'us-ca.adu.path.ministerial-detached'));
    expect(all.some((c) => c.status === 'warn' && /taller than 16\.0 ft/.test(c.message))).toBe(true);
    expect(slope.every((o) => o.result.feasible)).toBe(true);
  });

  it('drops options that break a state cap, and says why when none are left', () => {
    const big = patched(exampleAduIntent('flat'), '/body/brief/bedrooms', 4);
    const res = proposeOptions(big);
    expect(Array.isArray(res)).toBe(false);
    expect(!Array.isArray(res) && res.issues.some((i) => i.message.includes('us-ca.adu.size.detached-cap'))).toBe(true);
  });

  it('flags raised decks and eaves near side and rear lines for local review', () => {
    for (const o of [...flat, ...slope]) {
      const c = o.result.checks.find((ch) => ch.ruleId === 'vandelay.assumption.projections-in-setback')!;
      expect(['pass', 'review']).toContain(c.status);
      expect(c.interpretations?.join(' ')).toMatch(/local code/);
    }
  });

  it('asks for review when a raised deck sits within 4 ft of a side line, but not a low one', () => {
    const intent = exampleAduIntent('flat');
    const deck = (z: number) => ({ id: 'd', role: 'deck' as const, material: 'timber' as const, center: [1500, 18000, z] as const, size: [2400, 4000, 150] as const, rotation: 0 });
    const ground = () => 0;
    const high = projectionCheck(intent, [deck(1500)], ground);
    expect(high.status).toBe('review');
    expect(high.message).toMatch(/raised deck \(side\)/);
    expect(high.measured?.value).toBe(300);
    expect(projectionCheck(intent, [deck(400)], ground).status).toBe('pass');
  });

  it('says plainly when the rules for this use or region are not loaded', () => {
    const home = patched(exampleAduIntent('flat'), '/body/brief/use', 'home');
    const r1 = evaluate(home) as HomeResult;
    expect(r1.checks.find((c) => c.ruleId === 'vandelay.jurisdiction.loaded')?.status).toBe('review');
    const elsewhere = patched(exampleAduIntent('flat'), '/body/site/jurisdiction', { region: 'us-or', lot: { zoning: 'single-family', primary: 'single-family', primaryExists: true } });
    const r2 = evaluate(elsewhere) as HomeResult;
    expect(r2.checks.find((c) => c.ruleId === 'vandelay.jurisdiction.loaded')?.message).toMatch(/us-or/);
  });

  it('leaves intents without a jurisdiction untouched', () => {
    const r = evaluate(exampleHomeIntent('flat')) as HomeResult;
    expect(r.rules).toBeUndefined();
    expect(r.checks.some((c) => c.ruleId.startsWith('us-ca.'))).toBe(false);
  });

  it('rejects malformed lot facts', () => {
    const bad = applyPatch(exampleAduIntent('flat'), [{ op: 'replace', path: '/body/site/jurisdiction', value: { region: 'US CA', lot: { zoning: 'farm', primary: 'single-family', primaryExists: 'yes' } } }]);
    expect(bad.ok && validateHomeIntent(bad.value).map((i) => i.path)).toEqual(['/body/site/jurisdiction/region', '/body/site/jurisdiction/lot/zoning', '/body/site/jurisdiction/lot/primaryExists']);
  });
});
