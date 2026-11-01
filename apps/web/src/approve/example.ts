/**
 * An example approval request, made entirely in this browser.
 *
 * Runs the real `home.optionsFromPrompt` tool, then signs a receipt with a
 * throwaway Ed25519 key generated here. The key id starts with "example:" and
 * the key travels in the file, so the viewer shows it as an example key, never
 * as Vandelay's.
 */
import { canonicalClaims, promptTool, receiptClaims, type Receipt } from '@vandelay/agent';
import { sha256Hex } from '@vandelay/kernel';
import { APPROVAL_REQUEST_FORMAT, type ApprovalRequest, type PublicKeyInfo } from './verify';

export const EXAMPLE_PROMPT = 'A one-bedroom backyard cottage for my mom, step-free';

const b64 = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
const b64url = (bytes: Uint8Array) => b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export async function makeExampleRequest(prompt = EXAMPLE_PROMPT): Promise<{ request: ApprovalRequest; input: { prompt: string }; file: string }> {
  const subtle = globalThis.crypto.subtle;
  const pair = (await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
  const keyId = `example:${sha256Hex(hex(spki)).slice(0, 16)}`;
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64(spki).replace(/(.{64})/g, '$1\n')}\n-----END PUBLIC KEY-----\n`;
  const key: PublicKeyInfo = { keyId, alg: 'Ed25519', publicKey: pem };

  const input = { prompt };
  const result = JSON.parse(JSON.stringify(promptTool.run(input))) as Record<string, unknown>;
  const claims = receiptClaims({ tool: promptTool.name, input, result, issuedAt: new Date().toISOString(), keyId });
  const sig = new Uint8Array(await subtle.sign({ name: 'Ed25519' }, pair.privateKey, new TextEncoder().encode(canonicalClaims(claims))));
  const receipt: Receipt = { ...claims, alg: 'Ed25519', sig: b64url(sig) };
  const signed = { ...result, receipt };
  const file = JSON.stringify({ format: APPROVAL_REQUEST_FORMAT, result: signed, keys: [key] }, null, 2);
  return { request: { result: signed, receipt, keys: [key], input }, input, file };
}
