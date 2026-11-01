import { useId, useState, type FormEvent } from 'react';
import { Glass } from './Glass';
import { ArrowIcon } from './icons';

type Props = {
  label: string;
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  /** Rotates the arrow to point right, for "find" style fields. */
  arrow?: 'up' | 'right';
  className?: string;
  autoFocus?: boolean;
};

/** The pill-shaped prompt box with a round submit button. */
export function PromptField({ label, placeholder, submitLabel, onSubmit, arrow = 'up', className = '', autoFocus }: Props) {
  const [value, setValue] = useState('');
  const id = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value.trim());
  };
  return (
    <Glass as="form" className={`v-prompt ${className}`.trim()} onSubmit={submit} role="search">
      <label htmlFor={id} className="v-sr-only">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
      />
      <button className="v-prompt__go" type="submit" aria-label={submitLabel}>
        <ArrowIcon style={arrow === 'right' ? { transform: 'rotate(90deg)' } : undefined} />
      </button>
    </Glass>
  );
}
