import { CATEGORIES, type Category } from '@vandelay/kernel';

/** The four front-door categories, in display order. Ids come from the kernel. */
export const CATEGORY_IDS = CATEGORIES;
export type CategoryId = Category;

export const CATEGORY_NAMES: Record<CategoryId, string> = {
  home: 'Home',
  business: 'Business',
  'mixed-use': 'Mixed-use',
  venue: 'Venue',
};
