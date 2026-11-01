import { describe, expect, it } from 'vitest';
import { homePrompt, liveHome } from './home';

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
