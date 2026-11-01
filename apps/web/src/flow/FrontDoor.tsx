import { CategoryTile, PromptField } from '../design/components';
import { CATEGORY_IDS, type CategoryId } from '../design/categories';

type Props = { onStart: (brief: string) => void; onPick: (c: CategoryId) => void };

/** One question, one field, four tiles. */
export function FrontDoor({ onStart, onPick }: Props) {
  return (
    <section className="v-door">
      <p className="v-label v-door__eyebrow">Architecture for everyone</p>
      <h1>What would you like to build?</h1>
      <p className="v-door__lede">Describe it in plain words. Vandelay drafts three ways to build it, checks each against the rules and shows you why.</p>
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
