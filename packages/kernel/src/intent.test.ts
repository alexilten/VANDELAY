import { describe, expect, it } from 'vitest';
import { createIntent, INTENT_SCHEMA_VERSION, parseIntent, stableStringify } from './intent.ts';

describe('intent envelope', () => {
  it('round-trips through JSON', () => {
    const intent = createIntent('home', { note: 'example' });
    const parsed = parseIntent(JSON.stringify(intent));
    expect(parsed).toEqual({ ok: true, value: intent });
    expect(intent.version).toBe(INTENT_SCHEMA_VERSION);
  });

  it('rejects wrong units, axis and major version', () => {
    const base = createIntent('home', {});
    expect(parseIntent(JSON.stringify({ ...base, units: 'm' })).ok).toBe(false);
    expect(parseIntent(JSON.stringify({ ...base, up: 'y' })).ok).toBe(false);
    expect(parseIntent(JSON.stringify({ ...base, version: '1.0.0' })).ok).toBe(false);
    expect(parseIntent('nope').ok).toBe(false);
  });

  it('serialises deterministically regardless of key order', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });
});
