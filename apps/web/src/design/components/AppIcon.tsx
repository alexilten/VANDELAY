import type { CategoryId } from '../categories';
import { CategoryGlyph } from './icons';

/** A monochrome glyph in a hairline square, one per category. */
export function AppIcon({ id, size = 'lg' }: { id: CategoryId; size?: 'lg' | 'sm' }) {
  return (
    <span className={`v-app-icon v-app-icon--${size}`} style={{ background: `var(--v-cat-${id})` }}>
      <CategoryGlyph id={id} />
    </span>
  );
}
