/**
 * Signs receipts with Ed25519 and checks them.
 *
 * The key comes from VANDELAY_SIGNING_KEY (a PKCS#8 PEM). Without it the
 * server makes a throwaway key at start-up, and its key id says "ephemeral",
 * so nobody mistakes a dev receipt for a production one.
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { canonicalClaims, receiptClaims, type Receipt, type ReceiptClaims } from '@vandelay/agent';

export interface PublicKeyInfo {
  readonly keyId: string;
  readonly alg: 'Ed25519';
  /** SubjectPublicKeyInfo, PEM. */
  readonly publicKey: string;
}

export interface Signer {
  readonly publicKey: PublicKeyInfo;
  readonly sign: (p: { tool: string; input: unknown; result: unknown }) => Receipt;
  /** Checks a receipt's signature against this server's key(s). */
  readonly verifySignature: (r: Receipt) => boolean;
}

const b64url = (b: Buffer): string => b.toString('base64url');

const keyIdOf = (pub: KeyObject, ephemeral: boolean): string => {
  const der = pub.export({ type: 'spki', format: 'der' });
  return `${ephemeral ? 'ephemeral' : 'vandelay'}:${createHash('sha256').update(der).digest('hex').slice(0, 16)}`;
};

export const createSigner = (opts: { pem?: string; now?: () => Date } = {}): Signer => {
  const ephemeral = !opts.pem;
  const priv = opts.pem ? createPrivateKey(opts.pem) : generateKeyPairSync('ed25519').privateKey;
  if (priv.asymmetricKeyType !== 'ed25519') throw new Error('VANDELAY_SIGNING_KEY must be an Ed25519 private key');
  const pub = createPublicKey(priv);
  const keyId = keyIdOf(pub, ephemeral);
  const now = opts.now ?? (() => new Date());
  const publicKey: PublicKeyInfo = { keyId, alg: 'Ed25519', publicKey: pub.export({ type: 'spki', format: 'pem' }).toString() };

  return {
    publicKey,
    sign: ({ tool, input, result }) => {
      const claims = receiptClaims({ tool, input, result, issuedAt: now().toISOString(), keyId });
      return { ...claims, alg: 'Ed25519', sig: b64url(sign(null, Buffer.from(canonicalClaims(claims)), priv)) };
    },
    verifySignature: (r) => {
      if (r.keyId !== keyId || r.alg !== 'Ed25519' || typeof r.sig !== 'string') return false;
      try {
        return verify(null, Buffer.from(canonicalClaims(r as ReceiptClaims)), pub, Buffer.from(r.sig, 'base64url'));
      } catch {
        return false;
      }
    },
  };
};

export const signerFromEnv = (env: NodeJS.ProcessEnv = process.env): Signer => {
  const pem = env.VANDELAY_SIGNING_KEY?.replace(/\\n/g, '\n');
  return createSigner(pem ? { pem } : {});
};
