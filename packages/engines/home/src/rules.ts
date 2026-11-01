/**
 * Rules the Home engine v0 checks against.
 *
 * In v0 nothing here is from a building code. Limits come either from the
 * intent (zoning values the user entered, or examples) or from Vandelay
 * assumptions, labelled as such, until an engineer, a vendor and a sourced
 * code reading replace them. The cited kernel rules library will take over
 * these ids when it lands. Ids follow its scheme: dotted, prefixed 'vandelay.'
 * for Vandelay's own assumptions and for checks against intent values.
 */
export type RuleKind = 'governing' | 'guidance' | 'assumption' | 'engineer-review';

export interface Rule {
  readonly id: string;
  readonly topic: string;
  readonly statement: string;
  readonly kind: RuleKind;
  readonly source: string;
  readonly verification: 'checked' | 'recall' | 'n/a';
  /** Default limit, when the rule has one (mm unless stated). */
  readonly value?: number;
}

const ASSUMPTION = 'Vandelay v0 assumption; not from a code, an engineer or a vendor';
const INTENT = 'Intent zoning values (entered by the user, or example values)';

export const RULES = {
  'vandelay.zoning.setbacks': {
    id: 'vandelay.zoning.setbacks', topic: 'Setbacks', kind: 'governing', source: INTENT, verification: 'n/a',
    statement: 'Every module, deck and pier sits inside the lot after the front, side and rear setbacks.',
  },
  'vandelay.assumption.height-measurement': {
    id: 'vandelay.assumption.height-measurement', topic: 'Height', kind: 'assumption', source: `${INTENT}; measuring method is an assumption`, verification: 'n/a',
    statement: 'Highest roof point, measured above the lowest existing grade under the footprint, is at or under the zoning height.',
  },
  'vandelay.zoning.coverage': {
    id: 'vandelay.zoning.coverage', topic: 'Lot coverage', kind: 'governing', source: INTENT, verification: 'n/a',
    statement: 'Module footprint area over lot area is at or under the zoning maximum. Decks are not counted (assumption).',
  },
  'vandelay.program.area': {
    id: 'vandelay.program.area', topic: 'Program', kind: 'assumption', source: 'The brief', verification: 'n/a',
    statement: 'Floor area is within 25% of the brief target and inside any min and max.', value: 0.25,
  },
  'vandelay.assumption.pier-height': {
    id: 'vandelay.assumption.pier-height', topic: 'Pier height', kind: 'assumption', source: ASSUMPTION, verification: 'n/a',
    statement: 'The tallest pier, ground to floor underside, is at or under the limit.', value: 3600,
  },
  'vandelay.assumption.floor-clearance': {
    id: 'vandelay.assumption.floor-clearance', topic: 'Floor clearance', kind: 'assumption', source: ASSUMPTION, verification: 'n/a',
    statement: 'The floor underside clears existing grade everywhere under the module by at least this much.', value: 450,
  },
  'vandelay.assumption.pod-step': {
    id: 'vandelay.assumption.pod-step', topic: 'Steps between pods', kind: 'assumption', source: ASSUMPTION, verification: 'n/a',
    statement: 'The floor step between adjoining pods is at or under the limit, with a stair where there is any step.', value: 1200,
  },
  'vandelay.assumption.step-free-bridge': {
    id: 'vandelay.assumption.step-free-bridge', topic: 'Step-free entry', kind: 'assumption', source: ASSUMPTION, verification: 'n/a',
    statement: 'When the brief asks for step-free entry, a level bridge no longer than this reaches existing grade from the entry floor.', value: 9000,
  },
  'vandelay.jurisdiction.loaded': {
    id: 'vandelay.jurisdiction.loaded', topic: 'Jurisdiction rules', kind: 'engineer-review', source: 'The cited rules library (packages/kernel/src/rules)', verification: 'n/a',
    statement: 'Says when the intent names a jurisdiction whose rules for this use are not loaded yet, so only intent zoning values were checked.',
  },
  'vandelay.review.structure': {
    id: 'vandelay.review.structure', topic: 'Structure and soils', kind: 'engineer-review', source: 'Always referred to a licensed engineer', verification: 'n/a',
    statement: 'Pier sizes, bracing, footings and soils are conceptual and need engineering.',
  },
  'vandelay.review.delivery': {
    id: 'vandelay.review.delivery', topic: 'Delivery', kind: 'engineer-review', source: 'Always referred to the vendor and a crane operator', verification: 'n/a',
    statement: 'Module delivery route and crane reach are not checked in v0.',
  },
} as const satisfies Record<string, Rule>;

export type RuleId = keyof typeof RULES;
