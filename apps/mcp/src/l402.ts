/**
 * Pay-per-call over Lightning with L402 (HTTP 402 "Payment Required").
 *
 * Off unless L402_ENABLED=1. When on, a paid tools/call without a valid
 * credential is answered with 402 and
 *
 *   WWW-Authenticate: L402 macaroon="<token>", invoice="<bolt11>"
 *
 * The agent pays the invoice, learns the preimage, and repeats the same call
 * with
 *
 *   Authorization: L402 <token>:<preimage hex>
 *
 * Why in-process instead of Aperture: every MCP call is a POST to /mcp, so a
 * path-based proxy cannot price one tool differently from another. Here the
 * price comes from the JSON-RPC tool name.
 *
 * The token is an HMAC-signed claim (payment hash, tool, input hash, price,
 * expiry), opaque to clients exactly like a macaroon, but without macaroon
 * caveats. A credential pays for one tool on one input until it expires; the
 * engines are deterministic, so a retry of the same call gets the same answer.
 *
 * Vandelay only receives payment for its own calls. Nothing here holds or
 * forwards anyone else's funds.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Placeholder prices in US dollars, per call. Free tools are not listed. */
export const PRICES_USD: Readonly<Record<string, number>> = {
  home_optionsFromPrompt: 0.5,
  home_proposeOptions: 0.5,
  home_evaluate: 0.1,
  intent_patch: 0.1,
};

export interface Invoice {
  readonly bolt11: string;
  /** hex sha256 of the preimage. */
  readonly paymentHash: string;
}

export interface InvoiceProvider {
  readonly name: string;
  readonly createInvoice: (p: { amountSats: number; memo: string; expirySec: number }) => Promise<Invoice>;
}

const sha256 = (b: Buffer): Buffer => createHash('sha256').update(b).digest();

/**
 * For tests and local development: makes invoice-shaped strings and keeps the
 * preimages so `pay` can play the agent's wallet. Moves no money.
 */
export const createFakeProvider = () => {
  const preimages = new Map<string, string>();
  return {
    name: 'fake',
    createInvoice: async ({ amountSats }: { amountSats: number }) => {
      const preimage = randomBytes(32);
      const paymentHash = sha256(preimage).toString('hex');
      const bolt11 = `lnfake${amountSats}n1${paymentHash}`;
      preimages.set(bolt11, preimage.toString('hex'));
      return { bolt11, paymentHash };
    },
    /** What a wallet returns after paying: the preimage. */
    pay: (bolt11: string): string => {
      const p = preimages.get(bolt11);
      if (!p) throw new Error('unknown fake invoice');
      return p;
    },
  } satisfies InvoiceProvider & { pay: (bolt11: string) => string };
};

/**
 * LND's REST API (POST /v1/invoices) with an invoice-only macaroon, the
 * least-privilege role Lightning Labs recommends for agents. Written to LND's
 * documented API; not yet run against a live node.
 */
export const createLndRestProvider = (p: { url: string; invoiceMacaroonHex: string; fetchImpl?: typeof fetch }): InvoiceProvider => ({
  name: 'lnd',
  createInvoice: async ({ amountSats, memo, expirySec }) => {
    const res = await (p.fetchImpl ?? fetch)(`${p.url.replace(/\/$/, '')}/v1/invoices`, {
      method: 'POST',
      headers: { 'Grpc-Metadata-macaroon': p.invoiceMacaroonHex, 'content-type': 'application/json' },
      body: JSON.stringify({ value: String(amountSats), memo, expiry: String(expirySec) }),
    });
    if (!res.ok) throw new Error(`lnd invoice failed: HTTP ${res.status}`);
    const body = (await res.json()) as { payment_request?: string; r_hash?: string };
    if (!body.payment_request || !body.r_hash) throw new Error('lnd invoice: missing payment_request or r_hash');
    return { bolt11: body.payment_request, paymentHash: Buffer.from(body.r_hash, 'base64').toString('hex') };
  },
});

interface Claim {
  readonly v: 1;
  readonly ph: string;
  readonly tool: string;
  readonly input: string;
  readonly sats: number;
  readonly exp: number;
}

