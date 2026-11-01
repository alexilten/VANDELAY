/**
 * Program sizing and parti layouts, in the parti's own local frame (mm):
 * origin at the footprint centroid, +x along the main wing. Placement into the
 * site (rotation and anchor) happens in `evaluate.ts`.
 */
import type { Brief, Parti } from '@vandelay/kernel';
import type { Catalog } from './catalog.ts';
import type { ModuleKind } from './types.ts';

export interface LocalModule {
  readonly id: string;
  readonly kind: ModuleKind;
  /** Plan centre in the parti frame. */
  readonly cx: number;
  readonly cy: number;
  /** 0 = length along local +x, 90 = along local +y. */
  readonly rot: 0 | 90;
  readonly length: number;
  readonly width: number;
  /** Which long side carries the main glass: +1 = the module's own +y side, -1 = its -y side. */
  readonly glassSide: 1 | -1;
  /** Wing index; stepped foundations give each wing (or each module, for a stepped bar) its own pod. */
  readonly wing: number;
}

export interface LocalLayout {
  readonly parti: Parti;
  readonly modules: readonly LocalModule[];
  /** Pairs of module ids that share a wall (for stairs between pods). */
  readonly joins: readonly (readonly [string, string])[];
}

/** Turns the brief into the module list: one living, one core, a bedroom module per bedroom, a bath module per extra bathroom. */
export const sizeProgram = (brief: Brief): ModuleKind[] => {
  const extraBaths = Math.max(0, Math.ceil(brief.bathrooms) - 1);
  return ['living', 'core', ...Array<ModuleKind>(brief.bedrooms).fill('bed'), ...Array<ModuleKind>(extraBaths).fill('bath')];
};

const counter = () => {
  const n: Partial<Record<ModuleKind, number>> = {};
  return (k: ModuleKind) => {
    n[k] = (n[k] ?? 0) + 1;
    return `${k}-${n[k]}`;
  };
};

/** Lays modules end to end along one axis. Returns their spans along it. */
const run = (kinds: readonly ModuleKind[], catalog: Catalog, start: number): { kind: ModuleKind; a: number; b: number }[] => {
  let at = start;
  return kinds.map((kind) => {
    const len = catalog.modules[kind].length;
    const span = { kind, a: at, b: at + len };
    at += len;
    return span;
  });
};

const recentre = (mods: LocalModule[]): LocalModule[] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of mods) {
    const hx = (m.rot === 0 ? m.length : m.width) / 2, hy = (m.rot === 0 ? m.width : m.length) / 2;
    x0 = Math.min(x0, m.cx - hx); x1 = Math.max(x1, m.cx + hx); y0 = Math.min(y0, m.cy - hy); y1 = Math.max(y1, m.cy + hy);
  }
  const ox = (x0 + x1) / 2, oy = (y0 + y1) / 2;
  return mods.map((m) => ({ ...m, cx: m.cx - ox, cy: m.cy - oy }));
};

/**
 * Builds one parti. Returns undefined when the program cannot make that parti
 * (a courtyard needs at least one module for each side wing).
 */
export const layoutParti = (parti: Parti, program: readonly ModuleKind[], catalog: Catalog): LocalLayout | undefined => {
  const id = counter();
  const W = catalog.modules.living.width;
  const rest = program.filter((k) => k !== 'living' && k !== 'core');
  const mods: LocalModule[] = [];
  const joins: [string, string][] = [];
  const chain = (ids: string[]) => ids.slice(1).forEach((b, i) => joins.push([ids[i]!, b]));

  if (parti === 'bar' || parti === 'steppedBar') {
    // Bedrooms and baths, then the core, then living at the open end.
    const order: ModuleKind[] = [...rest, 'core', 'living'];
    const ids: string[] = [];
    for (const s of run(order, catalog, 0)) {
      const mid = id(s.kind);
      ids.push(mid);
      mods.push({ id: mid, kind: s.kind, cx: (s.a + s.b) / 2, cy: 0, rot: 0, length: s.b - s.a, width: W, glassSide: 1, wing: parti === 'steppedBar' ? ids.length - 1 : 0 });
    }
    chain(ids);
  } else if (parti === 'L') {
    // Main wing along +x: core then living. Bedroom wing runs +y from the core end.
    const main = run(['core', 'living'], catalog, 0);
    const mainIds = main.map((s) => {
      const mid = id(s.kind);
      mods.push({ id: mid, kind: s.kind, cx: (s.a + s.b) / 2, cy: 0, rot: 0, length: s.b - s.a, width: W, glassSide: -1, wing: 0 });
      return mid;
    });
    chain(mainIds);
    if (rest.length) {
      const wing = run(rest, catalog, W / 2);
      const wingIds = wing.map((s) => {
        const mid = id(s.kind);
        mods.push({ id: mid, kind: s.kind, cx: W / 2, cy: (s.a + s.b) / 2, rot: 90, length: s.b - s.a, width: W, glassSide: 1, wing: 1 });
        return mid;
      });
      joins.push([mainIds[0]!, wingIds[0]!]);
      chain(wingIds);
    }
  } else {
    // Courtyard (U): core + living along +x, a wing up each end around a court open to +y.
    if (rest.length < 2) return undefined;
    const main = run(['core', 'living'], catalog, 0);
    const mainIds = main.map((s) => {
      const mid = id(s.kind);
      mods.push({ id: mid, kind: s.kind, cx: (s.a + s.b) / 2, cy: 0, rot: 0, length: s.b - s.a, width: W, glassSide: 1, wing: 0 });
      return mid;
    });
    chain(mainIds);
    const totalX = main.at(-1)!.b;
    const left = rest.filter((_, i) => i % 2 === 0), right = rest.filter((_, i) => i % 2 === 1);
    for (const [kinds, x, glass, wingNo, joinTo] of [
      [left, W / 2, -1, 1, mainIds[0]!],
      [right, totalX - W / 2, 1, 2, mainIds.at(-1)!],
    ] as const) {
      const wingIds = run(kinds, catalog, W / 2).map((s) => {
        const mid = id(s.kind);
        // rot 90: the module's own +y points to local -x, so each wing's glass faces the court.
        mods.push({ id: mid, kind: s.kind, cx: x, cy: (s.a + s.b) / 2, rot: 90, length: s.b - s.a, width: W, glassSide: glass, wing: wingNo });
        return mid;
      });
      joins.push([joinTo, wingIds[0]!]);
      chain(wingIds);
    }
  }
  return { parti, modules: recentre(mods), joins };
};
