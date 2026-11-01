import { describe, expect, it } from 'vitest';
import { checkView, homePrompt, liveHome } from './home';

describe('liveHome', () => {
  it('turns brief answers into prompt words', () => {
    expect(homePrompt('', [2, 1])).toContain('three bedroom');
    expect(homePrompt('Cabin', [0, 0])).toBe('Cabin, one bedroom, on a budget');
  });

  it('returns three engine options with geometry marked as an example', () => {
    const live = liveHome('A small home on my hillside', [1, 1, 3]);
    expect(live).not.toBeNull();
    expect(live!.options).toHaveLength(3);
    expect(live!.options.filter((o) => o.bestFit)).toHaveLength(1);
    for (const o of live!.options) {
      expect(o.geometry.example).toBe(true);
      expect(o.geometry.solids.length).toBeGreaterThan(0);
      expect(o.headline).toMatch(/sf$/);
    }
    expect(live!.site.map(([k]) => k)).toContain('Slope');
  });
});

describe('checkView', () => {
  it('carries citations and interpretations when a check has them', () => {
    const v = checkView({
      ruleId: 'us-ca.adu.height',
      status: 'warn',
      message: 'Height is close to the limit.',
      why: 'The state sets a 16 ft minimum height allowance (Gov. Code § 66321).',
      citations: [{ code: 'California Government Code', section: '§ 66321(b)(4)', title: 'ADU height', url: 'https://example.org/66321' }],
      interpretations: ['Measured from lowest grade.'],
    });
    expect(v.why).toContain('66321');
    expect(v.citations).toEqual([{ label: 'California Government Code § 66321(b)(4)', url: 'https://example.org/66321' }]);
    expect(v.interpretations).toHaveLength(1);
    expect(v.rule).toBeUndefined();
  });
});
