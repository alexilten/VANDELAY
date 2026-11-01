import type { ReactNode } from 'react';

export function Pill({ tone = 'plain', children }: { tone?: 'accent' | 'plain'; children: ReactNode }) {
  return <span className={`v-pill v-pill--${tone}`}>{children}</span>;
}
