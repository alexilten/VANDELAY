/**
 * Home engine v0 result types. Everything here is DERIVED from a Home intent
 * and never stored in it. All lengths in mm, site frame (+X east, +Y north,
 * +Z up), angles in degrees.
 */
import type { Citation, HomeIntent, Issue, JsonPointer, Parti, Point2, RuleReport, Terrain } from '@vandelay/kernel';

/** A number that can answer "why?": how it was computed, from which intent fields, under which rules. */
export interface Traced<T = number> {
  readonly value: T;
  readonly unit: 'mm' | 'mm2' | 'mm3' | 'count' | 'ratio' | 'score' | 'index';
  readonly formula: string;
  readonly reads: readonly JsonPointer[];
  readonly rules: readonly string[];
}

export type SolidRole =
  | 'module' | 'wall' | 'deck' | 'roof' | 'pier' | 'plinth' | 'glazing' | 'canopy' | 'stair' | 'bridge' | 'shutter';

/** The architectural palette (Olson Kundig-inspired): raw steel, weathering steel, timber, concrete, big glass. */
export type MaterialId = 'timber' | 'corten' | 'blackSteel' | 'concrete' | 'glass';

/** An oriented box. `size` = [along the rotated X, along the rotated Y, height]. */
export interface Solid {
  readonly id: string;
  readonly role: SolidRole;
  readonly material: MaterialId;
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number, number];
  /** Degrees about +Z, counter-clockwise from +X. */
  readonly rotation: number;
  /** Degrees about the solid's local X (shed roofs). */
  readonly tilt?: number;
  /** Which module this solid belongs to, when it belongs to one. */
  readonly module?: string;
  /** Expressive moving parts: a renderer may animate them. */
  readonly mechanism?: { readonly kind: 'slide'; readonly axis: readonly [number, number]; readonly travel: number };
}

export interface OptionGeometry {
  readonly site: { readonly boundary: readonly Point2[]; readonly terrain: Terrain; readonly buildable: readonly Point2[] };
  readonly solids: readonly Solid[];
}

export type ModuleKind = 'living' | 'core' | 'bed' | 'bath';

export interface PlacedModule {
  readonly id: string;
  readonly kind: ModuleKind;
  readonly catalogId: string;
  /** Plan centre and floor level (finished floor) in the site frame. */
  readonly center: readonly [number, number, number];
  readonly length: number;
  readonly width: number;
  /** Degrees about +Z; the module's length runs along its rotated X. */
  readonly rotation: number;
  readonly pod: number;
  /** Footprint corners, counter-clockwise. */
  readonly footprint: readonly Point2[];
}

export interface Pier {
  readonly id: string;
  readonly at: Point2;
  readonly ground: number;
  readonly top: number;
  readonly height: number;
  readonly module: string;
}

/** 'n/a' = the rule was skipped, and the message says why. */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'review' | 'n/a';

export interface CheckResult {
  readonly ruleId: string;
  readonly status: CheckStatus;
  /** One plain sentence. */
  readonly message: string;
  /** How the engine measured the value (formula, intent fields read, rules applied). */
  readonly measured?: Traced;
  readonly limit?: number;
  /** For cited rules: where the limit comes from, naming the code section. */
  readonly why?: string;
  readonly citations?: readonly Citation[];
  /** Readings this result depends on that are Vandelay's interpretation, not settled law. */
  readonly interpretations?: readonly string[];
}

export type ScoreId = 'view' | 'sun' | 'privacy' | 'cost' | 'lessGrading' | 'access' | 'overall';

export interface HomeResult {
  readonly ok: true;
  readonly intentHash: string;
  readonly engine: { readonly id: 'home'; readonly version: string };
  /** What the engine chose for every `'auto'` field. */
  readonly resolved: {
    readonly parti: Parti;
    readonly anchor: Point2;
    readonly rotation: number;
    readonly foundation: 'piers' | 'steppedPods';
    readonly floorDatums: readonly number[];
    readonly maxStep: number;
  };
  readonly modules: readonly PlacedModule[];
  readonly piers: readonly Pier[];
  readonly geometry: OptionGeometry;
  readonly quantities: Readonly<Record<string, Traced>>;
  readonly checks: readonly CheckResult[];
  readonly scores: Readonly<Partial<Record<ScoreId, Traced>>>;
  /** Summary of the jurisdiction's cited rules, when the intent names a jurisdiction with rules loaded. */
  readonly rules?: Omit<RuleReport, 'results'>;
  /** True when no check failed. Warnings and review items can still be present. */
  readonly feasible: boolean;
}

export interface HomeError {
  readonly ok: false;
  readonly issues: readonly Issue[];
}

/** One of the three choices shown to a person: an intent with every 'auto' resolved, and its result. */
export interface HomeOption {
  readonly label: string;
  readonly intent: HomeIntent;
  readonly result: HomeResult;
}
