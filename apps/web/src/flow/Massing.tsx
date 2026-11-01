import type { CategoryId } from '../design/categories';

/*
 * An abstract, illustrative massing sketch for an option card: a few stacked
 * blocks in the category colour. It is decoration, not a design.
 */
type Block = readonly [x: number, width: number, height: number];
const BLOCKS: Record<CategoryId, readonly (readonly Block[])[]> = {
  // Each option: list of [x, width, height] blocks on a 120-wide ground line.
  home: [[[22, 34, 22], [52, 34, 30]], [[34, 50, 34]], [[30, 38, 24], [68, 26, 6]]],
  business: [[[20, 58, 22], [78, 24, 6]], [[36, 48, 44]], [[44, 22, 18], [70, 20, 6]]],
  'mixed-use': [[[26, 68, 14], [32, 56, 50]], [[26, 68, 14], [36, 48, 62]], [[18, 22, 30], [42, 22, 30], [66, 22, 30], [90, 14, 14]]],
  venue: [[[14, 92, 30]], [[14, 92, 24], [14, 30, 40]], [[14, 92, 20]]],
};

export function Massing({ category, index }: { category: CategoryId; index: number }) {
  const blocks = BLOCKS[category][index] ?? [];
  const gid = `m-${category}-${index}`;
  return (
    <svg className="v-opt__art" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={`var(--v-cat-${category}-a)`} />
          <stop offset="1" stopColor={`var(--v-cat-${category}-b)`} />
        </linearGradient>
      </defs>
      <line x1="6" y1="68" x2="114" y2="68" stroke="var(--v-color-ink-3)" strokeOpacity="0.5" />
      {blocks.map(([x, w, h], i) => (
        <rect key={i} x={x} y={68 - h} width={w} height={h} rx="2.5" fill={`url(#${gid})`} fillOpacity={0.55 + 0.2 * (i % 2)} />
      ))}
    </svg>
  );
}
