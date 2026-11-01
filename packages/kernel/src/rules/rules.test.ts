import { describe, expect, it } from 'vitest';
import type { AduInput } from './adu.ts';
import { explain, regionLookup, runRules } from './engine.ts';
import { US_CA, US_CA_ADU_RULES, US_CA_CITATIONS } from './regions/us-ca/index.ts';
import { fmtSqft, ft, sqft, type Region } from './types.ts';

/** A typical backyard cottage on a single-family lot in California. */
const cottage = (over: { adu?: Partial<AduInput['adu']>; lot?: Partial<AduInput['lot']>; local?: AduInput['local'] } = {}): AduInput => ({
  adu: {
    kind: 'detached',
    interiorLivableArea: sqft(750),
    footprintArea: sqft(800),
    bedrooms: 1,
    height: ft(15),
    clearances: { side: ft(5), rear: ft(5), front: ft(60) },
    ...over.adu,
  },
  lot: { zoning: 'single-family', primary: 'single-family', primaryExists: true, primaryFloorArea: sqft(1600), lotArea: sqft(6000), existingFootprint: sqft(1600), ...over.lot },
  ...(over.local ? { local: over.local } : {}),
});

const check = (id: string, input: AduInput) => {
  const rule = US_CA_ADU_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`no rule ${id}`);
  return rule.check(input);
};

