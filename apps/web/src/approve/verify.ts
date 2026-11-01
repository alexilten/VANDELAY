/**
 * Checking a signed agent result in the browser.
 *
 * An agent calls a Vandelay tool and gets back a result with a `receipt`
 * (see `@vandelay/agent` receipt.ts). A person opens that result here. We
 * recompute everything the receipt claims that the browser can recompute:
 * the result hash, the engine version and the rules fingerprint, and the
 * Ed25519 signature over the canonical claims (WebCrypto). Nothing is sent
 * anywhere.
 *
 * Trust in the signing key is reported separately from the maths: a key that
 * arrives inside the same file proves the file wasn't altered after signing,
 * not who signed it. Only keys in TRUSTED_KEYS count as Vandelay's.
 */
import { canonicalClaims, hashJson, homeTools, RECEIPT_FORMAT, RULES_HASH, type Receipt } from '@vandelay/agent';
import { ENGINE_VERSION } from '@vandelay/engine-home';

export const APPROVAL_REQUEST_FORMAT = 'vandelay.approval-request/0';
export const APPROVAL_FORMAT = 'vandelay.approval/0';

export interface PublicKeyInfo {
  readonly keyId: string;
  readonly alg: 'Ed25519';
  /** SubjectPublicKeyInfo, PEM. */
  readonly publicKey: string;
}

/** Vandelay's published signing keys. Empty until a production key exists. */
export const TRUSTED_KEYS: readonly PublicKeyInfo[] = [];

export interface ApprovalRequest {
  /** The tool result as the agent received it, receipt included. */
  readonly result: Record<string, unknown>;
  readonly receipt: Receipt;
  /** Keys that came with the file. Not trusted, only used to check the maths. */
  readonly keys: readonly PublicKeyInfo[];
  /** The tool input, when known (share links and examples carry it). */
  readonly input?: unknown;
}

export type KeyTrust = 'trusted' | 'provided' | 'unknown';
export type SignatureStatus = 'valid' | 'invalid' | 'unknown-key' | 'unsupported';

export interface VerifyReport {
  /** Signature valid and the result is the one that was signed. */
  readonly intact: boolean;
  readonly signature: SignatureStatus;
  readonly keyTrust: KeyTrust;
  /** Key id says it is a throwaway development or example key. */
  readonly devKey: boolean;
  readonly resultMatches: boolean;
  readonly engineCurrent: boolean;
  readonly rulesCurrent: boolean;
  readonly problems: readonly string[];
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isKey = (k: unknown): k is PublicKeyInfo => isObject(k) && typeof k.keyId === 'string' && k.alg === 'Ed25519' && typeof k.publicKey === 'string';

const isReceipt = (r: unknown): r is Receipt =>
  isObject(r) && r.format === RECEIPT_FORMAT && typeof r.sig === 'string' && typeof r.keyId === 'string' && typeof r.resultHash === 'string' &&
  typeof r.rulesHash === 'string' && isObject(r.engine) && Array.isArray(r.intents);

/** Accepts a bare signed result or an approval-request wrapper. */
export function parseApprovalRequest(text: string): ApprovalRequest | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "This isn't JSON. Open the file an agent gave you, or paste its contents." };
  }
  if (!isObject(data)) return { error: 'Expected a JSON object.' };
  const wrapped = data.format === APPROVAL_REQUEST_FORMAT;
  const result = wrapped ? data.result : data;
  if (!isObject(result)) return { error: 'The approval request has no result.' };
  if (!isReceipt(result.receipt)) return { error: `No ${RECEIPT_FORMAT} receipt found. Only signed Vandelay results can be approved.` };
  const keys = wrapped && Array.isArray(data.keys) ? data.keys.filter(isKey) : [];
  return { result, receipt: result.receipt, keys };
}

const toB64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const encodeJson = (v: unknown) => toB64url(new TextEncoder().encode(JSON.stringify(v)));
const decodeJson = (s: string): unknown => JSON.parse(new TextDecoder().decode(fromB64(s)));

/**
 * A share link carries only the receipt and the tool input (results are ~100 KB):
 * `<viewer>#v=0&receipt=<base64url JSON>&input=<base64url JSON>`. The engine is
 * deterministic, so the viewer re-runs the tool and the receipt's hashes prove the
 * person sees exactly what the agent got.
 */
export function approvalLink(base: string, receipt: Receipt, input: unknown): string {
  return `${base}#v=0&receipt=${encodeJson(receipt)}&input=${encodeJson(input)}`;
}

