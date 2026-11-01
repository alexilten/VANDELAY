import { generateKeyPairSync } from 'node:crypto';
import { RULES_HASH, canonicalClaims, hashJson, type Receipt } from '@vandelay/agent';
import { describe, expect, it } from 'vitest';
import { createVandelayServer } from './server.ts';
import { createSigner } from './signing.ts';

const pem = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const signer = createSigner({ pem, now: () => new Date('2026-11-01T00:00:00Z') });
const server = createVandelayServer(signer);

let nextId = 1;
const call = (name: string, args: Record<string, unknown>) => {
  const r = server.handle({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } }) as { result: { isError: boolean; structuredContent: Record<string, unknown> } };
  return r.result;
};

const options = () => call('home_optionsFromPrompt', { prompt: 'a one-bedroom backyard cottage, step-free' });

describe('signed receipts', () => {
  it('signs every successful result with the claims an agent needs', () => {
    const out = options().structuredContent;
    const receipt = out.receipt as Receipt;
    expect(receipt).toMatchObject({ format: 'vandelay.receipt/0', tool: 'home.optionsFromPrompt', alg: 'Ed25519', rulesHash: RULES_HASH, issuedAt: '2026-11-01T00:00:00.000Z' });
    expect(receipt.keyId).toMatch(/^vandelay:[0-9a-f]{16}$/);
    const { receipt: _r, ...rest } = out;
    expect(receipt.resultHash).toBe(hashJson(rest));
    expect(receipt.intents.length).toBeGreaterThanOrEqual(3);
    expect(canonicalClaims(receipt)).not.toContain('sig');
  });

  it('is deterministic apart from the time: the same call gives the same result hash', () => {
    expect((options().structuredContent.receipt as Receipt).resultHash).toBe((options().structuredContent.receipt as Receipt).resultHash);
  });

  it('leaves failures unsigned', () => {
    const r = call('intent_validate', { intent: { nope: true } });
    expect(r.isError).toBe(true);
    expect(r.structuredContent.receipt).toBeUndefined();
  });
});

describe('approval links', () => {
  it('carry only the receipt and input, and still verify with the link fields present', () => {
    const viewer = createVandelayServer(signer, { viewerUrl: 'https://viewer.example/app/' });
    const r = viewer.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'home_optionsFromPrompt', arguments: { prompt: 'a cabin' } } }) as { result: { structuredContent: { receipt: Receipt; approvalUrl: string } } };
    const out = r.result.structuredContent;
    const url = new URL(out.approvalUrl);
    expect(url.origin + url.pathname).toBe('https://viewer.example/app/');
    const params = new URLSearchParams(url.hash.slice(1));
    expect(params.get('v')).toBe('0');
    expect(JSON.parse(Buffer.from(params.get('receipt')!, 'base64url').toString())).toEqual(out.receipt);
    expect(JSON.parse(Buffer.from(params.get('input')!, 'base64url').toString())).toEqual({ prompt: 'a cabin' });
    expect(out.approvalUrl.length).toBeLessThan(3000);
    expect(call('receipt_verify', { receipt: out.receipt, result: out }).structuredContent).toMatchObject({ ok: true, resultMatches: true });
  });
});

describe('receipt_verify', () => {
  it('accepts an untouched receipt and result', () => {
    const out = options().structuredContent;
    const v = call('receipt_verify', { receipt: out.receipt, result: out });
    expect(v.structuredContent).toMatchObject({ ok: true, signature: 'valid', resultMatches: true, current: { engine: true, rules: true }, problems: [] });
    expect(v.structuredContent.receipt).toBeUndefined();
  });

  it('catches a tampered result, a tampered claim and a foreign key', () => {
    const out = options().structuredContent;
    const receipt = out.receipt as Receipt;
    const edited = { ...out, note: 'trust me, it passes' };
    expect(call('receipt_verify', { receipt, result: edited }).structuredContent).toMatchObject({ ok: false, signature: 'valid', resultMatches: false });

    const forged = { ...receipt, resultHash: hashJson({ fake: true }) };
    expect(call('receipt_verify', { receipt: forged }).structuredContent).toMatchObject({ ok: false, signature: 'invalid' });

    const other = createVandelayServer(createSigner());
    const foreign = (other.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'home_optionsFromPrompt', arguments: { prompt: 'a cabin' } } }) as { result: { structuredContent: { receipt: Receipt } } }).result.structuredContent.receipt;
    expect(call('receipt_verify', { receipt: foreign }).structuredContent).toMatchObject({ ok: false, signature: 'unknown-key' });
  });

  it('refuses a non-Ed25519 key', () => {
    const rsa = generateKeyPairSync('rsa', { modulusLength: 1024 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    expect(() => createSigner({ pem: rsa })).toThrow(/Ed25519/);
  });
});
