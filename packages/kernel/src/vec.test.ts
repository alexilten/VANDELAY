import { describe, expect, it } from 'vitest';
import { fromFeet, fromMetres, toMetres } from './units.ts';
import { add, UP, vec3 } from './vec.ts';

describe('units and vectors', () => {
  it('stores lengths in millimetres', () => {
    expect(fromMetres(2.4)).toBe(2400);
    expect(toMetres(fromMetres(3))).toBe(3);
    expect(fromFeet(1)).toBe(304.8);
  });

  it('is Z up', () => {
    expect(UP).toEqual({ x: 0, y: 0, z: 1 });
    expect(add(vec3(0, 0, 1000), vec3(10, 20, 30))).toEqual({ x: 10, y: 20, z: 1030 });
  });
});