export function isApprovalLink(hash: string): boolean {
  return /(^|[#&])v=0(&|$)/.test(hash) && hash.includes('receipt=');
}

/** Re-runs the receipt's tool on the link's input. Returns a request whose result is our own recomputation. */
export function requestFromLink(hash: string): ApprovalRequest | { error: string } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('v') !== '0') return { error: 'This link is from a newer viewer format.' };
  let receipt: unknown;
  let input: unknown;
  try {
    receipt = decodeJson(params.get('receipt') ?? '');
    input = decodeJson(params.get('input') ?? '');
  } catch {
    return { error: 'This link is damaged: its receipt or input could not be read.' };
  }
  if (!isReceipt(receipt)) return { error: `The link has no ${RECEIPT_FORMAT} receipt.` };
  if (hashJson(input) !== receipt.inputHash) return { error: "The link's input doesn't match its receipt." };
  const tool = homeTools.find((t) => t.name === receipt.tool) as { run: (i: unknown) => unknown } | undefined;
  if (!tool) return { error: `This viewer doesn't know the tool "${receipt.tool}".` };
  let out: unknown;
  try {
    out = JSON.parse(JSON.stringify(tool.run(input)));
  } catch {
    return { error: 'The engine could not re-create this design.' };
  }
  const structured = isObject(out) ? out : { result: out };
  return { result: { ...structured, receipt }, receipt, keys: [], input };
}

/** The result as it was signed: everything except the envelope fields (the receipt and its share link). */
export function signedPart(result: Record<string, unknown>): Record<string, unknown> {
  const { receipt: _receipt, approvalUrl: _approvalUrl, ...rest } = result;
  return rest;
}

const fromB64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const pemToDer = (pem: string) => fromB64(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''));

async function checkSignature(receipt: Receipt, key: PublicKeyInfo): Promise<SignatureStatus> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return 'unsupported';
  let pub: CryptoKey;
  try {
    pub = await subtle.importKey('spki', pemToDer(key.publicKey), { name: 'Ed25519' }, false, ['verify']);
  } catch {
    return 'unsupported';
  }
  try {
    const ok = await subtle.verify({ name: 'Ed25519' }, pub, fromB64(receipt.sig), new TextEncoder().encode(canonicalClaims(receipt)));
    return ok ? 'valid' : 'invalid';
  } catch {
    return 'invalid';
  }
}

export async function verifyRequest(req: ApprovalRequest, trusted: readonly PublicKeyInfo[] = TRUSTED_KEYS): Promise<VerifyReport> {
  const { receipt } = req;
  const problems: string[] = [];
  const trustedKey = trusted.find((k) => k.keyId === receipt.keyId);
  const providedKey = req.keys.find((k) => k.keyId === receipt.keyId);
  const key = trustedKey ?? providedKey;
  const keyTrust: KeyTrust = trustedKey ? 'trusted' : providedKey ? 'provided' : 'unknown';

  const signature = key ? await checkSignature(receipt, key) : 'unknown-key';
  if (signature === 'invalid') problems.push('The signature does not match the receipt.');
  if (signature === 'unknown-key') problems.push(`No public key for ${receipt.keyId}, so the signature can't be checked.`);
  if (signature === 'unsupported') problems.push("This browser can't check Ed25519 signatures.");

  const resultMatches = hashJson(signedPart(req.result)) === receipt.resultHash;
  if (!resultMatches) problems.push('The design was changed after it was signed.');
  const engineCurrent = receipt.engine.version === ENGINE_VERSION;
  const rulesCurrent = receipt.rulesHash === RULES_HASH;

  return {
    intact: signature === 'valid' && resultMatches,
    signature,
    keyTrust,
    devKey: /^(ephemeral|example):/.test(receipt.keyId),
    resultMatches,
    engineCurrent,
    rulesCurrent,
    problems,
  };
}

export interface Approval {
  readonly format: typeof APPROVAL_FORMAT;
  /** The receipt's signature: names exactly which signed result was approved. */
  readonly receiptSig: string;
  readonly resultHash: string;
  readonly keyId: string;
  readonly option: { readonly index: number; readonly label: string; readonly intentHash?: string };
  readonly approvedAt: string;
  /** Honest about what this record is until people sign in. */
  readonly note: string;
}

export function approvalRecord(req: ApprovalRequest, option: { index: number; label: string; intentHash?: string }, now = new Date()): Approval {
  return {
    format: APPROVAL_FORMAT,
    receiptSig: req.receipt.sig,
    resultHash: req.receipt.resultHash,
    keyId: req.receipt.keyId,
    option,
    approvedAt: now.toISOString(),
    note: 'Approved in the Vandelay viewer. Not signed by the approver yet: sign-in is not built.',
  };
}
