import type { CategoryId } from '../design/categories';
import type { OptionGeometry } from './geometry';
import { mockOptionGeometry } from './mock';

/**
 * The one place the app asks for an option's geometry.
 *
 * Today every category uses example geometry. When `@vandelay/engine-home`
 * lands, Home will call `proposeOptions(intent)` and pass each option's
 * `geometry` (already in the viewer's shape) through here.
 */
export function optionGeometry(category: CategoryId, option: number, picks: readonly number[]): OptionGeometry {
  return mockOptionGeometry(category, option, picks);
}
