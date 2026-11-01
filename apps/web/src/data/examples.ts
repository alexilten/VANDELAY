import type { CategoryId } from '../design/categories';

/*
 * EXAMPLE DATA ONLY.
 * Every figure here is illustrative, copied from the homepage prototype. None of
 * it comes from a real site, code check, cost model or vendor. The UI labels
 * all of it as an example. Replace with engine output; do not quote as real.
 */

export type Fact = readonly [label: string, value: string];
export type Question = { label: string; options: readonly string[]; initial: number };
export type ExampleOption = {
  name: string;
  headline: string;
  headlineLabel: string;
  metrics: readonly Fact[];
  bestFit?: boolean;
};
export type ExampleCategory = {
  placeholder: string;
  site: readonly Fact[];
  questions: readonly Question[];
  options: readonly [ExampleOption, ExampleOption, ExampleOption];
};

export const EXAMPLES: Record<CategoryId, ExampleCategory> = {
  home: {
    placeholder: 'A small home on a sloped lot',
    site: [['Lot', '50 × 100 ft'], ['Slope', '6% to the west'], ['Zoning', 'Residential'], ['Allowed', 'ADU by right']],
    questions: [
      { label: 'Size', options: ['1 bed', '2 bed', '3 bed', '4+ bed'], initial: 1 },
      { label: 'Budget', options: ['< $250k', '$250–400k', '$400–600k', '$600k+'], initial: 1 },
      { label: 'Built', options: ['Modular', 'Panelised', 'Site-built', 'Best fit'], initial: 3 },
    ],
    options: [
      { name: 'Two modules on the slope', headline: '$338k', headlineLabel: 'estimate', metrics: [['Area', '940 sf'], ['Ready in', '18 weeks'], ['Zoning', 'Fits']], bestFit: true },
      { name: 'Panel cottage with loft', headline: '$356k', headlineLabel: 'estimate', metrics: [['Area', '910 sf'], ['Ready in', '22 weeks'], ['Zoning', 'Fits']] },
      { name: 'One module and a deck', headline: '$264k', headlineLabel: 'estimate', metrics: [['Area', '720 sf'], ['Ready in', '14 weeks'], ['Zoning', 'Fits']] },
    ],
  },
  business: {
    placeholder: 'A café with a terrace',
    site: [['Lot', '60 × 120 ft corner'], ['Slope', 'Nearly level'], ['Zoning', 'Commercial'], ['Allowed', 'Food and retail']],
    questions: [
      { label: 'Type', options: ['Cafe', 'Shop', 'Clinic', 'Office'], initial: 0 },
      { label: 'People', options: ['Up to 20', '20–50', '50–100', '100+'], initial: 1 },
      { label: 'Start from', options: ['New build', 'Existing space', 'Prefab'], initial: 2 },
    ],
    options: [
      { name: 'Pavilion and terrace', headline: '$1.1M', headlineLabel: 'estimate', metrics: [['Area', '1,850 sf'], ['Seats', '42 + 24 outside'], ['Open in', '7 months']], bestFit: true },
      { name: 'Two storeys, flat above', headline: '$1.9M', headlineLabel: 'estimate', metrics: [['Area', '3,200 sf'], ['Seats', '38'], ['Open in', '11 months']] },
      { name: 'Kiosk and garden', headline: '$410k', headlineLabel: 'estimate', metrics: [['Area', '620 sf'], ['Seats', '8'], ['Open in', '4 months']] },
    ],
  },
  'mixed-use': {
    placeholder: 'Apartments over shops',
    site: [['Lot', '100 × 150 ft'], ['Slope', '4% to the street'], ['Zoning', 'Mixed-use'], ['Allowed', 'Up to 8 floors']],
    questions: [
      { label: 'Mostly', options: ['Homes', 'Offices', 'Hotel', 'A mix'], initial: 0 },
      { label: 'Ground floor', options: ['Shops', 'Lobby only', 'Homes'], initial: 0 },
      { label: 'Height', options: ['Low-rise', 'Mid-rise', 'Tower', 'Max allowed'], initial: 1 },
    ],
    options: [
      { name: '6 floors over shops', headline: '64', headlineLabel: 'homes', metrics: [['Retail', '7,800 sf'], ['Cost per home', '$398k'], ['Zoning', 'Fits']], bestFit: true },
      { name: '8 floors, mass timber', headline: '82', headlineLabel: 'homes', metrics: [['Retail', '6,200 sf'], ['Cost per home', '$421k'], ['Carbon', '−24%']] },
      { name: 'Townhouses and a café', headline: '14', headlineLabel: 'homes', metrics: [['Retail', '1,600 sf'], ['Cost per home', '$455k'], ['Zoning', 'Fits']] },
    ],
  },
  venue: {
    placeholder: 'A 28,000-seat soccer stadium',
    site: [['Site', '22 acres'], ['Slope', '1.5% to the river'], ['Zoning', 'Sports district'], ['Transit', '400 m away']],
    questions: [
      { label: 'Sport', options: ['Soccer', 'Football', 'Basketball', 'Hockey'], initial: 0 },
      { label: 'Seats', options: ['< 20k', '20–35k', '35–60k', '60k+'], initial: 1 },
      { label: 'Roof', options: ['Open', 'Canopy', 'Retractable', 'Closed'], initial: 1 },
    ],
    options: [
      { name: 'Two tiers with a club level', headline: '28,400', headlineLabel: 'seats', metrics: [['Premium', '11%'], ['Covered', '92%'], ['Sightlines', 'All pass']], bestFit: true },
      { name: 'Steep home end', headline: '26,900', headlineLabel: 'seats', metrics: [['Premium', '8%'], ['Covered', '88%'], ['Sightlines', 'All pass']] },
      { name: 'Open to the skyline', headline: '24,200', headlineLabel: 'seats', metrics: [['Premium', '10%'], ['Covered', '95%'], ['Sightlines', 'All pass']] },
    ],
  },
};
