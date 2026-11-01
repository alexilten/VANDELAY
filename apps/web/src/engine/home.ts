/**
 * Home options from the real Home engine.
 *
 * The brief answers become a prompt, the agent's keyword stand-in turns it into
 * an intent on an EXAMPLE site, and `@vandelay/engine-home` proposes three
 * options. Geometry and numbers come from the engine; the site is example data,
 * so the UI still labels everything as an example.
 */
import { optionsFromPrompt } from '@vandelay/agent';
import { RULES, type CheckResult, type HomeOption } from '@vandelay/engine-home';
import { EXAMPLE_CA_LOT, EXAMPLE_SITES, US_CA, type SiteIntent } from '@vandelay/kernel';
import type { Fact } from '../data/examples';
import type { OptionGeometry } from '../viewer/geometry';

export type CheckStatus = CheckResult['status'];

/** One check, ready for a "why?" panel. */
export interface CheckView {
  readonly id: string;
  readonly status: CheckStatus;
  readonly message: string;
  /** What the rule says and where its limit comes from. */
  readonly rule?: { readonly topic: string; readonly statement: string; readonly source: string; readonly kind: string };
  /** How the engine measured it. */
  readonly formula?: string;
  /** For cited rules: a sentence naming the code section. */
  readonly why?: string;
  readonly citations: readonly { readonly label: string; readonly url: string; readonly verification: 'primary' | 'secondary' | 'unverified' }[];
  /** Readings that are Vandelay's interpretation, not settled law. Shown as unverified. */
  readonly interpretations: readonly string[];
}

export interface LiveOption {
  readonly name: string;
  readonly headline: string;
  readonly headlineLabel: string;
  readonly metrics: readonly Fact[];
  readonly bestFit: boolean;
  readonly geometry: OptionGeometry;
  readonly checks: readonly CheckView[];
}

export interface LiveHome {
  readonly options: readonly [LiveOption, LiveOption, LiveOption];
  readonly site: readonly Fact[];
}

// Example site with example California lot facts, so ADU briefs get the cited state rules.
const SITE: SiteIntent = { ...EXAMPLE_SITES.slopeAlong, jurisdiction: EXAMPLE_CA_LOT };
const BEDS = ['one bedroom', 'two bedroom', 'three bedroom', 'four bedroom'];
const SQFT_PER_MM2 = 1 / 92_903.04;

/** Brief answers → words the engine's prompt reader understands. */
export function homePrompt(brief: string, picks: readonly number[]): string {
  const parts = [brief || 'A small home on a sloped lot'];
  parts.push(BEDS[picks[0] ?? 1] ?? 'two bedroom');
  if ((picks[1] ?? 1) === 0) parts.push('on a budget');
  if ((picks[2] ?? 1) === 1) parts.push('as a backyard ADU');
  return parts.join(', ');
}

const compass = (deg: number) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const m = (mm: number) => `${+(mm / 1000).toFixed(1)} m`;

function siteFacts(site: SiteIntent, adu: boolean): Fact[] {
  const xs = site.boundary.map((p) => p[0]);
  const ys = site.boundary.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs);
  const d = Math.max(...ys) - Math.min(...ys);
  const t = site.terrain;
  const slope = t.kind === 'plane' ? (t.slopePct === 0 ? 'Level' : `${t.slopePct}% to the ${compass(t.aspect)}`) : 'Surveyed grid';
  const s = site.zoning.setbacks;
  const facts: Fact[] = [
    ['Lot', `${m(w)} × ${m(d)}`],
    ['Slope', slope],
    ['Setbacks', `${m(s.front)} / ${m(s.side)} / ${m(s.rear)}`],
  ];
  if (adu && site.jurisdiction?.region === 'us-ca') facts.push(['Rules', 'California ADU law']);
  else if (site.zoning.maxHeight) facts.push(['Height limit', m(site.zoning.maxHeight)]);
  return facts;
}

const ORDER: Record<CheckStatus, number> = { fail: 0, warn: 1, review: 2, pass: 3, 'n/a': 4 };

// Titles for cited state rules, by id.
const CITED = new Map(US_CA.rules.map((r) => [r.id, r]));

export function checkView(c: CheckResult): CheckView {
  const engineRule = (RULES as Record<string, { topic: string; statement: string; source: string; kind: string } | undefined>)[c.ruleId];
  const cited = CITED.get(c.ruleId);
  const r = engineRule ?? (cited ? { topic: cited.title, statement: cited.summary, source: cited.kind === 'assumption' ? 'Vandelay assumption, not law' : US_CA.name, kind: cited.kind } : undefined);
  return {
    id: c.ruleId,
    status: c.status,
    message: c.message,
    ...(r ? { rule: { topic: r.topic, statement: r.statement, source: r.source, kind: r.kind } } : {}),
    ...(c.measured?.formula ? { formula: c.measured.formula } : {}),
    ...(c.why ? { why: c.why } : {}),
    citations: (c.citations ?? []).map((x) => ({ label: `${x.code} ${x.section}`, url: x.url, verification: x.verification })),
    interpretations: c.interpretations ?? [],
  };
}

function toLive(o: HomeOption, best: boolean): LiveOption {
  const r = o.result;
  const area = r.quantities.floorArea?.value ?? 0;
  const cost = r.quantities.costIndex?.value;
  const score = r.scores.overall?.value;
  const open = r.checks.filter((c) => c.status === 'warn' || c.status === 'fail' || c.status === 'review').length;
  const metrics: Fact[] = [];
  if (cost !== undefined) metrics.push(['Cost index', cost.toFixed(2)]);
  if (score !== undefined) metrics.push(['Score', `${Math.round(score * 100)} / 100`]);
  metrics.push(['Checks', open === 0 ? 'All pass' : `${open} to review`]);
  return {
    name: o.label,
    headline: `${Math.round(area * SQFT_PER_MM2).toLocaleString('en-US')} sf`,
    headlineLabel: 'floor area',
    metrics,
    bestFit: best,
    geometry: { ...r.geometry, example: true },
    checks: [...r.checks].sort((a, b) => ORDER[a.status] - ORDER[b.status]).map(checkView),
  };
}

/** Engine options (from the engine or from a signed result) → cards. The highest score is marked best fit. */
export function liveOptions(options: readonly HomeOption[]): LiveOption[] {
  const scores = options.map((o) => o.result.scores.overall?.value ?? 0);
  const best = scores.indexOf(Math.max(...scores));
  return options.map((o, i) => toLive(o, i === best));
}

export { siteFacts };

/** Three engine options for the brief, or null if the engine could not produce them. */
export function liveHome(brief: string, picks: readonly number[]): LiveHome | null {
  try {
    const { options } = optionsFromPrompt(homePrompt(brief, picks), SITE);
    if (!Array.isArray(options) || options.length < 3) return null;
    const live = liveOptions(options.slice(0, 3)) as unknown as LiveHome['options'];
    return { options: live, site: siteFacts(SITE, (picks[2] ?? 1) === 1) };
  } catch {
    return null;
  }
}
