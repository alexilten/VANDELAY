/**
 * Home options from the real Home engine.
 *
 * The brief answers become a prompt, the agent's keyword stand-in turns it into
 * an intent on an EXAMPLE site, and `@vandelay/engine-home` proposes three
 * options. Geometry and numbers come from the engine; the site is example data,
 * so the UI still labels everything as an example.
 */
import { optionsFromPrompt } from '@vandelay/agent';
import type { HomeOption } from '@vandelay/engine-home';
import { EXAMPLE_SITES, type SiteIntent } from '@vandelay/kernel';
import type { Fact } from '../data/examples';
import type { OptionGeometry } from '../viewer/geometry';

export interface LiveOption {
  readonly name: string;
  readonly headline: string;
  readonly headlineLabel: string;
  readonly metrics: readonly Fact[];
  readonly bestFit: boolean;
  readonly geometry: OptionGeometry;
}

export interface LiveHome {
  readonly options: readonly [LiveOption, LiveOption, LiveOption];
  readonly site: readonly Fact[];
}

const SITE: SiteIntent = EXAMPLE_SITES.slopeAlong;
const BEDS = ['one bedroom', 'two bedroom', 'three bedroom', 'four bedroom'];
const SQFT_PER_MM2 = 1 / 92_903.04;

/** Brief answers → words the engine's prompt reader understands. */
export function homePrompt(brief: string, picks: readonly number[]): string {
  const parts = [brief || 'A small home on a sloped lot'];
  parts.push(BEDS[picks[0] ?? 1] ?? 'two bedroom');
  if ((picks[1] ?? 1) === 0) parts.push('on a budget');
  return parts.join(', ');
}

const compass = (deg: number) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const m = (mm: number) => `${+(mm / 1000).toFixed(1)} m`;

function siteFacts(site: SiteIntent): Fact[] {
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
  if (site.zoning.maxHeight) facts.push(['Height limit', m(site.zoning.maxHeight)]);
  return facts;
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
  };
}

/** Three engine options for the brief, or null if the engine could not produce them. */
export function liveHome(brief: string, picks: readonly number[]): LiveHome | null {
  try {
    const { options } = optionsFromPrompt(homePrompt(brief, picks), SITE);
    if (!Array.isArray(options) || options.length < 3) return null;
    const scores = options.map((o) => o.result.scores.overall?.value ?? 0);
    const best = scores.indexOf(Math.max(...scores));
    const live = options.slice(0, 3).map((o, i) => toLive(o, i === best)) as unknown as LiveHome['options'];
    return { options: live, site: siteFacts(SITE) };
  } catch {
    return null;
  }
}
