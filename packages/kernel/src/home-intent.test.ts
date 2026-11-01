import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { exampleHomeIntent, EXAMPLE_SITES } from './examples.ts';
import { hashIntent, sha256Hex } from './hash.ts';
import { parseHomeIntent, validateHomeIntent, type HomeIntent } from './home-intent.ts';
import { applyPatch, patchHomeIntent } from './patch.ts';
import { getAt } from './pointer.ts';

const paths = (doc: unknown) => validateHomeIntent(doc).map((i) => i.path);
const withBody = (patch: (b: Record<string, any>) => void): unknown => {
  const doc = JSON.parse(JSON.stringify(exampleHomeIntent())) as { body: Record<string, any> };
  patch(doc.body);
  return doc;
};

describe('home intent v0', () => {
  it.each(Object.keys(EXAMPLE_SITES) as (keyof typeof EXAMPLE_SITES)[])('example site %s is a valid intent', (site) => {
    expect(validateHomeIntent(exampleHomeIntent(site))).toEqual([]);
  });

  it('round-trips through JSON', () => {
    const intent = exampleHomeIntent();
    expect(parseHomeIntent(JSON.stringify(intent))).toEqual({ ok: true, value: intent });
  });

  it('reports every problem with its JSON Pointer', () => {
    const doc = withBody((b) => {
      b.brief.bedrooms = 2.5;
      b.brief.bathrooms = 1.25;
      b.site.zoning.setbacks.front = -1;
      b.design.parti = 'dome';
      b.site.terrain.slopePct = 'steep';
    });
    expect(paths(doc)).toEqual(
      expect.arrayContaining(['/body/brief/bedrooms', '/body/brief/bathrooms', '/body/site/zoning/setbacks/front', '/body/design/parti', '/body/site/terrain/slopePct']),
    );
  });

  it('rejects unknown fields so typos never pass silently', () => {
    expect(paths(withBody((b) => (b.brief.bedroms = 3)))).toEqual(['/body/brief/bedroms']);
  });

  it('requires a convex, counter-clockwise lot', () => {
    expect(paths(withBody((b) => b.site.boundary.reverse()))).toEqual(['/body/site/boundary']);
    const notch = [[0, 0], [10000, 0], [5000, 2000], [10000, 10000], [0, 10000]];
    expect(paths(withBody((b) => (b.site.boundary = notch)))).toEqual(['/body/site/boundary']);
  });

  it('checks the terrain grid size', () => {
    const grid = { kind: 'grid', origin: [0, 0], spacing: 1000, nx: 2, ny: 2, z: [0, 0, 0] };
    expect(paths(withBody((b) => (b.site.terrain = grid)))).toEqual(['/body/site/terrain/z']);
  });

  it('requires area bounds in order', () => {
    expect(paths(withBody((b) => (b.brief.area = { min: 90e6, target: 80e6 })))).toEqual(['/body/brief/area']);
  });

  it('requires every source to point at a real field', () => {
    expect(paths(withBody((b) => (b.sources['/body/site/nowhere'] = { by: 'user' })))).toEqual(['/body/sources/~1body~1site~1nowhere']);
  });

  it('rejects a version it cannot read', () => {
    expect(paths({ ...exampleHomeIntent(), version: '0.0.0' })).toEqual(['/version']);
  });
});

describe('hashing', () => {
  it('matches the SHA-256 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    const long = 'Ünïcødé 🏠 '.repeat(40);
    expect(sha256Hex(long)).toBe(createHash('sha256').update(long, 'utf8').digest('hex'));
  });

  it('ignores key order and changes with content', () => {
    const a = exampleHomeIntent();
    const reordered = JSON.parse(JSON.stringify({ body: a.body, category: a.category, up: a.up, units: a.units, version: a.version, schema: a.schema }));
    expect(hashIntent(reordered)).toBe(hashIntent(a));
    expect(hashIntent(exampleHomeIntent('slopeAlong', undefined, 2))).not.toBe(hashIntent(a));
  });
});

describe('patching', () => {
  it('changes a copy, never the input', () => {
    const intent = exampleHomeIntent();
    const res = patchHomeIntent(intent, [{ op: 'replace', path: '/body/design/parti', value: 'L' }]);
    expect(res.ok && res.value.body.design.parti).toBe('L');
    expect(intent.body.design.parti).toBe('bar');
  });

  it('refuses a patch that makes the intent invalid', () => {
    const res = patchHomeIntent(exampleHomeIntent(), [{ op: 'replace', path: '/body/brief/bedrooms', value: -1 }]);
    expect(res.ok).toBe(false);
    expect(!res.ok && res.issues[0]?.path).toBe('/body/brief/bedrooms');
  });

  it('supports add, remove and test', () => {
    const doc = { a: [1, 2], b: { c: 1 } };
    const res = applyPatch(doc, [
      { op: 'test', path: '/b/c', value: 1 },
      { op: 'add', path: '/a/-', value: 3 },
      { op: 'add', path: '/b/d', value: 'x' },
      { op: 'remove', path: '/a/0' },
    ]);
    expect(res).toEqual({ ok: true, value: { a: [2, 3], b: { c: 1, d: 'x' } } });
    expect(applyPatch(doc, [{ op: 'test', path: '/b/c', value: 2 }]).ok).toBe(false);
    expect(applyPatch(doc, [{ op: 'remove', path: '/zz' }]).ok).toBe(false);
  });

  it('reads values by pointer', () => {
    const intent: HomeIntent = exampleHomeIntent();
    expect(getAt(intent, '/body/site/zoning/setbacks/front')).toBe(6000);
    expect(getAt(intent, '/body/site/boundary/1/0')).toBe(18000);
  });
});
