/**
 * Terrain sampling. Z is elevation above the site datum, in mm.
 * Plane: exact. Grid: bilinear, clamped at the grid edge.
 */
import type { Point2, Terrain } from './home-intent.ts';
import { bearingToVec } from './plan.ts';

export type GroundSampler = (p: Point2) => number;

export const terrainSampler = (t: Terrain): GroundSampler => {
  if (t.kind === 'plane') {
    // Falls toward `aspect`: moving one unit downhill drops slopePct/100.
    const [dx, dy] = bearingToVec(t.aspect);
    const k = t.slopePct / 100;
    return ([x, y]) => t.z0 - k * (x * dx + y * dy);
  }
  const { origin, spacing, nx, ny, z } = t;
  const at = (i: number, j: number) => z[j * nx + i]!;
  return ([x, y]) => {
    const u = Math.min(Math.max((x - origin[0]) / spacing, 0), nx - 1);
    const v = Math.min(Math.max((y - origin[1]) / spacing, 0), ny - 1);
    const i = Math.min(Math.floor(u), nx - 2), j = Math.min(Math.floor(v), ny - 2);
    const fu = u - i, fv = v - j;
    return (
      at(i, j) * (1 - fu) * (1 - fv) + at(i + 1, j) * fu * (1 - fv) + at(i, j + 1) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv
    );
  };
};

/** Slope at a point, as rise over run (0.15 = 15%), by central differences. */
export const slopeAt = (ground: GroundSampler, p: Point2, h = 500): number => {
  const gx = (ground([p[0] + h, p[1]]) - ground([p[0] - h, p[1]])) / (2 * h);
  const gy = (ground([p[0], p[1] + h]) - ground([p[0], p[1] - h])) / (2 * h);
  return Math.hypot(gx, gy);
};
