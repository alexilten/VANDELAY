/**
 * EXAMPLE module catalog and material palette.
 *
 * The dimensions are examples for v0, not any vendor's product and not checked
 * against transport or code limits. A real vendor catalog replaces this in
 * Phase 1 under its own id and version.
 *
 * Architecture standard: an Olson Kundig-inspired sensibility. Raw and
 * blackened steel, weathering steel, timber, board-formed concrete and big
 * glass; homes that sit lightly into the slope on concrete piers; expressive
 * mechanical parts (sliding steel shutters, a steel entry bridge). Inspired by
 * the approach only: no specific project is reproduced.
 */
import type { MaterialId, ModuleKind } from './types.ts';

export interface ModuleSpec {
  readonly kind: ModuleKind;
  readonly name: string;
  /** Outside dimensions in mm. Length runs along the module's own X. */
  readonly length: number;
  readonly width: number;
  /** Finished floor to top of roof structure. 3200 leaves about a 2.7 m ceiling under a 250 mm roof (example). */
  readonly height: number;
  /** Share of the glass side that is glazed, 0..1. */
  readonly glazing: number;
  /** Relative cost weight per module (example weights, not prices). */
  readonly costUnits: number;
}

export interface Catalog {
  readonly id: string;
  readonly version: string;
  readonly example: true;
  readonly modules: Readonly<Record<ModuleKind, ModuleSpec>>;
  /** Floor structure depth below finished floor. */
  readonly floorDepth: number;
  readonly wall: number;
  readonly roof: { readonly thickness: number; readonly overhangGlass: number; readonly overhangOther: number };
  /** 'downhill': the living deck (and its glass) goes on whichever long side the ground falls away from, so the floor can sit lower. */
  readonly deck: { readonly depth: number; readonly side: 'glass' | 'downhill' };
  readonly pier: { readonly size: number; readonly spacing: number };
  /** Relative cost weights for site work, per metre of pier, bridge or stair (example weights). */
  readonly costPerMetre: { readonly pier: number; readonly bridge: number; readonly stair: number };
}

export const EXAMPLE_CATALOG: Catalog = {
  id: 'example.box-modules',
  version: '0',
  example: true,
  modules: {
    living: { kind: 'living', name: 'Living and dining', length: 8400, width: 4200, height: 3200, glazing: 0.85, costUnits: 10 },
    core: { kind: 'core', name: 'Kitchen, bath and laundry', length: 6000, width: 4200, height: 3200, glazing: 0.3, costUnits: 11 },
    bed: { kind: 'bed', name: 'Bedroom', length: 4800, width: 4200, height: 3200, glazing: 0.5, costUnits: 6 },
    bath: { kind: 'bath', name: 'Bath', length: 3000, width: 4200, height: 3200, glazing: 0.2, costUnits: 5 },
  },
  floorDepth: 300,
  wall: 150,
  roof: { thickness: 250, overhangGlass: 900, overhangOther: 300 },
  deck: { depth: 2400, side: 'downhill' },
  pier: { size: 450, spacing: 3000 },
  costPerMetre: { pier: 0.15, bridge: 0.6, stair: 0.4 },
};

export const CATALOGS: Readonly<Record<string, Catalog>> = { [`${EXAMPLE_CATALOG.id}@${EXAMPLE_CATALOG.version}`]: EXAMPLE_CATALOG };

export const findCatalog = (id: string, version: string): Catalog | undefined => CATALOGS[`${id}@${version}`];

/** Render hints for each material. Plain data; the web app maps them to its own materials. */
export interface MaterialSpec {
  readonly id: MaterialId;
  readonly name: string;
  /** sRGB hex. */
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly opacity: number;
}

export const MATERIALS: Readonly<Record<MaterialId, MaterialSpec>> = {
  timber: { id: 'timber', name: 'Vertical timber cladding, oiled', color: '#8a6446', roughness: 0.8, metalness: 0, opacity: 1 },
  corten: { id: 'corten', name: 'Weathering steel', color: '#7b3f22', roughness: 0.7, metalness: 0.35, opacity: 1 },
  blackSteel: { id: 'blackSteel', name: 'Blackened steel', color: '#262626', roughness: 0.45, metalness: 0.7, opacity: 1 },
  concrete: { id: 'concrete', name: 'Board-formed concrete', color: '#9b978f', roughness: 0.9, metalness: 0, opacity: 1 },
  glass: { id: 'glass', name: 'Low-iron glass', color: '#b7c9cc', roughness: 0.05, metalness: 0, opacity: 0.3 },
};
