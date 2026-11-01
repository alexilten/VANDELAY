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

## Not yet

- **Paid calls:** L402 through an Aperture proxy in front of the HTTP server, so the server stays payment-free.
- **Real parcels:** sites are example data until `site.fetch` ships. Results say so.
- Browser origins are refused unless listed in `ALLOWED_ORIGINS`; the server binds to `127.0.0.1` unless `HOST` is set.
