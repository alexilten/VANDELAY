/**
 * JSON Pointer (RFC 6901). Intent paths in errors, sources, traces and patches
 * are all JSON Pointers, so "why?" can always point at the exact field.
 */
export type JsonPointer = string;

export const parsePointer = (pointer: JsonPointer): string[] | undefined => {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) return undefined;
  return pointer
    .slice(1)
    .split('/')
    .map((t) => t.replace(/~1/g, '/').replace(/~0/g, '~'));
};

export const joinPointer = (base: JsonPointer, token: string | number): JsonPointer =>
  `${base}/${String(token).replace(/~/g, '~0').replace(/\//g, '~1')}`;

/** Reads the value at a pointer, or `undefined` when any step is missing. */
export const getAt = (doc: unknown, pointer: JsonPointer): unknown => {
  const tokens = parsePointer(pointer);
  if (!tokens) return undefined;
  let cur: unknown = doc;
  for (const t of tokens) {
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9]\d*)$/.test(t)) return undefined;
      cur = cur[Number(t)];
    } else if (cur !== null && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, t)) {
      cur = (cur as Record<string, unknown>)[t];
    } else {
      return undefined;
    }
  }
  return cur;
};

export const hasPointer = (doc: unknown, pointer: JsonPointer): boolean => {
  const tokens = parsePointer(pointer);
  if (!tokens) return false;
  let cur: unknown = doc;
  for (const t of tokens) {
    if (Array.isArray(cur)) {
      if (!/^(0|[1-9]\d*)$/.test(t) || Number(t) >= cur.length) return false;
      cur = cur[Number(t)];
    } else if (cur !== null && typeof cur === 'object' && Object.prototype.hasOwnProperty.call(cur, t)) {
      cur = (cur as Record<string, unknown>)[t];
    } else {
      return false;
    }
  }
  return true;
};
