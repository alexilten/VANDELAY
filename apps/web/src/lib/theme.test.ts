import { afterEach, describe, expect, it } from 'vitest';
import { applyTheme, nextTheme, readTheme } from './theme';

afterEach(() => applyTheme('system'));

describe('theme', () => {
  it('cycles system → light → dark', () => {
    expect(nextTheme('system')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('system');
  });

  it('sets data-theme and remembers the choice', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(readTheme()).toBe('dark');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(readTheme()).toBe('system');
  });
});
