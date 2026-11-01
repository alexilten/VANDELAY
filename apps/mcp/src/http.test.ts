import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpHandler } from './http.ts';
import { createVandelayServer } from './server.ts';
import { createSigner } from './signing.ts';

let server: Server;
let base: string;

beforeAll(async () => {
  const signer = createSigner();
  server = createServer(createHttpHandler(createVandelayServer(signer), { allowedOrigins: ['https://vandelay.example'], publicKey: signer.publicKey }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const post = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) });

describe('MCP over HTTP', () => {
  it('runs a whole session: initialize, initialized, list, call', async () => {
    const init = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } } });
    expect(init.status).toBe(200);
    expect((await init.json()).result.serverInfo.name).toBe('vandelay');

    expect((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status).toBe(202);

    const list = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json();
    expect(list.result.tools.length).toBeGreaterThanOrEqual(6);

    const call = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'home_optionsFromPrompt', arguments: { prompt: 'a two bedroom cabin with views' } } })).json();
    expect(call.result.isError).toBe(false);
    expect(call.result.structuredContent.options).toHaveLength(3);
  });

  it('refuses foreign browser origins and allows listed ones', async () => {
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://evil.example' })).status).toBe(403);
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, { origin: 'https://vandelay.example' })).status).toBe(200);
  });

  it('answers bad JSON with a JSON-RPC parse error, GET with 405, and has a health check', async () => {
    const bad = await fetch(`${base}/mcp`, { method: 'POST', body: '{oops' });
    expect((await bad.json()).error.code).toBe(-32700);
    expect((await fetch(`${base}/mcp`)).status).toBe(405);
    expect((await (await fetch(`${base}/health`)).json()).ok).toBe(true);
    const keys = await (await fetch(`${base}/.well-known/vandelay-keys.json`)).json();
    expect(keys.keys[0].keyId).toMatch(/^ephemeral:[0-9a-f]{16}$/);
  });
});
