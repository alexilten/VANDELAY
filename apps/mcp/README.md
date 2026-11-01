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

The text a model reads is compact: geometry and piers are left out and each traced number becomes `{ value, unit }`. `structuredContent` carries the full result, and `explain` returns any trace.

## Not yet

- **Signed receipts** and `receipt.verify` (next).
- **Paid calls:** L402 through an Aperture proxy in front of the HTTP server, so the server stays payment-free.
- **Real parcels:** sites are example data until `site.fetch` ships. Results say so.
- Browser origins are refused unless listed in `ALLOWED_ORIGINS`; the server binds to `127.0.0.1` unless `HOST` is set.
