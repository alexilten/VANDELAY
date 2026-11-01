import { exampleHomeIntent } from '@vandelay/kernel';
import { describe, expect, it } from 'vitest';
import { MCP_PROTOCOL_VERSIONS, RPC, compactForModel, createMcpServer, mcpToolName } from './mcp.ts';

const server = createMcpServer();
const req = (id: number, method: string, params?: Record<string, unknown>) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });
const result = (r: unknown) => (r as { result: Record<string, unknown> }).result;
const error = (r: unknown) => (r as { error: { code: number; message: string } }).error;

describe('MCP handshake', () => {
  it('answers initialize with tools capability, server info and instructions', () => {
    const r = result(server.handle(req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } })));
    expect(r.protocolVersion).toBe('2025-06-18');
    expect(r.capabilities).toEqual({ tools: { listChanged: false } });
    expect(r.serverInfo).toMatchObject({ name: 'vandelay' });
    expect(r.instructions).toContain('home_optionsFromPrompt');
  });

  it('offers its newest version to a client it does not know', () => {
    expect(result(server.handle(req(1, 'initialize', { protocolVersion: '1999-01-01' }))).protocolVersion).toBe(MCP_PROTOCOL_VERSIONS[0]);
  });

  it('stays silent on notifications and client responses', () => {
    expect(server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect(server.handle({ jsonrpc: '2.0', id: 9, result: {} })).toBeUndefined();
  });

  it('answers ping, and rejects unknown methods, bad requests and bad JSON', () => {
    expect(result(server.handle(req(2, 'ping')))).toEqual({});
    expect(error(server.handle(req(3, 'resources/list'))).code).toBe(RPC.methodNotFound);
    expect(error(server.handle({ id: 4, method: 'ping' })).code).toBe(RPC.invalidRequest);
    expect(error(server.handleText('{not json')).code).toBe(RPC.parseError);
  });
});

describe('MCP tools', () => {
  it('lists every engine tool with a client-safe name and an object schema', () => {
    const { tools } = result(server.handle(req(1, 'tools/list'))) as { tools: { name: string; inputSchema: { type: string } }[] };
    expect(tools.map((t) => t.name)).toEqual([
      'home_optionsFromPrompt', 'intent_validate', 'home_evaluate', 'home_proposeOptions', 'intent_patch', 'explain',
    ]);
    for (const t of tools) {
      expect(t.name).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(t.inputSchema.type).toBe('object');
    }
    expect(mcpToolName('a.b c')).toBe('a_b_c');
  });

  it('compacts traced numbers and checks for the model', () => {
    expect(compactForModel({ area: { value: 5, unit: 'mm2', formula: 'f', reads: [] }, geometry: [1] })).toEqual({ area: { value: 5, unit: 'mm2' } });
    expect(compactForModel({ ruleId: 'r', status: 'pass', message: 'ok', measured: { value: 1, unit: 'mm', formula: 'f', reads: [] }, limit: 0, extra: 'x' }))
      .toEqual({ ruleId: 'r', status: 'pass', message: 'ok', measured: { value: 1, unit: 'mm' }, limit: 0 });
  });

  it('gets three options from a prompt, as an outside agent would', () => {
    const r = result(server.handle(req(5, 'tools/call', { name: 'home_optionsFromPrompt', arguments: { prompt: 'a one-bedroom backyard cottage for my mom, step-free' } })));
    expect(r.isError).toBe(false);
    const out = r.structuredContent as { options: { result: { intentHash: string } }[]; note: string };
    expect(out.options).toHaveLength(3);
    for (const o of out.options) expect(o.result.intentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(out.note).toContain('example');
    // The text a model reads is compact: no geometry, numbers without their traces, but the intent kept for patching.
    const text = (r.content as { text: string }[])[0]!.text;
    expect(text.length).toBeLessThan(JSON.stringify(out).length / 4);
    const compact = JSON.parse(text) as { options: { intent: unknown; result: Record<string, unknown> }[] };
    expect(compact.options[0]!.result.geometry).toBeUndefined();
    expect(compact.options[0]!.intent).toEqual((out.options[0] as unknown as { intent: unknown }).intent);
    expect(compact.options[0]!.result.intentHash).toBe(out.options[0]!.result.intentHash);
  });

  it('wraps array results so structuredContent is an object', () => {
    const r = result(server.handle(req(6, 'tools/call', { name: 'home_proposeOptions', arguments: { intent: exampleHomeIntent() } })));
    expect(Array.isArray((r.structuredContent as { result: unknown }).result)).toBe(true);
  });

  it('reports tool-level failures to the model as isError results', () => {
    const invalid = result(server.handle(req(7, 'tools/call', { name: 'intent_validate', arguments: { intent: { nope: true } } })));
    expect(invalid.isError).toBe(true);
    const missing = result(server.handle(req(8, 'tools/call', { name: 'home_evaluate', arguments: {} })));
    expect(missing).toMatchObject({ isError: true, content: [{ type: 'text', text: 'missing argument: intent' }] });
    const thrown = result(server.handle(req(9, 'tools/call', { name: 'home_evaluate', arguments: { intent: 42 } })));
    expect(thrown.isError).toBe(true);
  });

  it('rejects unknown tools and non-object arguments as protocol errors', () => {
    expect(error(server.handle(req(10, 'tools/call', { name: 'drop_tables' }))).code).toBe(RPC.invalidParams);
    expect(error(server.handle(req(11, 'tools/call', { name: 'explain', arguments: [1] }))).code).toBe(RPC.invalidParams);
  });
});
