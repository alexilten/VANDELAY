import type { Category } from '@vandelay/kernel';

/** Every typology engine describes itself the same way so the agent can list it as a tool. */
export interface EngineInfo {
  readonly id: string;
  readonly category: Category;
  readonly version: string;
  readonly status: 'stub' | 'experimental' | 'stable';
}

export const homeEngine: EngineInfo = {
  id: 'home',
  category: 'home',
  version: '0.1.0',
  status: 'experimental',
};

export * from './types.ts';
export { EXAMPLE_CATALOG, MATERIALS, findCatalog, type Catalog, type MaterialSpec, type ModuleSpec } from './catalog.ts';
export { RULES, type Rule, type RuleId } from './rules.ts';
export { ENGINE_VERSION, evaluateWithDefaults } from './evaluate.ts';
export { evaluate, proposeOptions, resolveIntent, type SearchOptions } from './options.ts';
