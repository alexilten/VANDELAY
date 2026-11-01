import { CATEGORY_NAMES, type CategoryId } from '../categories';
import { AppIcon } from './AppIcon';
import { Glass } from './Glass';

export function CategoryTile({ id, onSelect }: { id: CategoryId; onSelect: (id: CategoryId) => void }) {
  return (
    <Glass as="button" type="button" className="v-tile" onClick={() => onSelect(id)}>
      <AppIcon id={id} />
      <b>{CATEGORY_NAMES[id]}</b>
    </Glass>
  );
}