describe('rule library integrity', () => {
  it('every rule and result carries at least one citation with an official URL', () => {
    for (const rule of US_CA_ADU_RULES) {
      expect(rule.citations.length, rule.id).toBeGreaterThan(0);
      expect(check(rule.id, cottage()).citations.length, rule.id).toBeGreaterThan(0);
    }
    for (const c of US_CA_CITATIONS) {
      expect(c.url, c.id).toMatch(/^https:\/\//);
      expect(['primary', 'secondary', 'unverified']).toContain(c.verification);
      expect(c.checkedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('rule ids are unique and region-prefixed', () => {
    expect(() => regionLookup([US_CA])).not.toThrow();
    for (const r of US_CA_ADU_RULES) expect(r.id).toMatch(/^us-ca\.[a-z0-9.-]+$/);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(runRules(US_CA, cottage()))).toBe(JSON.stringify(runRules(US_CA, cottage())));
  });

  it('every non-n/a result explains itself with a code section', () => {
    for (const res of runRules(US_CA, cottage()).results) {
      if (res.status === 'n/a') continue;
      expect(res.why.length, res.ruleId).toBeGreaterThan(20);
      expect(explain(res)).toContain('Source:');
    }
  });
});

describe('a typical 750 sq ft backyard cottage', () => {
  const report = runRules(US_CA, cottage());
  it('passes everything that applies', () => {
    expect(report.overall).toBe('pass');
    expect(report.counts.fail + report.counts.review + report.counts.warn).toBe(0);
  });
  it('qualifies for fast-track approval', () => {
    expect(check('us-ca.adu.path.ministerial-detached', cottage()).status).toBe('pass');
  });
});

describe('detached height (§ 66321(b)(4))', () => {
  const id = 'us-ca.adu.height.detached';
  it('passes at exactly 16 ft', () => expect(check(id, cottage({ adu: { height: ft(16) } })).status).toBe('pass'));
  it('reviews 17 ft when transit proximity is unknown', () => {
    const r = check(id, cottage({ adu: { height: ft(17) } }));
    expect(r.status).toBe('review');
    expect(r.why).toContain('transit');
  });
  it('allows 18 ft near transit, and 20 ft with a matching roof pitch', () => {
    expect(check(id, cottage({ adu: { height: ft(18) }, lot: { nearTransit: true } })).status).toBe('pass');
    expect(check(id, cottage({ adu: { height: ft(20) }, lot: { nearTransit: true } })).status).toBe('review');
    expect(check(id, cottage({ adu: { height: ft(20) }, lot: { nearTransit: true, roofPitchMatchesPrimary: true } })).status).toBe('pass');
  });
  it('allows 18 ft beside a multistory multifamily building', () => {
    expect(check(id, cottage({ adu: { height: ft(18) }, lot: { primary: 'multifamily', primaryMultistory: true, zoning: 'multifamily', nearTransit: false } })).status).toBe('pass');
  });
  it('a local limit below 16 ft cannot bite; a generous one governs', () => {
    expect(check(id, cottage({ adu: { height: ft(16) }, local: { maxHeight: ft(14) } })).status).toBe('pass');
    expect(check(id, cottage({ adu: { height: ft(22) }, local: { maxHeight: ft(24) } })).status).toBe('pass');
    expect(check(id, cottage({ adu: { height: ft(17) }, lot: { nearTransit: false }, local: { maxHeight: ft(14) } })).status).toBe('fail');
  });
});

describe('attached height (§ 66321(b)(4)(D))', () => {
  const id = 'us-ca.adu.height.attached';
  const attached = (h: number, zone?: number, stories?: number) =>
    cottage({ adu: { kind: 'attached', height: ft(h), ...(stories ? { stories } : {}) }, ...(zone ? { local: { primaryZoneHeight: ft(zone) } } : {}) });
  it('uses the lower of 25 ft and the zone height', () => {
    expect(check(id, attached(25, 30)).status).toBe('pass');
    expect(check(id, attached(26, 30)).status).toBe('fail');
    expect(check(id, attached(23, 22)).status).toBe('fail');
  });
  it('reviews without a zone height, and above two stories', () => {
    expect(check(id, attached(20)).status).toBe('review');
    expect(check(id, attached(24, 30, 3)).status).toBe('review');
  });
});

describe('size (§ 66314(d)(4)–(5), § 66321(b)(2), § 66313(d))', () => {
  it('caps detached at 1,200 sq ft total floor area', () => {
    expect(check('us-ca.adu.size.detached-cap', cottage({ adu: { interiorLivableArea: sqft(1100), totalFloorArea: sqft(1200) } })).status).toBe('pass');
    expect(check('us-ca.adu.size.detached-cap', cottage({ adu: { interiorLivableArea: sqft(1150), totalFloorArea: sqft(1201) } })).status).toBe('fail');
  });
  it('attached: 50% of the main home, but never below the 850 / 1,000 sq ft floor', () => {
    const id = 'us-ca.adu.size.attached-cap';
    const small = { primaryFloorArea: sqft(1200) }; // 50% = 600
    expect(check(id, cottage({ adu: { kind: 'attached', interiorLivableArea: sqft(600) }, lot: small })).status).toBe('pass');
    const viaFloor = check(id, cottage({ adu: { kind: 'attached', interiorLivableArea: sqft(850) }, lot: small }));
    expect(viaFloor.status).toBe('pass');
    expect(viaFloor.interpretations.length).toBe(1);
    expect(check(id, cottage({ adu: { kind: 'attached', interiorLivableArea: sqft(900) }, lot: small })).status).toBe('fail');
    expect(check(id, cottage({ adu: { kind: 'attached', interiorLivableArea: sqft(1000), bedrooms: 2 }, lot: small })).status).toBe('pass');
  });
  it('a local maximum is raised to the state floor', () => {
    const id = 'us-ca.adu.size.local-max';
    const r = check(id, cottage({ adu: { interiorLivableArea: sqft(850) }, local: { maxAduArea: sqft(600) } }));
    expect(r.status).toBe('pass');
    expect(r.limit).toBeCloseTo(sqft(850));
    expect(check(id, cottage({ adu: { interiorLivableArea: sqft(900) }, local: { maxAduArea: sqft(600) } })).status).toBe('fail');
    expect(check(id, cottage({ adu: { interiorLivableArea: sqft(950), bedrooms: 2 }, local: { maxAduArea: sqft(600) } })).status).toBe('pass');
  });
  it('a JADU is at most 500 sq ft and only in a single-family home', () => {
    expect(check('us-ca.jadu.size', cottage({ adu: { kind: 'jadu', interiorLivableArea: sqft(500) } })).status).toBe('pass');
    expect(check('us-ca.jadu.size', cottage({ adu: { kind: 'jadu', interiorLivableArea: sqft(501) } })).status).toBe('fail');
    expect(check('us-ca.jadu.size', cottage({ adu: { kind: 'jadu', interiorLivableArea: sqft(400) }, lot: { primary: 'multifamily' } })).status).toBe('fail');
  });
});

describe('setbacks (§ 66314(d)(7), § 66321(b)(3))', () => {
  it('a 10 ft local side setback is capped at 4 ft', () => {
    const r = check('us-ca.adu.setback.side', cottage({ adu: { clearances: { side: ft(4), rear: ft(4) } }, local: { setbacks: { side: ft(10) } } }));
    expect(r.status).toBe('pass');
    expect(r.limit).toBeCloseTo(ft(4));
    expect(r.why).toContain("can't be applied");
  });
  it('fails closer than the governing setback, reviews when the local value is unknown', () => {
    expect(check('us-ca.adu.setback.rear', cottage({ adu: { clearances: { side: ft(4), rear: ft(3) } }, local: { setbacks: { rear: ft(5) } } })).status).toBe('fail');
    expect(check('us-ca.adu.setback.rear', cottage({ adu: { clearances: { side: ft(4), rear: ft(3) } } })).status).toBe('review');
    expect(check('us-ca.adu.setback.rear', cottage({ adu: { clearances: { side: ft(4), rear: ft(3) } }, local: { setbacks: { rear: ft(3) } } })).status).toBe('pass');
  });
  it('conversions need no setback', () => {
    expect(check('us-ca.adu.setback.side', cottage({ adu: { kind: 'conversion', clearances: { side: 0, rear: 0 } } })).status).toBe('pass');
  });
  it('front setback gives way only to a protected 800 sq ft ADU, and then only as review', () => {
    const local = { setbacks: { front: ft(20) } };
    expect(check('us-ca.adu.setback.front', cottage({ adu: { clearances: { side: ft(4), rear: ft(4), front: ft(10) } }, local })).status).toBe('review');
    expect(check('us-ca.adu.setback.front', cottage({ adu: { interiorLivableArea: sqft(900), clearances: { side: ft(4), rear: ft(4), front: ft(10) } }, local })).status).toBe('fail');
  });
});

describe('lot coverage (§ 66321(b)(3))', () => {
  it('passes within the limit, protects 800 sq ft ADUs over it, fails bigger ones', () => {
    // existing 1,600 + ADU 800 = 2,400 / 6,000 = 40%
    expect(check('us-ca.adu.coverage', cottage({ local: { maxCoverage: 0.4 } })).status).toBe('pass');
    const protectedOver = check('us-ca.adu.coverage', cottage({ local: { maxCoverage: 0.35 } }));
    expect(protectedOver.status).toBe('pass');
    expect(protectedOver.interpretations.length).toBe(1);
    expect(check('us-ca.adu.coverage', cottage({ adu: { interiorLivableArea: sqft(850) }, local: { maxCoverage: 0.35 } })).status).toBe('fail');
  });
});

describe('approval paths (§ 66323(a))', () => {
  it('explains why a big detached ADU misses fast-track', () => {
    const r = check('us-ca.adu.path.ministerial-detached', cottage({ adu: { interiorLivableArea: sqft(1000), clearances: { side: ft(3), rear: ft(5) } } }));
    expect(r.status).toBe('warn');
    expect(r.message).toContain('1,000 sq ft');
    expect(r.message).toContain('side lot line');
  });
  it('a garage conversion adding up to 150 sq ft qualifies', () => {
    expect(check('us-ca.adu.path.ministerial-conversion', cottage({ adu: { kind: 'conversion', expansionArea: sqft(150) } })).status).toBe('pass');
    expect(check('us-ca.adu.path.ministerial-conversion', cottage({ adu: { kind: 'conversion', expansionArea: sqft(200) } })).status).toBe('warn');
  });
});

describe('region plug-in', () => {
  const city: Region<AduInput> = {
    id: 'us-ca.example-city',
    name: 'Example City (test fixture, not a real ordinance)',
    parent: 'us-ca',
    coverage: 'Test fixture.',
    rules: [
      {
        id: 'us-ca.example-city.adu.no-basement',
        region: 'us-ca.example-city',
        topic: 'eligibility',
        kind: 'local',
        title: 'Test rule',
        summary: 'Test rule.',
        citations: [US_CA_CITATIONS[0]!],
        check: () => ({ ruleId: 'us-ca.example-city.adu.no-basement', status: 'warn', message: 'test', why: 'test fixture', citations: [US_CA_CITATIONS[0]!], interpretations: [] }),
      },
    ],
  };
  it('runs the parent baseline first, then local rules', () => {
    const report = runRules(city, cottage(), regionLookup([US_CA, city]));
    expect(report.regions).toEqual(['us-ca', 'us-ca.example-city']);
    expect(report.results.at(-1)!.ruleId).toBe('us-ca.example-city.adu.no-basement');
    expect(report.overall).toBe('warn');
  });
  it('refuses a missing parent and mis-prefixed rule ids', () => {
    expect(() => runRules(city, cottage())).toThrow(/not loaded/);
    expect(() => regionLookup([{ ...city, id: 'us-nv' }])).toThrow(/must start with/);
  });
});

describe('formatting', () => {
  it('groups thousands without locale', () => expect(fmtSqft(sqft(1200))).toBe('1,200 sq ft'));
});
