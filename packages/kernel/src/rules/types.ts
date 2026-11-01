/**
 * Cited rules: the shared vocabulary for zoning and code checks.
 *
 * A rule is a pure function from facts about a proposal to a result that says
 * pass / warn / fail / review / n/a, the numbers it compared, a plain-English
 * message and a "why?" that names the law it comes from. Every rule carries
 * the citations it relies on, and every citation says how well it was checked.
 *
 * Rules are grouped into regions (a state, a county, a city). A region can
 * name a parent, so a city's rules run on top of its state's baseline. Nothing
 * here is California-specific: California lives in `regions/us-ca/`.
 *
 * Units: lengths in mm, areas in mm², like the rest of the kernel.
 */

/**
 * - `pass`: meets the rule.
 * - `warn`: allowed, but worth knowing (e.g. misses a faster approval path).
 * - `fail`: does not meet the rule.
 * - `review`: cannot be decided from the facts given; a person or local code must decide.
 * - `n/a`: the rule does not apply to this proposal; `message` says why.
 */
export const RULE_STATUSES = ['pass', 'warn', 'fail', 'review', 'n/a'] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

/** Severity order used to summarise a report. Higher is worse. */
export const STATUS_SEVERITY: Readonly<Record<RuleStatus, number>> = { 'n/a': 0, pass: 1, warn: 2, review: 3, fail: 4 };

/**
 * How a citation was checked.
 * - `primary`: read on the official publisher's site (e.g. leginfo.legislature.ca.gov).
 * - `secondary`: read on a reputable mirror or an agency memo quoting the text; official link given but not opened.
 * - `unverified`: believed true but not yet checked against any text. Must never be presented as settled law.
 */
export type Verification = 'primary' | 'secondary' | 'unverified';

export interface Citation {
  /** Stable key, e.g. "us-ca.gov.66321". */
  readonly id: string;
  /** Who made the law, e.g. "State of California". */
  readonly jurisdiction: string;
  /** Code name, e.g. "California Government Code". */
  readonly code: string;
  /** Section with subdivision, e.g. "§ 66321(b)(4)". */
  readonly section: string;
  /** Short human title of the provision. */
  readonly title: string;
  /** Official URL for the section. */
  readonly url: string;
  /** Where the text was actually read, if not `url`. */
  readonly readAt?: string;
  readonly verification: Verification;
  /** ISO date the text was last read. */
  readonly checkedOn: string;
  /** The law version read, e.g. "as amended by SB 543 (Stats. 2025, ch. 520), operative 2026-01-01". */
  readonly version?: string;
  readonly note?: string;
}

export type RuleUnit = 'mm' | 'mm2' | 'ratio' | 'count';

/**
 * - `state-floor`: the state guarantees at least this; a local code may be more generous but not stricter.
 * - `state-cap`: the state sets an outer limit.
 * - `local`: a local jurisdiction's own standard.
 * - `assumption`: a Vandelay engineering assumption, not law. Always `unverified`.
 */
export type RuleKind = 'state-floor' | 'state-cap' | 'local' | 'assumption';

export type RuleTopic = 'eligibility' | 'height' | 'size' | 'setback' | 'coverage' | 'parking' | 'approval-path';

export interface CheckResult {
  readonly ruleId: string;
  readonly status: RuleStatus;
  /** What the proposal has, in `unit`. */
  readonly measured?: number;
  /** The governing limit, in `unit`. */
  readonly limit?: number;
  readonly unit?: RuleUnit;
  /** One plain sentence for the widget, e.g. "15.0 ft tall, within the 16 ft state allowance." */
  readonly message: string;
  /** The "why?": where the limit comes from and how it was applied, naming the code section. */
  readonly why: string;
  readonly citations: readonly Citation[];
  /**
   * Readings of the law this result depends on that are Vandelay's interpretation
   * and not confirmed by an agency or court. Empty when the result follows the text directly.
   */
  readonly interpretations: readonly string[];
}

export interface Rule<TInput> {
  /** Dotted, region-prefixed, stable forever: "us-ca.adu.height.detached". */
  readonly id: string;
  readonly region: string;
  readonly topic: RuleTopic;
  readonly kind: RuleKind;
  /** Short title for lists. */
  readonly title: string;
  /** One-paragraph plain-English statement of the rule. */
  readonly summary: string;
  readonly citations: readonly Citation[];
  readonly check: (input: TInput) => CheckResult;
}

export interface Region<TInput> {
  /** Lowercase ISO-3166-style id with optional local suffix: "us-ca", "us-ca.los-angeles". */
  readonly id: string;
  readonly name: string;
  /** Rules of the parent run first. */
  readonly parent?: string;
  /** Plain-English status line, e.g. "State baseline only; local ordinances not loaded". */
  readonly coverage: string;
  readonly rules: readonly Rule<TInput>[];
}

// ── unit helpers ─────────────────────────────────────────────────────────────

/** Exact by definition: 1 ft = 304.8 mm. */
export const MM_PER_FT = 304.8;
/** Exact by definition: 1 sq ft = 92 903.04 mm². */
export const MM2_PER_SQFT = MM_PER_FT * MM_PER_FT;

export const ft = (feet: number): number => feet * MM_PER_FT;
export const sqft = (squareFeet: number): number => squareFeet * MM2_PER_SQFT;
export const toFt = (mm: number): number => mm / MM_PER_FT;
export const toSqft = (mm2: number): number => mm2 / MM2_PER_SQFT;

/** "16.0 ft". One decimal, deterministic. */
export const fmtFt = (mm: number): string => `${toFt(mm).toFixed(1)} ft`;
/** "800 sq ft". Whole square feet. */
export const fmtSqft = (mm2: number): string => `${groupThousands(Math.round(toSqft(mm2)))} sq ft`;

/** 1200 → "1,200". Locale-free so output is identical everywhere. */
const groupThousands = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
/** "42%". */
export const fmtPct = (ratio: number): string => `${(ratio * 100).toFixed(0)}%`;

/** Tolerances so a value exactly at a limit, after unit conversion, counts as meeting it. */
export const EPS_MM = 0.01;
export const EPS_MM2 = 1;
export const atMost = (value: number, limit: number, eps: number): boolean => value <= limit + eps;
export const atLeast = (value: number, limit: number, eps: number): boolean => value >= limit - eps;

/** "Cal. Gov. Code § 66321(b)(4)(A)" style short cite for messages. */
export const cite = (c: Citation, sub = ''): string => `${c.code} ${c.section}${sub}`;
