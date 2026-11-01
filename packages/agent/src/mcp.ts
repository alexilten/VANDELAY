/**
 * A Model Context Protocol server for the engine tools, as one pure function:
 * a JSON-RPC message in, a JSON-RPC response (or nothing, for a notification)
 * out. Transports (stdio, HTTP) live in apps/mcp and only move bytes.
 *
 * No SDK: the protocol surface we need is small (initialize, ping, tools/list,
 * tools/call), and keeping it here keeps the agent package dependency-free and
 * runnable in Node, a worker or the browser.
 */
import { homeTools, type Tool } from './tools.ts';

/** Newest first. The server answers with the client's version when it knows it, else the newest. */
export const MCP_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;

export interface McpServerInfo {
  readonly name: string;
  readonly title?: string;
  readonly version: string;
}

export type JsonRpcId = string | number;

export interface JsonRpcRequest {
  readonly jsonrpc: '2.0';
  readonly id?: JsonRpcId | null;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { readonly jsonrpc: '2.0'; readonly id: JsonRpcId | null; readonly result: unknown }
  | { readonly jsonrpc: '2.0'; readonly id: JsonRpcId | null; readonly error: { readonly code: number; readonly message: string; readonly data?: unknown } };

export const RPC = { parseError: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internalError: -32603 } as const;

/**
 * MCP clients differ on which characters a tool name may hold; some reject
 * dots. Our tools are named `area.verb`, so MCP sees `area_verb`.
 */
export const mcpToolName = (name: string): string => name.replace(/[^A-Za-z0-9_-]/g, '_');

// Tools take different inputs; the server only passes JSON through, so it holds them loosely.
type AnyTool = Tool<never, unknown>;

export interface McpServerOptions {
  readonly info?: McpServerInfo;
  readonly tools?: readonly AnyTool[];
  readonly instructions?: string;
}

export const DEFAULT_INSTRUCTIONS = [
  'Vandelay compiles a building brief into verified designs. Agents propose, engines verify:',
  'you never write geometry or numbers; you change intent and the engine solves it.',
  'Start with home_optionsFromPrompt. Change a design with intent_patch. Ask "why?" about any number with explain.',
  'Sites and lot facts are EXAMPLE data until parcel lookup ships; say so when you show results to a person.',
].join(' ');

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const ok = (id: JsonRpcId | null, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });
const fail = (id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcResponse =>
  ({ jsonrpc: '2.0', id, error: data === undefined ? { code, message } : { code, message, data } });

/** MCP wants structuredContent to be an object, so arrays and scalars are wrapped. */
const structured = (value: unknown): Record<string, unknown> => (isObject(value) ? value : { result: value });

/** Keys left out of the model-facing text: bulky, and only a viewer needs them. */
const BULKY = new Set(['geometry', 'piers']);

const isTraced = (v: Record<string, unknown>): boolean => 'value' in v && 'formula' in v && 'reads' in v;

/**
 * The text a model reads. Results are large (geometry, a trace on every
 * number, a long check list), so the text keeps what an agent reasons with:
 * every traced number collapses to `{ value, unit }`, checks to id, status and
 * message, and geometry and piers are left out. structuredContent keeps the
 * full result, and `explain` returns any trace on demand.
 */
export const compactForModel = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(compactForModel);
  if (!isObject(value)) return value;
  if (isTraced(value)) return value.unit === undefined ? value.value : { value: value.value, unit: value.unit };
  if (typeof value.ruleId === 'string' && typeof value.status === 'string') {
    const measured = isObject(value.measured) ? compactForModel(value.measured) : undefined;
    return { ruleId: value.ruleId, status: value.status, message: value.message, ...(measured === undefined ? {} : { measured }), ...(value.limit === undefined ? {} : { limit: value.limit }) };
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value)) if (!BULKY.has(k)) out[k] = compactForModel(v);
  return out;
};

/** Every tool reports a failure the same way: `ok: false` with issues or a message. */
const toolFailed = (value: unknown): boolean => isObject(value) && value.ok === false;

export const createMcpServer = (opts: McpServerOptions = {}) => {
  const info: McpServerInfo = opts.info ?? { name: 'vandelay', title: 'Vandelay design compiler', version: '0.1.0' };
  const tools = opts.tools ?? (homeTools as readonly AnyTool[]);
  const byName = new Map(tools.map((t) => [mcpToolName(t.name), t] as const));
  if (byName.size !== tools.length) throw new Error('two tools map to the same MCP name');

  const listed = tools.map((t) => ({ name: mcpToolName(t.name), title: t.name, description: t.description, inputSchema: t.inputSchema }));

  const call = (id: JsonRpcId | null, params: Record<string, unknown>): JsonRpcResponse => {
    const name = params.name;
    if (typeof name !== 'string') return fail(id, RPC.invalidParams, 'tools/call needs a tool name');
    const tool = byName.get(name);
    if (!tool) return fail(id, RPC.invalidParams, `unknown tool: ${name}`);
    const args = params.arguments ?? {};
    if (!isObject(args)) return fail(id, RPC.invalidParams, 'tool arguments must be an object');
    for (const key of (tool.inputSchema.required as readonly string[] | undefined) ?? []) {
      if (!(key in args)) return ok(id, { content: [{ type: 'text', text: `missing argument: ${key}` }], isError: true });
    }
    try {
      const value = (tool.run as (input: unknown) => unknown)(args);
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(compactForModel(value)) }], structuredContent: structured(value), isError: toolFailed(value) });
    } catch (e) {
      // A tool that throws got input it could not use: report it to the model, not as a protocol error.
      return ok(id, { content: [{ type: 'text', text: `tool error: ${e instanceof Error ? e.message : String(e)}` }], isError: true });
    }
  };

  /** Handle one parsed JSON-RPC message. Returns undefined for notifications. */
  const handle = (msg: unknown): JsonRpcResponse | undefined => {
    if (!isObject(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
      const id = isObject(msg) && (typeof msg.id === 'string' || typeof msg.id === 'number') ? msg.id : null;
      // A response from the client (we never send requests) needs no answer.
      if (isObject(msg) && ('result' in msg || 'error' in msg)) return undefined;
      return fail(id, RPC.invalidRequest, 'not a JSON-RPC 2.0 request');
    }
    const isNotification = !('id' in msg) || msg.id === undefined;
    if (isNotification) return undefined;
    const id = msg.id as JsonRpcId | null;
    const params = isObject(msg.params) ? msg.params : {};

    switch (msg.method) {
      case 'initialize': {
        const asked = params.protocolVersion;
        const protocolVersion = (MCP_PROTOCOL_VERSIONS as readonly unknown[]).includes(asked) ? asked : MCP_PROTOCOL_VERSIONS[0];
        return ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: info,
          instructions: opts.instructions ?? DEFAULT_INSTRUCTIONS,
        });
      }
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: listed });
      case 'tools/call':
        return call(id, params);
      default:
        return fail(id, RPC.methodNotFound, `method not found: ${msg.method}`);
    }
  };

  /** Handle raw text (one JSON message). A parse failure is answered as JSON-RPC requires. */
  const handleText = (text: string): JsonRpcResponse | undefined => {
    let msg: unknown;
    try {
      msg = JSON.parse(text);
    } catch {
      return fail(null, RPC.parseError, 'invalid JSON');
    }
    return handle(msg);
  };

  return { info, tools: listed, handle, handleText };
};

export type McpServer = ReturnType<typeof createMcpServer>;
