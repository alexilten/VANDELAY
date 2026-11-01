// @vitest-environment node
import { generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { canonicalClaims, promptTool, receiptClaims, type Receipt } from '@vandelay/agent';
import { makeExampleRequest } from './example';
import {
  APPROVAL_REQUEST_FORMAT,
  approvalLink,
  approvalRecord,
  isApprovalLink,
  parseApprovalRequest,
  requestFromLink,
  verifyRequest,
  type PublicKeyInfo,
} from './verify';

// Signs like apps/mcp's signer does, so these tests pin the shared format.
function signed(keyId = 'vandelay:0123456789abcdef') {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const input = { prompt: 'a one-bedroom backyard cottage' };
  const result = JSON.parse(JSON.stringify(promptTool.run(input))) as Record<string, unknown>;
  const claims = receiptClaims({ tool: promptTool.name, input, result, issuedAt: '2026-11-01T12:00:00.000Z', keyId });
  const receipt: Receipt = { ...claims, alg: 'Ed25519', sig: sign(null, Buffer.from(canonicalClaims(claims)), privateKey).toString('base64url') };
  const key: PublicKeyInfo = { keyId, alg: 'Ed25519', publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString() };
  return { input, result: { ...result, receipt }, receipt, key };
}

describe('approval requests', () => {
  it('reads a bare signed result and a wrapper with keys', () => {
    const s = signed();
    const bare = parseApprovalRequest(JSON.stringify(s.result));
    expect('error' in bare).toBe(false);
    const wrapped = parseApprovalRequest(JSON.stringify({ format: APPROVAL_REQUEST_FORMAT, result: s.result, keys: [s.key, { junk: 1 }] }));
    expect('error' in wrapped ? [] : wrapped.keys).toEqual([s.key]);
  });

  it('explains what is wrong with bad input', () => {
    expect(parseApprovalRequest('nope')).toHaveProperty('error');
    expect(parseApprovalRequest('{"options":[]}')).toHaveProperty('error');
  });
});

describe('verifyRequest', () => {
  it('passes a trusted, untouched receipt', async () => {
    const s = signed();
    const r = await verifyRequest({ result: s.result, receipt: s.receipt, keys: [] }, [s.key]);
    expect(r).toMatchObject({ intact: true, signature: 'valid', keyTrust: 'trusted', resultMatches: true, engineCurrent: true, rulesCurrent: true, devKey: false });
  });

  it('checks the maths with a key from the file, but does not call it trusted', async () => {
    const s = signed('ephemeral:00112233aabbccdd');
    const r = await verifyRequest({ result: s.result, receipt: s.receipt, keys: [s.key] }, []);
    expect(r).toMatchObject({ intact: true, keyTrust: 'provided', devKey: true });
  });

  it('catches a design changed after signing', async () => {
    const s = signed();
    const tampered = { ...s.result, note: 'trust me' };
    const r = await verifyRequest({ result: tampered, receipt: s.receipt, keys: [] }, [s.key]);
    expect(r.resultMatches).toBe(false);
    expect(r.intact).toBe(false);
  });

  it('catches a changed receipt', async () => {
    const s = signed();
    const receipt = { ...s.receipt, issuedAt: '2030-01-01T00:00:00.000Z' };
    const r = await verifyRequest({ result: { ...s.result, receipt }, receipt, keys: [] }, [s.key]);
    expect(r.signature).toBe('invalid');
  });

  it('ignores the approvalUrl envelope field when hashing', async () => {
    const s = signed();
    const r = await verifyRequest({ result: { ...s.result, approvalUrl: 'https://example.com/#v=0' }, receipt: s.receipt, keys: [] }, [s.key]);
    expect(r.resultMatches).toBe(true);
  });

  it('reports an unknown key instead of guessing', async () => {
    const s = signed();
    const r = await verifyRequest({ result: s.result, receipt: s.receipt, keys: [] }, []);
    expect(r.signature).toBe('unknown-key');
    expect(r.resultMatches).toBe(true);
  });
});

describe('share links', () => {
  it('round-trips: the viewer re-runs the tool and gets the signed result', async () => {
    const s = signed();
    const link = approvalLink('https://alexilten.github.io/VANDELAY/', s.receipt, s.input);
    const hash = link.slice(link.indexOf('#'));
    expect(isApprovalLink(hash)).toBe(true);
    expect(hash.length).toBeLessThan(3000);
    const req = requestFromLink(hash);
    if ('error' in req) throw new Error(req.error);
    const r = await verifyRequest(req, [s.key]);
    expect(r).toMatchObject({ intact: true, resultMatches: true });
  });

  it('refuses a link whose input was swapped', () => {
    const s = signed();
    const link = approvalLink('x', s.receipt, { prompt: 'a mansion' });
    expect(requestFromLink(link.slice(1))).toHaveProperty('error');
  });
});

describe('example and approval record', () => {
  it('makes a signed example that verifies with its own key', async () => {
    const { request } = await makeExampleRequest();
    const r = await verifyRequest(request, []);
    expect(r).toMatchObject({ intact: true, keyTrust: 'provided', devKey: true });
  });

  it('records which signed design and option were approved', () => {
    const s = signed();
    const a = approvalRecord({ result: s.result, receipt: s.receipt, keys: [] }, { index: 1, label: 'B', intentHash: 'abc' }, new Date('2026-11-01T00:00:00Z'));
    expect(a).toMatchObject({ format: 'vandelay.approval/0', receiptSig: s.receipt.sig, resultHash: s.receipt.resultHash, option: { index: 1, intentHash: 'abc' }, approvedAt: '2026-11-01T00:00:00.000Z' });
  });
});
