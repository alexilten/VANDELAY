/**
 * MCP over Streamable HTTP, stateless: each POST /mcp carries one JSON-RPC
 * message and gets a JSON answer (or 202 for a notification). No sessions and
 * no server-to-client stream, because every tool is a pure function of its
 * input. Paid calls (L402) will sit in front of this as a proxy.
 *
 *   PORT=8787 node apps/mcp/src/http.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createMcpServer, type McpServer } from '@vandelay/agent';

/** Requests larger than this are refused; an intent is a few kilobytes. */
export const MAX_BODY_BYTES = 1_000_000;

export interface HttpOptions {
  /** Browser origins allowed to call. Requests with no Origin header (agents, curl) are always allowed. */
  readonly allowedOrigins?: readonly string[];
}

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

export const createHttpHandler = (mcp: McpServer = createMcpServer(), opts: HttpOptions = {}) =>
  async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/health') return send(res, 200, { ok: true, name: mcp.info.name, version: mcp.info.version });
    if (url.pathname !== '/mcp') return send(res, 404, { error: 'not found; MCP lives at /mcp' });

    // The spec asks servers to check Origin, so a web page cannot drive a local server (DNS rebinding).
    const origin = req.headers.origin;
    if (origin !== undefined && !(opts.allowedOrigins ?? []).includes(origin)) return send(res, 403, { error: `origin not allowed: ${origin}` });

    if (req.method === 'GET') return send(res, 405, undefined, { allow: 'POST, DELETE' });
    if (req.method === 'DELETE') return send(res, 405, undefined, { allow: 'POST' }); // stateless: no session to end
    if (req.method !== 'POST') return send(res, 405, undefined, { allow: 'POST' });

    const text = await readBody(req);
    if (text === undefined) return send(res, 413, { error: `body over ${MAX_BODY_BYTES} bytes` });
    const answer = mcp.handleText(text);
    return answer === undefined ? send(res, 202) : send(res, 200, answer);
  };

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  createServer(createHttpHandler(createMcpServer(), { allowedOrigins })).listen(port, host, () => {
    process.stderr.write(`vandelay mcp on http://${host}:${port}/mcp\n`);
  });
}
