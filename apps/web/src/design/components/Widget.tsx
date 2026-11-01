import { useId, type ReactNode } from 'react';
import { Glass } from './Glass';

type Props = {
  title: string;
  /** One line shown beside the title, so a collapsed widget still says what it holds. */
  summary?: ReactNode;
  /** Small trailing marker in the header, e.g. an Example tag. */
  aside?: ReactNode;
  /** Panel number shown in the header, e.g. "01". Decorative. */
  index?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
};

/** A collapsible panel. The header is one button; the body hides when closed. */
export function Widget({ title, summary, aside, index, open, onToggle, children, className = '' }: Props) {
  const bodyId = useId();
  return (
    <Glass as="section" className={`v-widget ${open ? 'is-open' : ''} ${className}`.trim()}>
      <div className="v-widget__head">
        <button type="button" className="v-widget__toggle" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
          <span className="v-widget__title">{title}</span>
          {summary ? <span className="v-widget__summary">{summary}</span> : null}
          {index ? <span className="v-widget__index" aria-hidden="true">{index}</span> : null}
          <svg className="v-widget__chev" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {aside}
      </div>
      <div id={bodyId} className="v-widget__body" hidden={!open}>
        {children}
      </div>
    </Glass>
  );
}
