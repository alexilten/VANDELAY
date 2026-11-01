import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpHandler } from './http.ts';
import { createFakeProvider, createL402, createLndRestProvider, l402FromEnv } from './l402.ts';
import { createVandelayServer } from './server.ts';
import { createSigner } from './signing.ts';

const SECRET = 'test-secret-that-is-at-least-32-bytes-long';
const wallet = createFakeProvider();
let clock = Date.parse('2026-11-01T00:00:00Z');
const l402 = createL402({ secret: SECRET, provider: wallet, satsPerUsd: 1000, now: () => clock });

let server: Server;
let base: string;
beforeAll(async () => {
  server = createServer(createHttpHandler(createVandelayServer(createSigner()), { l402 }));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/mcp`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

const callBody = (prompt: string) => ({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'home_optionsFromPrompt', arguments: { prompt } } });
const post = (body: unknown, auth?: string) =>
  fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) }, body: JSON.stringify(body) });

const pay = async (prompt: string) => {
  const res = await post(callBody(prompt));
  const header = res.headers.get('www-authenticate') ?? '';
  const [, token, invoice] = /macaroon="([^"]+)", invoice="([^"]+)"/.exec(header) ?? [];
  return { res, token: token!, invoice: invoice!, body: await res.json() };
};

describe('L402 pay-per-call', () => {
  it('prices in dollars and converts to sats; free tools stay free', () => {
    expect(l402.priceSats('home_optionsFromPrompt')).toBe(500);
    expect(l402.priceSats('intent_patch')).toBe(100);
    expect(l402.priceSats('intent_validate')).toBe(0);
    expect(l402.priceSats('receipt_verify')).toBe(0);
  });

  it('answers an unpaid call with 402, an invoice and the same challenge in the body', async () => {
    const { res, token, invoice, body } = await pay('a small cabin');
    expect(res.status).toBe(402);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(invoice).toMatch(/^lnfake500n1/);
    expect(body).toMatchObject({ jsonrpc: '2.0', id: 7, error: { code: -32042, data: { l402: { amountSats: 500, priceUsd: 0.5 }, reason: 'no L402 credential' } } });
  });

  it('serves the call once the invoice is paid, and lets the same call retry', async () => {
    const { token, invoice } = await pay('a small cabin');
    const auth = `L402 ${token}:${wallet.pay(invoice)}`;
    for (let i = 0; i < 2; i++) {
      const ok = await post(callBody('a small cabin'), auth);
      expect(ok.status).toBe(200);
      expect((await ok.json()).result.structuredContent.options).toHaveLength(3);
    }
  });

  it('refuses a credential for another call, a wrong preimage, a forged token or an expired one', async () => {
    const { token, invoice } = await pay('a small cabin');
    const preimage = wallet.pay(invoice);
    expect((await (await post(callBody('a mansion'), `L402 ${token}:${preimage}`)).json()).error.data.reason).toBe('token was bought for a different call');
    expect((await (await post(callBody('a small cabin'), `L402 ${token}:${'0'.repeat(64)}`)).json()).error.data.reason).toBe('preimage does not match the invoice');
    const forged = `${token.split('.')[0]}.${'A'.repeat(43)}`;
    expect((await (await post(callBody('a small cabin'), `L402 ${forged}:${preimage}`)).json()).error.data.reason).toBe('token not issued by this server');
    clock += 2 * 3600 * 1000;
    expect((await (await post(callBody('a small cabin'), `L402 ${token}:${preimage}`)).json()).error.data.reason).toBe('token expired');
    clock -= 2 * 3600 * 1000;
  });

  it('never charges for the handshake, listing tools or free tools', async () => {
    expect((await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })).status).toBe(200);
    expect((await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).status).toBe(200);
    expect((await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'intent_validate', arguments: { intent: {} } } })).status).toBe(200);
  });
});

describe('L402 configuration', () => {
  it('is off unless L402_ENABLED=1, and refuses half a config', () => {
    expect(l402FromEnv({})).toBeUndefined();
    expect(() => l402FromEnv({ L402_ENABLED: '1' })).toThrow(/L402_SECRET/);
    expect(() => l402FromEnv({ L402_ENABLED: '1', L402_SECRET: SECRET })).toThrow(/SATS_PER_USD/);
    expect(() => l402FromEnv({ L402_ENABLED: '1', L402_SECRET: SECRET, SATS_PER_USD: '1000', L402_BACKEND: 'lnd' })).toThrow(/LND_REST_URL/);
    expect(l402FromEnv({ L402_ENABLED: '1', L402_SECRET: SECRET, SATS_PER_USD: '1000' })?.provider).toBe('fake');
    expect(() => createL402({ secret: 'short', provider: wallet, satsPerUsd: 1 })).toThrow(/32 bytes/);
  });

  it('asks LND for an invoice with the invoice-only macaroon and reads the hash', async () => {
    const seen: { url?: string; init?: RequestInit } = {};
    const fakeFetch = (async (url: string, init: RequestInit) => {
      seen.url = url;
      seen.init = init;
      return new Response(JSON.stringify({ payment_request: 'lnbc5u1test', r_hash: Buffer.alloc(32, 7).toString('base64') }), { status: 200 });
    }) as unknown as typeof fetch;
    const lnd = createLndRestProvider({ url: 'https://node.example:8080/', invoiceMacaroonHex: 'abcd', fetchImpl: fakeFetch });
    const inv = await lnd.createInvoice({ amountSats: 500, memo: 'm', expirySec: 60 });
    expect(seen.url).toBe('https://node.example:8080/v1/invoices');
    expect((seen.init?.headers as Record<string, string>)['Grpc-Metadata-macaroon']).toBe('abcd');
    expect(JSON.parse(String(seen.init?.body))).toEqual({ value: '500', memo: 'm', expiry: '60' });
    expect(inv).toEqual({ bolt11: 'lnbc5u1test', paymentHash: '07'.repeat(32) });
  });
});
