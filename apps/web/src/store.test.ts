import { describe, expect, it } from 'vitest';
import { useApp } from './store.ts';

describe('app store', () => {
  it('defaults to home and switches category', () => {
    expect(useApp.getState().category).toBe('home');
    useApp.getState().setCategory('venue');
    expect(useApp.getState().category).toBe('venue');
  });
});
