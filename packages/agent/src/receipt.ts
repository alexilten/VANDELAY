/**
 * Receipts: what a result claims, in a form anyone can check.
 *
 * A receipt names the tool, the engine version, a fingerprint of the rules
 * that ran, a hash of the input, a hash of the result and every intent hash
 * the result contains. Signing happens outside this package (it needs keys);
 * this file only builds the claims and their canonical bytes, so the browser,
 * a worker or another agent can recompute them.
 */
import { US_CA, sha256Hex, stableStringify } from '@vandelay/kernel';
import { ENGINE_VERSION, RULES } from '@vandelay/engine-home';

export const RECEIPT_FORMAT = 'vandelay.receipt/0';

/**
 * Fingerprint of every rule the Home engine can apply: its own checks and the
 * cited regional rules, with their statements and citations. Functions drop
 * out of JSON, so this changes when a rule's text, limit or citation changes.
 */
export const RULES_HASH = sha256Hex(stableStringify({ engine: RULES, regions: [US_CA] }));

export interface ReceiptClaims {
  readonly format: typeof RECEIPT_FORMAT;
  readonly tool: string;
  readonly engine: { readonly id: 'home'; readonly version: string };
  readonly rulesHash: string;
  readonly inputHash: string;
  readonly resultHash: string;
  /** Every intent hash in the result, in order of first appearance. */
  readonly intents: readonly string[];
  readonly issuedAt: string;
  readonly keyId: string;
}

export interface Receipt extends ReceiptClaims {
  readonly alg: 'Ed25519';
  /** base64url signature over `canonicalClaims(claims)`. */
  readonly sig: string;
}

export const hashJson = (value: unknown): string => sha256Hex(stableStringify(value));

const collectIntentHashes = (value: unknown, out: string[]): string[] => {
  if (Array.isArray(value)) for (const v of value) collectIntentHashes(v, out);
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'intentHash' && typeof v === 'string' && !out.includes(v)) out.push(v);
      else collectIntentHashes(v, out);
    }
  }
  return out;
};

export const receiptClaims = (p: { tool: string; input: unknown; result: unknown; issuedAt: string; keyId: string }): ReceiptClaims => ({
  format: RECEIPT_FORMAT,
  tool: p.tool,
  engine: { id: 'home', version: ENGINE_VERSION },
  rulesHash: RULES_HASH,
  inputHash: hashJson(p.input),
  resultHash: hashJson(p.result),
  intents: collectIntentHashes(p.result, []),
  issuedAt: p.issuedAt,
  keyId: p.keyId,
});

/** The exact bytes that are signed: the claims, keys sorted, nothing else. */
export const canonicalClaims = (r: ReceiptClaims): string => {
  const { format, tool, engine, rulesHash, inputHash, resultHash, intents, issuedAt, keyId } = r;
  return stableStringify({ format, tool, engine, rulesHash, inputHash, resultHash, intents, issuedAt, keyId });
};
