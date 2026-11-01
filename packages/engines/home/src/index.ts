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
  version: '0.0.0',
  status: 'stub',
};
