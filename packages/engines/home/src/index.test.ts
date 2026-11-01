import { CATEGORIES } from '@vandelay/kernel';
import { describe, expect, it } from 'vitest';
import { homeEngine } from './index.ts';

describe('home engine', () => {
  it('registers under the home category', () => {
    expect(CATEGORIES).toContain(homeEngine.category);
    expect(homeEngine.id).toBe('home');
  });
});
