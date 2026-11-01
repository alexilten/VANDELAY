/**
 * What the 3D viewer draws: a site and a list of oriented boxes.
 *
 * Mirrors the kernel's conventions: mm, site frame +X east, +Y north, Z up.
 * `Terrain` matches the kernel's Home intent union so engine output can pass
 * straight through. Engine results are turned into this shape by an adapter;
 * until the Home engine lands, `mock.ts` produces it.
 */

export type Point2 = readonly [x: number, y: number];
export type Point3 = readonly [x: number, y: number, z: number];

export type Terrain =
  /** A tilted plane: `slopePct` rise per 100 run, falling toward `aspect` (compass bearing, 0 = north, 90 = east). */
  | { readonly kind: 'plane'; readonly z0: number; readonly slopePct: number; readonly aspect: number }
  /** Regular height grid, row-major from `origin` (+X along a row, +Y between rows). */
  | {
      readonly kind: 'grid';
      readonly origin: Point2;
      readonly spacing: number;
      readonly nx: number;
      readonly ny: number;
      readonly z: readonly number[];
    };

export const MATERIALS = ['timber', 'corten', 'blackSteel', 'concrete', 'glass', 'grass'] as const;
export type MaterialId = (typeof MATERIALS)[number];

export type SolidRole =
  | 'module' | 'deck' | 'roof' | 'pier' | 'plinth' | 'glazing' | 'canopy' | 'rail'
  // From the Home engine:
  | 'wall' | 'bridge' | 'shutter'
  // Viewer-only, for the venue example:
  | 'stand' | 'field';

/** A moving part, e.g. a sliding steel shutter. `axis` is a unit vector in the site frame. */
export interface Mechanism {
  readonly kind: 'slide';
  readonly axis: readonly [dx: number, dy: number];
  readonly travel: number;
}

export interface Solid {
  readonly id: string;
  readonly role: SolidRole;
  readonly material: MaterialId;
  /** Centre of the box. */
  readonly center: Point3;
  /** Width along local X, depth along local Y, height along Z. */
  readonly size: Point3;
  /** Degrees about +Z, counter-clockwise from +X. */
  readonly rotation: number;
  /** Degrees about the box's local X axis, for raked stands and shed roofs. */
  readonly tilt?: number;
  readonly mechanism?: Mechanism;
}

export interface Plant {
  readonly at: Point2;
  readonly height: number;
}

export interface OptionGeometry {
  readonly site: {
    readonly boundary: readonly Point2[];
    readonly terrain: Terrain;
    readonly buildable?: readonly Point2[];
  };
  readonly solids: readonly Solid[];
  readonly plants?: readonly Plant[];
  /** True when the geometry is illustrative, not engine output. The UI says so. */
  readonly example: boolean;
}

/** Ground height at (x, y) in mm. */
export function terrainZ(t: Terrain, x: number, y: number): number {
  if (t.kind === 'plane') {
    const b = (t.aspect * Math.PI) / 180;
    // Distance travelled toward the downhill bearing; the ground falls along it.
    const along = x * Math.sin(b) + y * Math.cos(b);
    return t.z0 - (t.slopePct / 100) * along;
  }
  const fx = Math.min(Math.max((x - t.origin[0]) / t.spacing, 0), t.nx - 1);
  const fy = Math.min(Math.max((y - t.origin[1]) / t.spacing, 0), t.ny - 1);
  const i = Math.min(Math.floor(fx), t.nx - 2);
  const j = Math.min(Math.floor(fy), t.ny - 2);
  const u = fx - i;
  const v = fy - j;
  const z = (a: number, c: number) => t.z[c * t.nx + a] ?? 0;
  return (z(i, j) * (1 - u) + z(i + 1, j) * u) * (1 - v) + (z(i, j + 1) * (1 - u) + z(i + 1, j + 1) * u) * v;
}

export interface Bounds {
  readonly min: Point3;
  readonly max: Point3;
}

/** Axis-aligned bounds of the solids (ignores rotation, which only overestimates slightly). */
export function solidBounds(solids: readonly Solid[]): Bounds {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const s of solids) {
    const r = Math.hypot(s.size[0], s.size[1]) / 2;
    const half = [r, r, s.size[2] / 2];
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k]!, s.center[k]! - half[k]!);
      max[k] = Math.max(max[k]!, s.center[k]! + half[k]!);
    }
  }
  return { min: min as unknown as Point3, max: max as unknown as Point3 };
}
