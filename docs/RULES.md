# Cited rules library

`packages/kernel/src/rules/` holds Vandelay's zoning and code checks. Every check returns pass, warn, fail, review or n/a, the numbers it compared, a plain sentence for the UI, and a **why?** that names the code section it comes from. Every rule carries its citations, and every citation records how it was verified.

This is not legal advice. Local ordinances, HCD guidance and court decisions can change how these rules apply. The library says `review` when it can't decide from the facts it has.

## How it fits

```
Home engine ──(derives AduInput)──▶ runRules(region, input) ──▶ RuleReport ──▶ UI widget / agent "why?"
```

- **Narrow input.** Rules read `AduInput` (`adu.ts`): kind, interior livable area, total floor area, footprint, bedrooms, height, clearances to the lot lines, and lot facts. They never read the intent directly, so the intent schema can change without touching the rules. `LocalStandards` uses the same names as the intent's `site.zoning` (`setbacks.front/side/rear`, `maxHeight`, `maxCoverage`).
- **Region-pluggable.** A `Region` has an id (`us-ca`), an optional `parent`, and rules. A city plugs in as a child region (`us-ca.some-city`, `parent: 'us-ca'`). `runRules` runs the parent's rules first, then the city's. Rule ids must start with their region id, or with `vandelay.` for engine assumptions.
- **Deterministic.** The rules are pure functions, with no clock, randomness or locale-dependent formatting. The same input always gives a byte-identical report.

## Statuses

| Status | Meaning |
|---|---|
| `pass` | Meets the rule. |
| `warn` | Allowed, but worth knowing (for example, it misses fast-track approval). |
| `fail` | Breaks the rule. |
| `review` | Can't be decided from the facts given, for example a missing local value or an unknown transit distance. |
| `n/a` | The rule doesn't apply, and `message` says why. |

Most of California's ADU law tells cities what they must **allow**, so these rules are `state-floor` rules. A design inside the state guarantee passes. Above it, the result is `review` unless a local limit is supplied, because the local code then decides. Rules of kind `state-cap` (1,200 sq ft detached, 50% attached, 500 sq ft JADU) are outer limits and can fail.

## California baseline (`us-ca`)

| Rule id | What it checks | Source |
|---|---|---|
| `us-ca.adu.eligibility.lot` | Residential or mixed-use zoning, with an existing or proposed home | Gov. Code § 66314(d)(2), § 66323(a) |
| `us-ca.adu.height.detached` | 16 ft, 18 ft near major transit or beside a multistory multifamily building, +2 ft near transit to match the roof pitch | § 66321(b)(4)(A)–(C) |
| `us-ca.adu.height.attached` | 25 ft or the zone height, whichever is lower; two stories guaranteed | § 66321(b)(4)(D) |
| `us-ca.adu.size.detached-cap` | ≤ 1,200 sq ft total floor area | § 66314(d)(5) |
| `us-ca.adu.size.attached-cap` | ≤ 50% of the existing home, but not below 850 / 1,000 sq ft* | § 66314(d)(4), § 66321(b)(2) |
| `us-ca.adu.size.local-max` | A local maximum is raised to 850 sq ft (1,000 sq ft with more than one bedroom) | § 66321(b)(2) |
| `us-ca.jadu.size` | ≤ 500 sq ft interior livable space, inside a single-family home | § 66313(d), § 66333 |
| `us-ca.adu.setback.side` / `.rear` | A city can require at most 4 ft; conversions need none | § 66314(d)(7) |
| `us-ca.adu.setback.front` | Local value; may give way to an 800 sq ft ADU (returns `review`)* | § 66321(b)(3) |
| `us-ca.adu.coverage` | Local value; an 800 sq ft ADU with 4 ft setbacks is protected* | § 66321(b)(3) |
| `us-ca.adu.path.ministerial-detached` | Fast-track for a detached ADU of up to 800 sq ft with 4 ft setbacks, within the height allowance | § 66323(a)(2) |
| `us-ca.adu.path.ministerial-conversion` | Fast-track for a conversion or JADU, adding up to 150 sq ft | § 66323(a)(1) |

\* These results list an **interpretation**, marked unverified, in `CheckResult.interpretations`. Read them before relying on the result.

### Verification status

All California citations are **`secondary`** as of 2026-11-01. The official site (leginfo.legislature.ca.gov) couldn't be reached from the build environment, so the section text was read on public mirrors of the official code (california.public.law, gocodebook.com, law.justia.com). It was also cross-checked against LA County Planning's memo on SB 543 (Stats. 2025, ch. 520, operative 2026-01-01), which moved the size figures to *interior livable space*. Each citation links the official leginfo URL and records where it was actually read.

**Before launch:** a person should open each leginfo link, confirm the subdivision and number, and change `verification` to `'primary'`. Also check the HCD ADU Handbook for the three interpretations above.

### Not covered yet

- Parking (§ 66314(d)(10), § 66322), fees (§ 66311.5), fire sprinklers (§ 66314(d)(12)) and owner occupancy.
- Multifamily ADU counts (§ 66323(a)(3)–(4)), and ADU or JADU counts per lot.
- Minimum size (efficiency units, Health & Safety Code § 17958.1).
- How height is measured. State law doesn't define it, and local codes do. The Home engine owns this as a labelled Vandelay assumption (`vandelay.assumption.height-measurement`).
- Any city or county ordinance.

## Adding a region

1. Create `regions/<id>/citations.ts` with a `Citation` for every provision you use. Give the official URL, plus `readAt` if you read it elsewhere. Use `verification: 'unverified'` until someone has read the text.
2. Write rules in `regions/<id>/…-rules.ts`. Ids start with `<id>.`. Copy every number from the cited text, and name the constant after the subdivision.
3. Export a `Region` with `parent` set if it layers on a state baseline, and add tests for each threshold, at the limit and just over it.
4. Never invent a code section. If you can't find the text, leave the rule out or mark it `unverified` and say so in `why`.
