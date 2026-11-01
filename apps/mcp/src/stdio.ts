/**
 * MCP over stdio: one JSON-RPC message per line in, one per line out.
 * Logs go to stderr, because stdout belongs to the protocol.
 *
 *   node apps/mcp/src/stdio.ts
 *
 * In Claude Code: `claude mcp add vandelay -- node /path/to/apps/mcp/src/stdio.ts`
 */
import { createInterface } from 'node:readline';
import { createVandelayServer } from './server.ts';
import { signerFromEnv } from './signing.ts';

const signer = signerFromEnv();
const server = createVandelayServer(signer, process.env.VIEWER_URL ? { viewerUrl: process.env.VIEWER_URL } : {});
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });

lines.on('line', (line) => {
  if (line.trim() === '') return;
  const res = server.handleText(line);
  if (res) process.stdout.write(`${JSON.stringify(res)}\n`);
});

process.stderr.write(`vandelay mcp ${server.info.version} on stdio, ${server.tools.length} tools, receipts signed by ${signer.publicKey.keyId}\n`);
