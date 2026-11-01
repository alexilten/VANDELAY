import { homeEngine, type EngineInfo } from '@vandelay/engine-home';

/**
 * Agents propose, engines verify. The agent never writes geometry or numbers
 * itself; it can only call engines through these tools. MCP wiring comes later.
 */
export const engines: readonly EngineInfo[] = [homeEngine];

export const findEngine = (id: string): EngineInfo | undefined => engines.find((e) => e.id === id);

export * from './brief.ts';
export * from './tools.ts';
