import type { Mm } from './units.ts';

/** A point or vector in model space: millimetres, right-handed, Z up. */
export interface Vec3 {
  readonly x: Mm;
  readonly y: Mm;
  readonly z: Mm;
}

/** World up axis. Z is up everywhere in Vandelay. */
export const UP = { x: 0, y: 0, z: 1 } as const;

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z }) as Vec3;

export const add = (a: Vec3, b: Vec3): Vec3 => vec3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);
