/**
 * JSON Patch (RFC 6902) for intent: the only way an agent changes a design.
 * Supports add, remove, replace and test. Patches never mutate their input,
 * and a Home patch is validated before it is accepted.
 */
import { validateHomeIntent, type HomeIntent, type Issue } from './home-intent.ts';
import { parsePointer, type JsonPointer } from './pointer.ts';

export type PatchOp =
  | { readonly op: 'add'; readonly path: JsonPointer; readonly value: unknown }
  | { readonly op: 'replace'; readonly path: JsonPointer; readonly value: unknown }
  | { readonly op: 'remove'; readonly path: JsonPointer }
  | { readonly op: 'test'; readonly path: JsonPointer; readonly value: unknown };

export type PatchResult<T> = { ok: true; value: T } | { ok: false; issues: Issue[] };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const deepEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
};

/** Applies a patch to a copy of `doc`. Fails on the first op that cannot apply. */
export const applyPatch = <T>(doc: T, ops: readonly PatchOp[]): PatchResult<T> => {
  let root: unknown = clone(doc);
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    const at = `/ops/${i}`;
    const tokens = parsePointer(op.path);
    if (!tokens) return { ok: false, issues: [{ path: at, message: `bad path "${op.path}"` }] };
    if (tokens.length === 0) {
      if (op.op === 'test') {
        if (!deepEqual(root, op.value)) return { ok: false, issues: [{ path: at, message: 'test failed at the document root' }] };
        continue;
      }
      if (op.op === 'remove') return { ok: false, issues: [{ path: at, message: 'cannot remove the document root' }] };
      root = clone(op.value);
      continue;
    }
    let parent: unknown = root;
    for (const t of tokens.slice(0, -1)) {
      parent = Array.isArray(parent) ? parent[Number(t)] : parent !== null && typeof parent === 'object' ? (parent as Record<string, unknown>)[t] : undefined;
      if (parent === undefined || parent === null || typeof parent !== 'object') {
        return { ok: false, issues: [{ path: at, message: `path "${op.path}" does not exist` }] };
      }
    }
    const key = tokens.at(-1)!;
    if (Array.isArray(parent)) {
      const idx = key === '-' ? parent.length : Number(key);
      const valid = key === '-' || /^(0|[1-9]\d*)$/.test(key);
      const exists = valid && idx < parent.length;
      if (op.op === 'add') {
        if (!valid || idx > parent.length) return { ok: false, issues: [{ path: at, message: `bad array index in "${op.path}"` }] };
        parent.splice(idx, 0, clone(op.value));
      } else if (!exists) {
        return { ok: false, issues: [{ path: at, message: `path "${op.path}" does not exist` }] };
      } else if (op.op === 'remove') parent.splice(idx, 1);
      else if (op.op === 'replace') parent[idx] = clone(op.value);
      else if (!deepEqual(parent[idx], op.value)) return { ok: false, issues: [{ path: at, message: `test failed at "${op.path}"` }] };
    } else {
      const obj = parent as Record<string, unknown>;
      const exists = Object.prototype.hasOwnProperty.call(obj, key);
      if (op.op === 'add') obj[key] = clone(op.value);
      else if (!exists) return { ok: false, issues: [{ path: at, message: `path "${op.path}" does not exist` }] };
      else if (op.op === 'remove') delete obj[key];
      else if (op.op === 'replace') obj[key] = clone(op.value);
      else if (!deepEqual(obj[key], op.value)) return { ok: false, issues: [{ path: at, message: `test failed at "${op.path}"` }] };
    }
  }
  return { ok: true, value: root as T };
};

/** Applies a patch to a Home intent and accepts it only if the result is still a valid Home intent. */
export const patchHomeIntent = (intent: HomeIntent, ops: readonly PatchOp[]): PatchResult<HomeIntent> => {
  const res = applyPatch(intent, ops);
  if (!res.ok) return res;
  const issues = validateHomeIntent(res.value);
  return issues.length ? { ok: false, issues } : res;
};
