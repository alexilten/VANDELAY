/**
 * The Vandelay MCP server as outside agents see it: the engine tools, a signed
 * receipt on every successful result, and a free `receipt.verify`.
 */
import { RECEIPT_FORMAT, RULES_HASH, createMcpServer, hashJson, homeTools, type McpServer, type Receipt, type Tool } from '@vandelay/agent';
import { ENGINE_VERSION } from '@vandelay/engine-home';
import type { PublicKeyInfo, Signer } from './signing.ts';

export interface VerifyOutput {
  readonly ok: boolean;
  /** Signed by this server's key, and the claims are untouched. */
  readonly signature: 'valid' | 'invalid' | 'unknown-key';
  /** Given a result: does it hash to the receipt's resultHash? */
  readonly resultMatches?: boolean;
  /** Made by the engine and rules this server runs now. False means it may be stale, not that it is wrong. */
  readonly current: { readonly engine: boolean; readonly rules: boolean };
  readonly problems: readonly string[];
  readonly publicKey: PublicKeyInfo;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export const verifyTool = (signer: Signer): Tool<{ receipt: Receipt; result?: Record<string, unknown> }, VerifyOutput> => ({
  name: 'receipt.verify',
  description: 'Free. Check a Vandelay receipt: was it signed by Vandelay, does the result you hold match it, and was it made by the current engine and rules? Pass the receipt, and optionally the structuredContent it came with.',
  inputSchema: {
    type: 'object', required: ['receipt'],
    properties: {
      receipt: { type: 'object', description: 'The `receipt` object from a Vandelay result.' },
      result: { type: 'object', description: 'Optional: the full structuredContent the receipt came with. Its `receipt` and `approvalUrl` fields are ignored.' },
    },
  },
  run: ({ receipt, result }) => {
    const problems: string[] = [];
    if (!isObject(receipt) || receipt.format !== RECEIPT_FORMAT) problems.push(`not a ${RECEIPT_FORMAT} receipt`);
    const known = isObject(receipt) && receipt.keyId === signer.publicKey.keyId;
    const signature = !known ? 'unknown-key' : signer.verifySignature(receipt) ? 'valid' : 'invalid';
    if (signature === 'unknown-key') problems.push(`unknown signing key: ${String(isObject(receipt) ? receipt.keyId : undefined)}`);
    if (signature === 'invalid') problems.push('signature does not match the claims');

    let resultMatches: boolean | undefined;
    if (result !== undefined) {
      const { receipt: _r, approvalUrl: _a, ...rest } = isObject(result) ? result : {};
      resultMatches = hashJson(rest) === receipt?.resultHash;
      if (!resultMatches) problems.push('result does not hash to resultHash');
    }
    const current = { engine: receipt?.engine?.version === ENGINE_VERSION, rules: receipt?.rulesHash === RULES_HASH };
    return { ok: problems.length === 0, signature, ...(resultMatches === undefined ? {} : { resultMatches }), current, problems, publicKey: signer.publicKey };
  },
});

/** Tools whose output is not signed: checking a receipt needs no receipt. */
const UNSIGNED = new Set(['receipt.verify']);

/**
 * A link a person can open to see and approve exactly what the agent got.
 * It carries only the receipt and the input: the viewer re-runs the
 * deterministic tool and checks the result against `resultHash`, so the link
 * stays small (results run to 100+ KB).
 */
export const approvalUrl = (viewerUrl: string, receipt: Receipt, input: unknown): string => {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${viewerUrl.replace(/#.*$/, '')}#v=0&receipt=${b64(receipt)}&input=${b64(input)}`;
};

export interface VandelayServerOptions {
  /** Where the approval viewer lives. When set, signed results carry an `approvalUrl`. */
  readonly viewerUrl?: string;
}

export const createVandelayServer = (signer: Signer, opts: VandelayServerOptions = {}): McpServer =>
  createMcpServer({
    tools: [...homeTools, verifyTool(signer)] as unknown as readonly Tool<never, unknown>[],
    decorate: (tool, input, result) => {
      if (UNSIGNED.has(tool)) return undefined;
      const receipt = signer.sign({ tool, input, result });
      return opts.viewerUrl ? { receipt, approvalUrl: approvalUrl(opts.viewerUrl, receipt, input) } : { receipt };
    },
  });
