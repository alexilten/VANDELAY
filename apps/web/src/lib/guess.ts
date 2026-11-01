import type { CategoryId } from '../design/categories';

/**
 * Picks a category from a free-text brief. A keyword stand-in until the agent
 * reads briefs; anything unrecognised starts as a Home.
 */
export function guessCategory(text: string): CategoryId {
  const t = text.toLowerCase();
  if (/stadium|arena|venue|ballpark|seats|soccer|football|hockey|basketball|concert/.test(t)) return 'venue';
  if (/tower|high.?rise|apartment|condo|flats|units|mixed|hotel|office building|storey|floors/.test(t)) return 'mixed-use';
  if (/cafe|café|coffee|shop|store|clinic|restaurant|bakery|studio|business|retail|office/.test(t)) return 'business';
  return 'home';
}
