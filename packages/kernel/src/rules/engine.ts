/**
 * Runs a region's rules (parents first) and summarises the results.
 * Pure and deterministic: same input, same report, same order.
 */
import { STATUS_SEVERITY, type CheckResult, type Region, type RuleStatus } from './types.ts';

export interface RuleReport {
  readonly region: string;
  /** Region chain that ran, root first, e.g. ["us-ca", "us-ca.example-city"]. */
  readonly regions: readonly string[];
  readonly coverage: readonly string[];
  /** Worst status among applicable results; `n/a` only if nothing applied. */
  readonly overall: RuleStatus;
  readonly counts: Readonly<Record<RuleStatus, number>>;
  readonly results: readonly CheckResult[];
}

export type RegionLookup<T> = (id: string) => Region<T> | undefined;

/** Builds a lookup from a list of regions. Throws on duplicate ids or rule ids. */
export const regionLookup = <T>(regions: readonly Region<T>[]): RegionLookup<T> => {
  const byId = new Map<string, Region<T>>();
  const ruleIds = new Set<string>();
  for (const r of regions) {
    if (byId.has(r.id)) throw new Error(`duplicate region id "${r.id}"`);
    byId.set(r.id, r);
    for (const rule of r.rules) {
      if (ruleIds.has(rule.id)) throw new Error(`duplicate rule id "${rule.id}"`);
      if (!rule.id.startsWith(`${r.id}.`) && !rule.id.startsWith('vandelay.')) throw new Error(`rule "${rule.id}" must start with its region id "${r.id}."`);
      ruleIds.add(rule.id);
    }
  }
  return (id) => byId.get(id);
};

const chain = <T>(region: Region<T>, lookup?: RegionLookup<T>): Region<T>[] => {
  const out: Region<T>[] = [];
  const seen = new Set<string>();
  for (let r: Region<T> | undefined = region; r; r = r.parent ? lookup?.(r.parent) : undefined) {
    if (seen.has(r.id)) throw new Error(`region parent cycle at "${r.id}"`);
    seen.add(r.id);
    out.unshift(r);
    if (r.parent && !lookup?.(r.parent)) throw new Error(`region "${r.id}" names parent "${r.parent}", which is not loaded`);
  }
  return out;
};

export const runRules = <T>(region: Region<T>, input: T, lookup?: RegionLookup<T>): RuleReport => {
  const regions = chain(region, lookup);
  const results = regions.flatMap((r) => r.rules.map((rule) => rule.check(input)));
  const counts: Record<RuleStatus, number> = { pass: 0, warn: 0, fail: 0, review: 0, 'n/a': 0 };
  let overall: RuleStatus = 'n/a';
  for (const res of results) {
    counts[res.status]++;
    if (STATUS_SEVERITY[res.status] > STATUS_SEVERITY[overall]) overall = res.status;
  }
  return { region: region.id, regions: regions.map((r) => r.id), coverage: regions.map((r) => r.coverage), overall, counts, results };
};

/** Multi-line plain-text "why?" for one result, for logs, tests and the agent. */
export const explain = (r: CheckResult): string =>
  [
    `[${r.status.toUpperCase()}] ${r.message}`,
    `Why: ${r.why}`,
    ...r.interpretations.map((t) => `Interpretation (unverified): ${t}`),
    ...r.citations.map((c) => `Source: ${c.code} ${c.section}, ${c.title}. ${c.url} (${c.verification}, checked ${c.checkedOn})`),
  ].join('\n');
