import { EXAMPLE_SITES, exampleHomeIntent } from '@vandelay/kernel';
import type { HomeOption, HomeResult } from '@vandelay/engine-home';
import { describe, expect, it } from 'vitest';
import { briefFromPrompt, evaluateTool, explainTool, homeTools, optionsFromPrompt, patchTool, proposeTool, validateTool } from './index.ts';

describe('brief from a prompt', () => {
  it('reads bedrooms, baths, area and priorities, and keeps the words', () => {
    const { brief, fromPrompt } = briefFromPrompt('A 3-bed, 2 bath home, about 1,500 sq ft, on my hillside with ocean views. Step-free please.');
    expect(brief).toMatchObject({ bedrooms: 3, bathrooms: 2, stepFreeEntry: true, area: { target: Math.round(1500 * 92903.04) } });
    expect(brief.priorities).toMatchObject({ view: 1, lessGrading: 0.6 });
    expect(brief.prompt).toContain('ocean views');
    expect(fromPrompt).toContain('bedrooms');
  });

  it('falls back to defaults it can name', () => {
    const { brief, fromPrompt } = briefFromPrompt('something nice');
    expect(brief.bedrooms).toBe(2);
    expect(fromPrompt).toEqual([]);
  });

  it('reads words and studios', () => {
    expect(briefFromPrompt('two bedroom cabin').brief.bedrooms).toBe(2);
    expect(briefFromPrompt('a studio by the creek').brief.bedrooms).toBe(0);
  });
});

describe('home tools', () => {
  it('have unique names and object input schemas', () => {
    expect(new Set(homeTools.map((t) => t.name)).size).toBe(homeTools.length);
    for (const t of homeTools) expect(t.inputSchema.type).toBe('object');
  });

  it('validate reports paths', () => {
    expect(validateTool.run({ intent: exampleHomeIntent() })).toEqual({ ok: true, issues: [] });
    expect(validateTool.run({ intent: { nope: 1 } }).ok).toBe(false);
  });

  it('patch refuses invalid changes and solves valid ones', () => {
    const intent = exampleHomeIntent('slopeCross');
    expect(patchTool.run({ intent, patch: [{ op: 'replace', path: '/body/brief/bedrooms', value: 'many' }] }).ok).toBe(false);
    const res = patchTool.run({ intent, patch: [{ op: 'replace', path: '/body/brief/bedrooms', value: 3 }] });
    expect(res.ok && res.result.ok && res.result.modules.filter((m) => m.kind === 'bed')).toHaveLength(3);
  });

  it('explain answers why for a traced number', () => {
    const r = evaluateTool.run({ intent: exampleHomeIntent('slopeCross') }) as HomeResult;
    const why = explainTool.run({ result: r, path: '/quantities/maxPierHeight' });
    expect(why.ok && why.trace?.rules).toContain('vandelay.assumption.pier-height');
    expect(explainTool.run({ result: r, path: '/nowhere' }).ok).toBe(false);
  });

  it('propose gives three options', () => {
    const opts = proposeTool.run({ intent: exampleHomeIntent('slopeAlong') }) as HomeOption[];
    expect(opts).toHaveLength(3);
  });
});

describe('prompt to three options (Phase 0 gate, offline)', () => {
  it('turns a prompt and a site into three feasible options quickly', () => {
    const t = performance.now();
    const { intent, options } = optionsFromPrompt('A small two-bedroom home on my hillside that opens to the view, step-free', EXAMPLE_SITES.slopeAlong);
    const ms = performance.now() - t;
    expect(intent.body.brief.stepFreeEntry).toBe(true);
    expect(Array.isArray(options) && options.length).toBe(3);
    expect(Array.isArray(options) && options.every((o) => o.result.feasible)).toBe(true);
    expect(ms).toBeLessThan(5000);
  });
});
