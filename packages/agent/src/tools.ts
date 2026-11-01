/**
 * The Home engine as typed tools. Agents propose, engines verify: every tool
 * either validates intent, changes intent through a validated patch, or reads
 * engine results. No tool lets a caller write geometry or numbers.
 *
 * Each tool has a JSON Schema for its input, so the MCP server (next step)
 * can register them as-is.
 */
import {
  EXAMPLE_CA_LOT, EXAMPLE_SITES, createHomeIntent, getAt, patchHomeIntent, validateHomeIntent,
  type HomeIntent, type JsonPointer, type PatchOp, type SiteIntent,
} from '@vandelay/kernel';
import { evaluate, proposeOptions, type HomeError, type HomeOption, type HomeResult, type Traced } from '@vandelay/engine-home';
import { briefFromPrompt } from './brief.ts';

export interface Tool<I, O> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  readonly run: (input: I) => O;
}

const intentSchema = { type: 'object', description: 'A vandelay.intent document (category "home"). See packages/kernel/src/home-intent.ts.' };

export const validateTool: Tool<{ intent: unknown }, { ok: boolean; issues: { path: string; message: string }[] }> = {
  name: 'intent.validate',
  description: 'Check a Home intent. Returns every problem with its JSON Pointer.',
  inputSchema: { type: 'object', required: ['intent'], properties: { intent: intentSchema } },
  run: ({ intent }) => {
    const issues = validateHomeIntent(intent);
    return { ok: issues.length === 0, issues };
  },
};

export const evaluateTool: Tool<{ intent: HomeIntent }, HomeResult | HomeError> = {
  name: 'home.evaluate',
  description: 'Solve one Home intent: modules, piers, geometry, quantities, checks and scores. Auto fields are resolved by search.',
  inputSchema: { type: 'object', required: ['intent'], properties: { intent: intentSchema } },
  run: ({ intent }) => evaluate(intent),
};

export const proposeTool: Tool<{ intent: HomeIntent; count?: number }, HomeOption[] | HomeError> = {
  name: 'home.proposeOptions',
  description: 'Three feasible options of different layouts for one site and brief, best first, each a fully resolved intent with its result.',
  inputSchema: { type: 'object', required: ['intent'], properties: { intent: intentSchema, count: { type: 'integer', minimum: 1, maximum: 6 } } },
  run: ({ intent, count }) => proposeOptions(intent, count === undefined ? {} : { count }),
};

export const patchTool: Tool<{ intent: HomeIntent; patch: PatchOp[] }, { ok: true; intent: HomeIntent; result: HomeResult | HomeError } | { ok: false; issues: { path: string; message: string }[] }> = {
  name: 'intent.patch',
  description: 'Change a Home intent with a JSON Patch (RFC 6902: add, remove, replace, test). The patched intent must validate; it is then solved.',
  inputSchema: {
    type: 'object', required: ['intent', 'patch'],
    properties: {
      intent: intentSchema,
      patch: { type: 'array', items: { type: 'object', required: ['op', 'path'], properties: { op: { enum: ['add', 'remove', 'replace', 'test'] }, path: { type: 'string' }, value: {} } } },
    },
  },
  run: ({ intent, patch }) => {
    const res = patchHomeIntent(intent, patch);
    if (!res.ok) return { ok: false, issues: res.issues };
    return { ok: true, intent: res.value, result: evaluate(res.value) };
  },
};

export const explainTool: Tool<{ result: HomeResult; path: JsonPointer }, { ok: true; value: unknown; trace?: Traced } | { ok: false; message: string }> = {
  name: 'explain',
  description: 'Answer "why?" for a number in a result: give a JSON Pointer such as /quantities/maxPierHeight or /scores/view.',
  inputSchema: { type: 'object', required: ['result', 'path'], properties: { result: { type: 'object' }, path: { type: 'string' } } },
  run: ({ result, path }) => {
    const value = getAt(result, path);
    if (value === undefined) return { ok: false, message: `nothing at ${path}` };
    const isTraced = (v: unknown): v is Traced => typeof v === 'object' && v !== null && 'formula' in v && 'reads' in v;
    return isTraced(value) ? { ok: true, value: value.value, trace: value } : { ok: true, value };
  },
};

export type ExampleSiteName = keyof typeof EXAMPLE_SITES;
const EXAMPLE_SITE_NAMES = Object.keys(EXAMPLE_SITES) as ExampleSiteName[];

export const promptTool: Tool<{ prompt: string; site?: ExampleSiteName }, { intent: HomeIntent; options: HomeOption[] | HomeError; fromPrompt: readonly string[]; site: string; note: string }> = {
  name: 'home.optionsFromPrompt',
  description: 'Three home options from a plain-language prompt, on an EXAMPLE California lot (state ADU rules apply). Start here when you have no intent yet. The site is example data until parcel lookup ships.',
  inputSchema: {
    type: 'object', required: ['prompt'],
    properties: {
      prompt: { type: 'string', minLength: 1, maxLength: 2000, description: 'What the person wants, in their words, e.g. "a one-bedroom backyard cottage for my mom, step-free".' },
      site: { enum: EXAMPLE_SITE_NAMES, description: 'Which example lot to use. Default slopeAlong (falls 15% toward the street).' },
    },
  },
  run: ({ prompt, site = 'slopeAlong' }) => {
    const siteIntent: SiteIntent = { ...EXAMPLE_SITES[site], jurisdiction: EXAMPLE_CA_LOT };
    return { ...optionsFromPrompt(prompt, siteIntent), site, note: `example site "${site}" with example California lot facts; not a real parcel` };
  },
};

export const homeTools = [promptTool, validateTool, evaluateTool, proposeTool, patchTool, explainTool] as const;

/**
 * The whole loop without a model: prompt → brief → intent → three options.
 * The homepage calls this until the model-backed agent is wired in.
 */
export const optionsFromPrompt = (prompt: string, site: SiteIntent, seed = 1): { intent: HomeIntent; options: HomeOption[] | HomeError; fromPrompt: readonly string[] } => {
  const { brief, fromPrompt } = briefFromPrompt(prompt);
  const intent = createHomeIntent({
    id: `prompt-${seed}`,
    seed,
    site,
    brief,
    design: {
      catalog: { id: 'example.box-modules', version: '0' },
      parti: 'bar',
      placement: { anchor: 'auto', rotation: 'auto' },
      foundation: 'auto',
      levels: { maxStep: 'auto', floorDatum: 'auto' },
    },
    sources: {
      '/body/brief': { by: 'agent', note: `read from the prompt by the keyword stand-in (${fromPrompt.join(', ') || 'defaults only'})` },
      '/body/design/catalog': { by: 'default', note: 'generic example catalog until a vendor catalog is signed' },
    },
  });
  return { intent, options: proposeOptions(intent), fromPrompt };
};
