import type { SVGProps } from 'react';
import type { CategoryId } from '../categories';

type IconProps = SVGProps<SVGSVGElement>;

const GLYPHS: Record<CategoryId, string> = {
  home: 'M24 7.5c.6 0 1.2.2 1.7.6l15 12.6c1.1.9.5 2.8-1 2.8H37v14.5c0 1.7-1.3 3-3 3h-5.5v-9.5c0-1.1-.9-2-2-2h-5c-1.1 0-2 .9-2 2V41H14c-1.7 0-3-1.3-3-3V23.5H8.3c-1.5 0-2.1-1.9-1-2.8l15-12.6c.5-.4 1.1-.6 1.7-.6z',
  business:
    'M10.5 8h27c1 0 1.9.6 2.3 1.5l2.7 6.5c.2.4.3.9.3 1.4 0 2.8-2.2 5.1-5 5.1-1.7 0-3.2-.8-4.1-2.1-.9 1.3-2.4 2.1-4.2 2.1s-3.3-.8-4.2-2.1c-.9 1.3-2.4 2.1-4.2 2.1s-3.2-.8-4.1-2.1C13.1 21.6 11.6 22.5 10 22.5c-2.8 0-5-2.3-5-5.1 0-.5.1-1 .3-1.4L8 9.5C8.4 8.6 9.4 8 10.5 8zM10 25.5c1.4 0 2.8-.4 4-1.1V38h6.5v-8.5c0-1.1.9-2 2-2h3c1.1 0 2 .9 2 2V38H38V24.4c1.2.7 2.6 1.1 4 1.1V38c0 1.7-1.3 3-3 3H9c-1.7 0-3-1.3-3-3V24.4c1.2.7 2.6 1.1 4 1.1zM31 27.5h3.5c.8 0 1.5.7 1.5 1.5v3.5c0 .8-.7 1.5-1.5 1.5H31c-.8 0-1.5-.7-1.5-1.5V29c0-.8.7-1.5 1.5-1.5z',
  'mixed-use':
    'M15 5h14c1.7 0 3 1.3 3 3v9h4c1.7 0 3 1.3 3 3v19h1.5c.8 0 1.5.7 1.5 1.5S41.3 42 40.5 42h-33C6.7 42 6 41.3 6 40.5S6.7 39 7.5 39H12V8c0-1.7 1.3-3 3-3zm1.5 6v3h3v-3h-3zm7 0v3h3v-3h-3zm-7 6.5v3h3v-3h-3zm7 0v3h3v-3h-3zm-7 6.5v3h3v-3h-3zm7 0v3h3v-3h-3zM34 22v3h2.5v-3H34zm0 6.5v3h2.5v-3H34zM19 32.5V39h6v-6.5h-6z',
  venue:
    'M24 9c10.5 0 19 5.4 19 12v6.5c0 6.6-8.5 12-19 12S5 34.1 5 27.5V21C5 14.4 13.5 9 24 9zm0 5.5c-6.9 0-12.5 3-12.5 6.5S17.1 27.5 24 27.5 36.5 24.5 36.5 21 30.9 14.5 24 14.5zm0 3c4.4 0 8 1.6 8 3.5s-3.6 3.5-8 3.5-8-1.6-8-3.5 3.6-3.5 8-3.5z',
};

export function CategoryGlyph({ id, ...props }: IconProps & { id: CategoryId }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" {...props}>
      <path fillRule="evenodd" d={GLYPHS[id]} />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
      </g>
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  );
}

export function AutoIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" />
    </svg>
  );
}
