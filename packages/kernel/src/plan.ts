/**
 * 2D plan geometry on convex polygons (site frame, mm). Pure and exact enough
 * for setbacks and containment; v0 lots are convex by schema.
 */
import type { Point2 } from './home-intent.ts';

export const polygonArea = (pts: readonly Point2[]): number => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
};

/** Outward unit normal of edge i of a counter-clockwise polygon. */
export const edgeNormal = (pts: readonly Point2[], i: number): Point2 => {
  const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return [dy / len, -dx / len];
};

/** Keeps the part of a convex polygon on the inner side of the line through `p` with outward normal `n`. */
export const clipHalfPlane = (pts: readonly Point2[], p: Point2, n: Point2): Point2[] => {
  const side = (q: Point2) => (q[0] - p[0]) * n[0] + (q[1] - p[1]) * n[1];
  const out: Point2[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!, b = pts[(i + 1) % pts.length]!;
    const sa = side(a), sb = side(b);
    if (sa <= 0) out.push(a);
    if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
};

/** Moves each edge of a convex CCW polygon inward by its own distance. Empty when nothing is left. */
export const insetConvex = (pts: readonly Point2[], distances: readonly number[]): Point2[] => {
  let poly: Point2[] = [...pts];
  for (let i = 0; i < pts.length && poly.length >= 3; i++) {
    const n = edgeNormal(pts, i);
    const a = pts[i]!;
    const d = distances[i] ?? 0;
    poly = clipHalfPlane(poly, [a[0] - n[0] * d, a[1] - n[1] * d], n);
  }
  return poly.length >= 3 && polygonArea(poly) > 1 ? poly : [];
};

/** True when q is inside or on a convex CCW polygon (within `tol` mm). */
export const insideConvex = (pts: readonly Point2[], q: Point2, tol = 0.5): boolean => {
  if (pts.length < 3) return false;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const n = edgeNormal(pts, i);
    if ((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1] > tol) return false;
  }
  return true;
};

/** Signed distance from q to the inside of a convex polygon's edges: the smallest margin to any edge (negative = outside). */
export const convexMargin = (pts: readonly Point2[], q: Point2): number => {
  let m = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const n = edgeNormal(pts, i);
    m = Math.min(m, -((q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1]));
  }
  return m;
};

export const bbox = (pts: readonly Point2[]): { min: Point2; max: Point2 } => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return { min: [x0, y0], max: [x1, y1] };
};

export const centroid = (pts: readonly Point2[]): Point2 => {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!, q = pts[(i + 1) % pts.length]!;
    const k = p[0] * q[1] - q[0] * p[1];
    a += k; cx += (p[0] + q[0]) * k; cy += (p[1] + q[1]) * k;
  }
  return a === 0 ? pts[0] ?? [0, 0] : [cx / (3 * a), cy / (3 * a)];
};

/** Rotates a point about the origin by `deg` counter-clockwise. */
export const rotate2 = (p: Point2, deg: number): Point2 => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
};

/** Compass bearing (0 = north, 90 = east) to a unit vector in the site frame. */
export const bearingToVec = (bearing: number): Point2 => {
  const r = (bearing * Math.PI) / 180;
  return [Math.sin(r), Math.cos(r)];
};

/** Unit vector in the site frame to a compass bearing in [0, 360). */
export const vecToBearing = (v: Point2): number => {
  const b = (Math.atan2(v[0], v[1]) * 180) / Math.PI;
  return (b + 360) % 360;
};

/** Smallest angle between two bearings, 0..180. */
export const bearingDelta = (a: number, b: number): number => {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
};
