import type { ComponentPropsWithoutRef, ElementType } from 'react';

type GlassProps<T extends ElementType> = {
  as?: T;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className'>;

/** A hairline panel surface (named Glass for history). Renders a div unless `as` says otherwise. */
export function Glass<T extends ElementType = 'div'>({ as, className = '', ...rest }: GlassProps<T>) {
  const Tag = (as ?? 'div') as ElementType;
  return <Tag className={`v-glass ${className}`.trim()} {...rest} />;
}
