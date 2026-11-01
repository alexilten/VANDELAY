import { describe, expect, it } from 'vitest';
import { CATEGORY_IDS } from '../design/categories';
import { solidBounds } from './geometry';
import { mockOptionGeometry } from './mock';

describe('example geometry', () => {
  for (const c of CATEGORY_IDS) {
    for (const i of [0, 1, 2]) {
      it(`${c} option ${i} is finite, non-empty and marked as an example`, () => {
        const g = mockOptionGeometry(c, i, [1, 1, 1]);
        expect(g.example).toBe(true);
        expect(g.solids.length).toBeGreaterThan(0);
        for (const s of g.solids) {
          expect([...s.center, ...s.size, s.rotation].every(Number.isFinite), s.id).toBe(true);
          expect(s.size.every((v) => v > 0), s.id).toBe(true);
        }
        const b = solidBounds(g.solids);
        expect([...b.min, ...b.max].every(Number.isFinite)).toBe(true);
      });
    }
  }

  it('gives every solid a unique id', () => {
    const g = mockOptionGeometry('home', 0);
    expect(new Set(g.solids.map((s) => s.id)).size).toBe(g.solids.length);
  });

  it('responds to the size answer', () => {
    const small = solidBounds(mockOptionGeometry('home', 2, [0]).solids);
    const big = solidBounds(mockOptionGeometry('home', 2, [3]).solids);
    expect(big.max[0] - big.min[0]).toBeGreaterThan(small.max[0] - small.min[0]);
  });
});
