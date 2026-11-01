/**
 * The narrow input every ADU rule reads. It is deliberately smaller than the
 * Home intent: the Home engine (or any other caller) derives these facts from
 * its own model and passes them in, so rules never depend on intent internals.
 *
 * Lengths in mm, areas in mm². Use `ft()` / `sqft()` from `./types.ts` to
 * convert from US units.
 */

/**
 * - `detached`: new free-standing structure.
 * - `attached`: new construction attached to the primary dwelling.
 * - `conversion`: inside existing (or proposed) space of the house or an existing accessory structure, e.g. a garage.
 * - `jadu`: junior ADU, entirely inside a single-family residence.
 */
export const ADU_KINDS = ['detached', 'attached', 'conversion', 'jadu'] as const;
export type AduKind = (typeof ADU_KINDS)[number];

export interface AduProposal {
  readonly kind: AduKind;
  /** Interior livable space (the measure SB 543 uses for the 500 / 800 / 850 / 1,000 sq ft figures). */
  readonly interiorLivableArea: number;
  /** Total floor area (the measure for the 1,200 sq ft and 50% caps). Defaults to `interiorLivableArea`. */
  readonly totalFloorArea?: number;
  /** Ground footprint, for lot coverage. */
  readonly footprintArea?: number;
  readonly bedrooms: number;
  /** Building height, measured the way the local code measures it. Not needed for conversions or JADUs. */
  readonly height?: number;
  readonly stories?: number;
  /** Shortest distance from the ADU to each kind of lot line. */
  readonly clearances?: { readonly front?: number; readonly side?: number; readonly rear?: number };
  /** For conversions: floor area added beyond the existing structure's dimensions. */
  readonly expansionArea?: number;
}

export interface LotFacts {
  /** How the lot is zoned. */
  readonly zoning: 'single-family' | 'multifamily' | 'mixed-use' | 'other';
  /** The primary dwelling on the lot, existing or proposed. */
  readonly primary: 'single-family' | 'multifamily' | 'none';
  /** True when the primary dwelling already exists (not just proposed). */
  readonly primaryExists: boolean;
  /** Multifamily primary with more than one story. */
  readonly primaryMultistory?: boolean;
  /** Total floor area of the existing primary dwelling. */
  readonly primaryFloorArea?: number;
  readonly lotArea?: number;
  /** Footprint of buildings already on the lot, not counting the ADU. */
  readonly existingFootprint?: number;
  /**
   * Within one-half mile walking distance of a major transit stop or a
   * high-quality transit corridor. Leave undefined when unknown; rules then say `review`.
   */
  readonly nearTransit?: boolean;
  /** The ADU roof pitch matches the primary dwelling's. */
  readonly roofPitchMatchesPrimary?: boolean;
}

/**
 * Local standards, when known. Names match the Home intent's `site.zoning`
 * so an adapter is a straight copy. Leave a field out when unknown.
 */
export interface LocalStandards {
  readonly setbacks?: { readonly front?: number; readonly side?: number; readonly rear?: number };
  /** Local ADU height limit. */
  readonly maxHeight?: number;
  /** Fraction of lot area, 0..1. */
  readonly maxCoverage?: number;
  /** Local maximum ADU size, interior livable space. */
  readonly maxAduArea?: number;
  /** Height limit of the zone for the primary dwelling (governs attached ADUs). */
  readonly primaryZoneHeight?: number;
  /** Where these values came from, e.g. "City of X Municipal Code § 17.20" or "entered by user". */
  readonly source?: string;
}

export interface AduInput {
  readonly adu: AduProposal;
  readonly lot: LotFacts;
  readonly local?: LocalStandards;
}
