import { describe, expect, it } from 'vitest';
import { terrainZ, type Terrain } from './geometry';

describe('terrainZ', () => {
  it('falls toward the aspect on a plane', () => {
    const west: Terrain = { kind: 'plane', z0: 0, slopePct: 10, aspect: 270 };
    expect(terrainZ(west, 0, 0)).toBeCloseTo(0);
    expect(terrainZ(west, -1000, 0)).toBeCloseTo(-100); // 1 m west is 100 mm lower
    expect(terrainZ(west, 1000, 0)).toBeCloseTo(100);
  });

  it('interpolates a height grid and clamps outside it', () => {
    const g: Terrain = { kind: 'grid', origin: [0, 0], spacing: 1000, nx: 2, ny: 2, z: [0, 100, 200, 300] };
    expect(terrainZ(g, 500, 500)).toBeCloseTo(150);
    expect(terrainZ(g, 1000, 1000)).toBeCloseTo(300);
    expect(terrainZ(g, -5000, -5000)).toBeCloseTo(0);
  });
});
