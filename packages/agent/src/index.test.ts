import { describe, expect, it } from 'vitest';
import { engines, findEngine } from './index.ts';

describe('engine registry', () => {
  it('lists the home engine', () => {
    expect(engines.map((e) => e.id)).toContain('home');
    expect(findEngine('home')?.category).toBe('home');
    expect(findEngine('nope')).toBeUndefined();
  });
});
