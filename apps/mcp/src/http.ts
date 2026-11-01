/**
 * MCP over Streamable HTTP, stateless: each POST /mcp carries one JSON-RPC
 * message and gets a JSON answer (or 202 for a notification). No sessions and
 * no server-to-client stream, because every tool is a pure function of its
 * input. Paid calls (L402) will sit in front of this as a proxy.
 *
 *   PORT=8787 node apps/mcp/src/http.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { hashJson, type McpServer } from '@vandelay/agent';
import { l402FromEnv, type L402 } from './l402.ts';
import { createVandelayServer } from './server.ts';
import { signerFromEnv, type PublicKeyInfo } from './signing.ts';

/** Requests larger than this are refused; an intent is a few kilobytes. */
export const MAX_BODY_BYTES = 1_000_000;

export interface HttpOptions {
  /** Browser origins allowed to call. Requests with no Origin header (agents, curl) are always allowed. */
  readonly allowedOrigins?: readonly string[];
  /** Published at /.well-known/vandelay-keys.json so anyone can check receipts offline. */
  readonly publicKey?: PublicKeyInfo;
  /** Pay-per-call over Lightning. Off when undefined. */
  readonly l402?: L402;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The tool name and input of a tools/call, or undefined for anything else. */
const toolCall = (text: string): { id: unknown; name: string; args: unknown } | undefined => {
  try {
    const m: unknown = JSON.parse(text);
    if (!isObject(m) || m.method !== 'tools/call' || !isObject(m.params) || typeof m.params.name !== 'string') return undefined;
    return { id: m.id ?? null, name: m.params.name, args: m.params.arguments ?? {} };
  } catch {
    return undefined;
  }
};

const send = (res: ServerResponse, status: number, body?: unknown, headers: Record<string, string> = {}): void => {
  res.writeHead(status, body === undefined ? headers : { 'content-type': 'application/json', ...headers });
  res.end(body === undefined ? undefined : JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<string | undefined> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { resolve(undefined); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

export const createHttpHandler = (mcp: McpServer, opts: HttpOptions = {}) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') return send(res, 200, { ok: true, name: mcp.info.name, version: mcp.info.version });
    if (url.pathname === '/.well-known/vandelay-keys.json') {
      return opts.publicKey ? send(res, 200, { keys: [opts.publicKey] }, { 'access-control-allow-origin': '*' }) : send(res, 404, { error: 'no signing key' });
    }
    if (url.pathname !== '/mcp') return send(res, 404, { error: 'not found; MCP lives at /mcp' });

    // The spec asks servers to check Origin, so a web page cannot drive a local server (DNS rebinding).
    const origin = req.headers.origin;
    if (origin !== undefined && !(opts.allowedOrigins ?? []).includes(origin)) return send(res, 403, { error: `origin not allowed: ${origin}` });

    if (req.method === 'GET') return send(res, 405, undefined, { allow: 'POST, DELETE' });
    if (req.method === 'DELETE') return send(res, 405, undefined, { allow: 'POST' }); // stateless: no session to end
    if (req.method !== 'POST') return send(res, 405, undefined, { allow: 'POST' });

    const text = await readBody(req);
    if (text === undefined) return send(res, 413, { error: `body over ${MAX_BODY_BYTES} bytes` });

    if (opts.l402) {
      const call = toolCall(text);
      if (call && opts.l402.priceSats(call.name) > 0) {
        const inputHash = hashJson(call.args);
        const auth = req.headers.authorization;
        const verdict = opts.l402.check(auth, call.name, inputHash);
        if (!verdict.ok) {
          const c = await opts.l402.challenge(call.name, inputHash);
          // The JSON-RPC error carries the same challenge for agents that read bodies, not headers.
          return send(res, 402, {
            jsonrpc: '2.0', id: call.id,
            error: { code: -32042, message: `payment required: ${c.amountSats} sats for ${call.name}`, data: { l402: { macaroon: c.token, invoice: c.invoice, amountSats: c.amountSats, priceUsd: c.priceUsd }, reason: verdict.reason } },
          }, { 'www-authenticate': c.header });
        }
      }
    }

    const answer = mcp.handleText(text);
    return answer === undefined ? send(res, 202) : send(res, 200, answer);
  };

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const signer = signerFromEnv();
  const l402 = l402FromEnv();
  createServer(createHttpHandler(createVandelayServer(signer, process.env.VIEWER_URL ? { viewerUrl: process.env.VIEWER_URL } : {}), { allowedOrigins, publicKey: signer.publicKey, ...(l402 ? { l402 } : {}) })).listen(port, host, () => {
    process.stderr.write(`vandelay mcp on http://${host}:${port}/mcp, receipts signed by ${signer.publicKey.keyId}, payments ${l402 ? `L402 via ${l402.provider}` : 'off'}\n`);
  });
}