export type L402Check = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export interface L402Options {
  /** HMAC key for tokens; at least 32 bytes. */
  readonly secret: string;
  readonly provider: InvoiceProvider;
  /** Fixed conversion until a price feed is wired in. Prices stay set in dollars. */
  readonly satsPerUsd: number;
  readonly prices?: Readonly<Record<string, number>>;
  readonly ttlSec?: number;
  readonly now?: () => number;
}

export const createL402 = (o: L402Options) => {
  if (Buffer.byteLength(o.secret) < 32) throw new Error('L402 secret must be at least 32 bytes');
  if (!(o.satsPerUsd > 0)) throw new Error('satsPerUsd must be positive');
  const prices = o.prices ?? PRICES_USD;
  const ttl = o.ttlSec ?? 3600;
  const now = o.now ?? (() => Date.now());
  const mac = (payload: string): Buffer => createHmac('sha256', o.secret).update(payload).digest();

  /** Price in sats, or 0 for a free tool. At least 1 sat when paid. */
  const priceSats = (tool: string): number => {
    const usd = prices[tool];
    return usd === undefined || usd <= 0 ? 0 : Math.max(1, Math.round(usd * o.satsPerUsd));
  };

  const challenge = async (tool: string, inputHash: string) => {
    const sats = priceSats(tool);
    const invoice = await o.provider.createInvoice({ amountSats: sats, memo: `vandelay ${tool}`, expirySec: ttl });
    const claim: Claim = { v: 1, ph: invoice.paymentHash, tool, input: inputHash, sats, exp: Math.floor(now() / 1000) + ttl };
    const payload = Buffer.from(JSON.stringify(claim)).toString('base64url');
    const token = `${payload}.${mac(payload).toString('base64url')}`;
    return {
      header: `L402 macaroon="${token}", invoice="${invoice.bolt11}"`,
      token,
      invoice: invoice.bolt11,
      amountSats: sats,
      priceUsd: prices[tool] ?? 0,
    };
  };

  const check = (authorization: string | undefined, tool: string, inputHash: string): L402Check => {
    const m = /^(?:L402|LSAT)\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+):([0-9a-fA-F]{64})$/.exec(authorization?.trim() ?? '');
    if (!m) return { ok: false, reason: 'no L402 credential' };
    const [, token, preimageHex] = m as unknown as [string, string, string];
    const [payload, sig] = token.split('.') as [string, string];
    const expected = mac(payload);
    const given = Buffer.from(sig, 'base64url');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return { ok: false, reason: 'token not issued by this server' };
    let claim: Claim;
    try {
      claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Claim;
    } catch {
      return { ok: false, reason: 'unreadable token' };
    }
    if (claim.exp * 1000 < now()) return { ok: false, reason: 'token expired' };
    if (claim.tool !== tool || claim.input !== inputHash) return { ok: false, reason: 'token was bought for a different call' };
    if (sha256(Buffer.from(preimageHex, 'hex')).toString('hex') !== claim.ph) return { ok: false, reason: 'preimage does not match the invoice' };
    return { ok: true };
  };

  return { priceSats, challenge, check, provider: o.provider.name };
};

export type L402 = ReturnType<typeof createL402>;

/** Reads L402_* settings. Returns undefined when payments are off. */
export const l402FromEnv = (env: NodeJS.ProcessEnv = process.env): L402 | undefined => {
  if (env.L402_ENABLED !== '1') return undefined;
  const secret = env.L402_SECRET;
  const satsPerUsd = Number(env.SATS_PER_USD);
  if (!secret) throw new Error('L402_ENABLED=1 needs L402_SECRET (32+ bytes)');
  if (!(satsPerUsd > 0)) throw new Error('L402_ENABLED=1 needs SATS_PER_USD (a positive number)');
  const backend = env.L402_BACKEND ?? 'fake';
  let provider: InvoiceProvider;
  if (backend === 'lnd') {
    if (!env.LND_REST_URL || !env.LND_INVOICE_MACAROON) throw new Error('L402_BACKEND=lnd needs LND_REST_URL and LND_INVOICE_MACAROON (hex)');
    provider = createLndRestProvider({ url: env.LND_REST_URL, invoiceMacaroonHex: env.LND_INVOICE_MACAROON });
  } else if (backend === 'fake') {
    provider = createFakeProvider();
  } else {
    throw new Error(`unknown L402_BACKEND: ${backend}`);
  }
  return createL402({ secret, provider, satsPerUsd });
};
