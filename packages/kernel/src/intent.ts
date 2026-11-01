/**
 * Intent is the source of truth for a design. Geometry, drawings, quantities
 * and cost are all derived from it, so every intent document carries an
 * explicit schema version.
 *
 * This file defines the versioned envelope shared by every category. The
 * category bodies live beside it (Home: `home-intent.ts`).
 *
 * Version history
 *   0.0.0  envelope only
 *   0.1.0  Home body: site, brief, design, sources (intent schema v0)
 */

export const INTENT_SCHEMA = 'vandelay.intent' as const;
export const INTENT_SCHEMA_VERSION = '0.1.0' as const;

export const CATEGORIES = ['home', 'business', 'mixed-use', 'venue'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface IntentEnvelope<TBody = unknown> {
  readonly schema: typeof INTENT_SCHEMA;
  readonly version: string;
  readonly units: 'mm';
  readonly up: 'z';
  readonly category: Category;
  readonly body: TBody;
}

export const createIntent = <TBody>(category: Category, body: TBody): IntentEnvelope<TBody> => ({
  schema: INTENT_SCHEMA,
  version: INTENT_SCHEMA_VERSION,
  units: 'mm',
  up: 'z',
  category,
  body,
});

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validates the envelope of an intent JSON document. The body is not inspected yet. */
export const parseIntent = (json: string): ParseResult<IntentEnvelope> => {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'not valid JSON' };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, error: 'not an object' };
  const d = data as Record<string, unknown>;
  if (d.schema !== INTENT_SCHEMA) return { ok: false, error: `schema must be "${INTENT_SCHEMA}"` };
  if (typeof d.version !== 'string' || d.version.split('.')[0] !== INTENT_SCHEMA_VERSION.split('.')[0]) {
    return { ok: false, error: `unsupported version ${String(d.version)}` };
  }
  if (d.units !== 'mm') return { ok: false, error: 'units must be "mm"' };
  if (d.up !== 'z') return { ok: false, error: 'up must be "z"' };
  if (!CATEGORIES.includes(d.category as Category)) return { ok: false, error: 'unknown category' };
  if (!('body' in d)) return { ok: false, error: 'missing body' };
  return { ok: true, value: d as unknown as IntentEnvelope };
};

/**
 * Deterministic JSON: object keys sorted, so the same intent always
 * serialises to the same bytes (stable hashes, diffs and caches).
 */
export const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
