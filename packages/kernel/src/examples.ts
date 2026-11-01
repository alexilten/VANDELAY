/**
 * Example sites and a starter Home intent for tests, demos and the homepage.
 *
 * EXAMPLES ONLY. These are not real parcels, real zoning or real terrain.
 * Every site field is tagged `by: 'example'` in `sources`, so the UI and any
 * report can say so.
 */
import { createHomeIntent, type Brief, type HomeIntent, type Jurisdiction, type SiteIntent, type Source } from './home-intent.ts';

const EXAMPLE: Source = { by: 'example', note: 'example value, not real data' };

const LOT_W = 18000;
const LOT_D = 36000;
const lot = [[0, 0], [LOT_W, 0], [LOT_W, LOT_D], [0, LOT_D]] as const;
const zoning: SiteIntent['zoning'] = { setbacks: { front: 6000, side: 1500, rear: 4500 }, maxHeight: 9000, maxCoverage: 0.5 };

/** Cross-slope site as a height grid: falls ~30% to the east with a gentle swale, sampled every 3 m. */
const crossGrid = (): SiteIntent['terrain'] => {
  const spacing = 3000;
  const nx = LOT_W / spacing + 1;
  const ny = LOT_D / spacing + 1;
  const z: number[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const x = i * spacing, y = j * spacing;
      z.push(Math.round(-0.3 * x - 0.04 * y + 600 * Math.sin((Math.PI * y) / LOT_D)));
    }
  }
  return { kind: 'grid', origin: [0, 0], spacing, nx, ny, z };
};

export const EXAMPLE_SITES = {
  flat: {
    datum: 'example site datum',
    boundary: lot,
    frontEdge: 0,
    terrain: { kind: 'plane', z0: 0, slopePct: 0, aspect: 180 },
    zoning,
    access: { point: [LOT_W / 2, 0] },
    view: { bearing: 180 },
  },
  /** Falls 15% toward the street (south), so the view and the slope agree. */
  slopeAlong: {
    datum: 'example site datum',
    boundary: lot,
    frontEdge: 0,
    terrain: { kind: 'plane', z0: 0, slopePct: 15, aspect: 180 },
    zoning,
    access: { point: [LOT_W / 2, 0] },
    view: { bearing: 180 },
  },
  slopeCross: {
    datum: 'example site datum',
    boundary: lot,
    frontEdge: 0,
    terrain: crossGrid(),
    zoning,
    access: { point: [LOT_W / 2, 0] },
    view: { bearing: 90 },
  },
} as const satisfies Record<string, SiteIntent>;

export type ExampleSiteId = keyof typeof EXAMPLE_SITES;

export const EXAMPLE_BRIEF: Brief = {
  prompt: 'A small two-bedroom home on my hillside that opens to the view',
  bedrooms: 2,
  bathrooms: 1,
  area: { target: 85_000_000 },
  maxStories: 1,
  stepFreeEntry: true,
  priorities: { view: 1, lessGrading: 0.6 },
};

/** A complete, valid Home intent on an example site, with every design choice left to the engine. */
export const exampleHomeIntent = (site: ExampleSiteId = 'slopeAlong', brief: Brief = EXAMPLE_BRIEF, seed = 1): HomeIntent =>
  createHomeIntent({
    id: `example-${site}`,
    seed,
    site: EXAMPLE_SITES[site],
    brief,
    design: {
      catalog: { id: 'example.box-modules', version: '0' },
      parti: 'bar',
      placement: { anchor: 'auto', rotation: 'auto' },
      foundation: 'auto',
      levels: { maxStep: 'auto', floorDatum: 'auto' },
    },
    sources: {
      '/body/site': EXAMPLE,
      '/body/design/catalog': { by: 'default', note: 'generic example catalog until a vendor catalog is signed' },
    },
  });

/** Example California lot facts: a single-family lot with an existing home. Transit proximity left unknown. */
export const EXAMPLE_CA_LOT: Jurisdiction = {
  region: 'us-ca',
  lot: { zoning: 'single-family', primary: 'single-family', primaryExists: true },
};

export const EXAMPLE_ADU_BRIEF: Brief = {
  prompt: 'A one-bedroom backyard ADU on my hillside, step-free',
  bedrooms: 1,
  bathrooms: 1,
  area: {},
  maxStories: 1,
  stepFreeEntry: true,
  priorities: { view: 1, lessGrading: 0.6 },
  use: 'adu',
};

/** An example ADU intent on an example site in California (state rules only; the zoning values are examples). */
export const exampleAduIntent = (site: ExampleSiteId = 'slopeAlong', seed = 1): HomeIntent => {
  const base = exampleHomeIntent(site, EXAMPLE_ADU_BRIEF, seed);
  return createHomeIntent({
    ...base.body,
    id: `example-adu-${site}`,
    site: { ...base.body.site, jurisdiction: EXAMPLE_CA_LOT },
  });
};
