/**
 * A deterministic stand-in for the language model: reads a few facts from a
 * free-text prompt into a Brief. It only fills what it can see and keeps the
 * person's words verbatim. The real agent replaces this with a model call
 * that proposes the same Brief shape, which the kernel then validates.
 */
import type { Brief, Priority } from '@vandelay/kernel';

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, single: 1, a: 1 };
const num = (s: string | undefined): number | undefined => (s === undefined ? undefined : /^\d+(\.\d+)?$/.test(s) ? Number(s) : WORDS[s.toLowerCase()]);

export interface BriefGuess {
  readonly brief: Brief;
  /** Which fields came from the prompt, and which are defaults. */
  readonly fromPrompt: readonly (keyof Brief | `priorities.${Priority}`)[];
}

export const DEFAULT_BRIEF: Omit<Brief, 'prompt'> = {
  bedrooms: 2,
  bathrooms: 1,
  area: {},
  maxStories: 1,
  stepFreeEntry: false,
  priorities: {},
};

export const briefFromPrompt = (prompt: string): BriefGuess => {
  const text = prompt.toLowerCase();
  const found: BriefGuess['fromPrompt'][number][] = [];
  let bedrooms = DEFAULT_BRIEF.bedrooms;
  let bathrooms = DEFAULT_BRIEF.bathrooms;
  const area: { target?: number } = {};
  const priorities: Partial<Record<Priority, number>> = {};

  if (/\bstudio\b/.test(text)) { bedrooms = 0; found.push('bedrooms'); }
  const bed = text.match(/\b(\d|one|two|three|four|five|single|a)[\s-]*(?:bed(?:room)?s?|br|bd)\b/);
  const b = num(bed?.[1]);
  if (b !== undefined) { bedrooms = Math.min(b, 6); found.push('bedrooms'); }
  const bath = text.match(/\b(\d(?:\.5)?|one|two|three)[\s-]*(?:bath(?:room)?s?|ba)\b/);
  const ba = num(bath?.[1]);
  if (ba !== undefined) { bathrooms = Math.max(1, Math.min(ba, 4)); found.push('bathrooms'); }

  const sqft = text.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|square\s*feet|ft²|sf)\b/);
  const sqm = text.match(/(\d[\d,]*)\s*(?:m2|m²|sq\.?\s*m|square\s*met(?:er|re)s?)\b/);
  if (sqft) { area.target = Math.round(Number(sqft[1]!.replace(/,/g, '')) * 92903.04); found.push('area'); }
  else if (sqm) { area.target = Number(sqm[1]!.replace(/,/g, '')) * 1e6; found.push('area'); }

  const flag = (re: RegExp, p: Priority, w = 1) => { if (re.test(text)) { priorities[p] = w; found.push(`priorities.${p}`); } };
  flag(/\b(view|views|vista|overlook|ocean|valley|mountain)/, 'view');
  flag(/\b(sun|sunny|light|bright|solar)/, 'sun');
  flag(/\b(private|privacy|quiet|secluded|hidden)/, 'privacy');
  flag(/\b(cheap|afford|budget|low[\s-]?cost|economical)/, 'cost');
  flag(/\b(hill|hillside|slope|sloped|steep|lightly|tread)/, 'lessGrading', 0.6);

  const stepFree = /\b(step[\s-]?free|accessible|wheelchair|no steps|aging in place|single[\s-]?level|one[\s-]?level)\b/.test(text);
  if (stepFree) found.push('stepFreeEntry');

  return {
    brief: { prompt, bedrooms, bathrooms, area, maxStories: 1, stepFreeEntry: stepFree, priorities },
    fromPrompt: found,
  };
};
