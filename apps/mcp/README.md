# @vandelay/mcp

Serves Vandelay's engine tools to outside agents over the [Model Context Protocol](https://modelcontextprotocol.io). The protocol handling is the pure `createMcpServer` in `packages/agent/src/mcp.ts`; this app only moves bytes.

## Run

```sh
# stdio (Claude Code, Claude Desktop, any local MCP client)
node apps/mcp/src/stdio.ts
claude mcp add vandelay -- node "$(pwd)/apps/mcp/src/stdio.ts"

# Streamable HTTP, stateless: POST /mcp, GET /health
PORT=8787 node apps/mcp/src/http.ts
curl -s localhost:8787/mcp -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"home_optionsFromPrompt","arguments":{"prompt":"a one-bedroom backyard cottage, step-free"}}}'
```

Node 22.18 or newer runs the TypeScript directly; there is no build step.

## Tools

| MCP name | Does |
| --- | --- |
| `home_optionsFromPrompt` | Three home options from a prompt on an **example** California lot. Start here. |
| `intent_validate` | Every problem in an intent, with its JSON Pointer. |
| `home_evaluate` | Solve one intent. |
| `home_proposeOptions` | Three options for an intent. |
| `intent_patch` | Change an intent with RFC 6902 JSON Patch; it is validated and solved again. |
| `explain` | "Why?" for any number in a result, by JSON Pointer. |
| `receipt_verify` | Free. Was this receipt signed by Vandelay, does the result still match it, and was it made by the current engine and rules? |

## Receipts

Every successful result carries a `receipt` in its `structuredContent`. The receipt holds:

- the tool name, the engine version and `rulesHash`, a fingerprint of every rule and citation the engine can apply;
- `inputHash` and `resultHash`, SHA-256 hashes of key-sorted JSON (`resultHash` covers the structuredContent without the receipt itself);
- `intents`: every intent hash in the result;
- `issuedAt`, `keyId`, and an Ed25519 `sig` over those claims.

The engines are deterministic, so the same call always gives the same `resultHash`. Anyone can run it again and compare. The public key is served at `GET /.well-known/vandelay-keys.json`.

To set the key, pass `VANDELAY_SIGNING_KEY` (a PKCS#8 PEM, Ed25519). You can generate one with `openssl genpkey -algorithm ed25519`. Without it, the server makes a throwaway key at start-up and its key id begins `ephemeral:`. Receipts signed with it can only be checked against that running server.

The text a model reads is compact: geometry and piers are left out and each traced number becomes `{ value, unit }`. `structuredContent` carries the full result, and `explain` returns any trace.

## Approval links

Set `VIEWER_URL` and every signed result also carries an `approvalUrl`: `<VIEWER_URL>#v=0&receipt=<base64url>&input=<base64url>`. An agent can hand that link to its person. The viewer re-runs the same deterministic tool on the input, checks the result against `resultHash`, then checks the signature. That way the link stays small (1 to 2 KB), and the person sees exactly what the agent got. `receipt_verify` ignores `receipt` and `approvalUrl` when it hashes a result.

## Paid calls (L402, off by default)

With `L402_ENABLED=1`, the paid tools need a Lightning payment per call. Everything else stays free: the handshake, `tools/list`, `intent_validate`, `explain` and `receipt_verify`.

1. The agent calls a paid tool with no credential and gets HTTP 402 back. The response carries `WWW-Authenticate: L402 macaroon="<token>", invoice="<bolt11>"`, and the same challenge appears in a JSON-RPC error (`-32042`).
2. The agent pays the invoice and keeps the preimage.
3. The agent repeats the same call with `Authorization: L402 <token>:<preimage>`.

A credential pays for one tool on one input until it expires (1 hour). Retries of that same call are free, because the answer is the same.

| Tool | Price (placeholder) |
| --- | --- |
| `home_optionsFromPrompt`, `home_proposeOptions` | $0.50 |
| `home_evaluate`, `intent_patch` | $0.10 |

Prices are set in dollars and converted with `SATS_PER_USD`, which is a fixed rate until a price feed is wired in.

| Variable | Meaning |
| --- | --- |
| `L402_ENABLED` | `1` to turn payments on |
| `L402_SECRET` | HMAC key for tokens, 32+ bytes |
| `SATS_PER_USD` | Conversion rate |
| `L402_BACKEND` | `fake` (default; moves no money, for dev) or `lnd` |
| `LND_REST_URL`, `LND_INVOICE_MACAROON` | For `lnd`: the node's REST URL and an invoice-only macaroon, hex |

**Why this isn't Aperture:** every MCP call is a POST to `/mcp`, so a proxy that prices by path can't charge per tool. The token is an HMAC-signed claim. Clients treat it as opaque, just like a macaroon, but it has no caveats. Vandelay only receives payment for its own calls. The LND adapter follows LND's REST API but hasn't been run against a live node yet.

## Not yet

- **Live Lightning:** run the `lnd` backend against a real node (testnet first), and add a price feed.
- **Real parcels:** sites are example data until `site.fetch` ships. Results say so.
- Browser origins are refused unless listed in `ALLOWED_ORIGINS`; the server binds to `127.0.0.1` unless `HOST` is set.
