import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// The kernel must stay pure and deterministic: no rendering libraries,
// no DOM, no clocks or randomness. This guards the obvious ways in.
const root = join(import.meta.dirname, '..');
const banned = /from ['"](three|@react-three\/[^'"]+|react|react-dom|rhino3dm)['"]|\bMath\.random\(|\bDate\.now\(|\bnew Date\(\)/;

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : [],
  );

describe('kernel purity', () => {
  it('has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown>;
    expect(pkg.dependencies ?? {}).toEqual({});
  });

  it.each(sources(join(root, 'src')))('%s has no banned imports or nondeterminism', (file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(banned);
  });
});
