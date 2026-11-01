import { homeEngine, type EngineInfo } from '@vandelay/engine-home';

/**
 * Agents propose, engines verify. The agent never writes geometry or numbers
 * itself; it can only call engines through this registry. MCP wiring comes later.
 */
export const engines: readonly EngineInfo[] = [homeEngine];

export const findEngine = (id: string): EngineInfo | undefined => engines.find((e) => e.id === id);
