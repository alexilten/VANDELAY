import { CategoryTile, PromptField } from '../design/components';
import { CATEGORY_IDS, type CategoryId } from '../design/categories';

type Props = { onStart: (brief: string) => void; onPick: (c: CategoryId) => void };

/** One question, one field, four tiles. */
export function FrontDoor({ onStart, onPick }: Props) {
  return (
    <section className="v-door">
      <h1>What would you like to build?</h1>
      <PromptField
        label="Describe what you want to build"
        placeholder="A small home on a sloped lot"
        submitLabel="Start"
        onSubmit={onStart}
      />
      <div className="v-door__tiles">
        {CATEGORY_IDS.map((id) => (
          <CategoryTile key={id} id={id} onSelect={onPick} />
        ))}
      </div>
    </section>
  );
}
