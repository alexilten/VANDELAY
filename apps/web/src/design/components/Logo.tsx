import { useId } from 'react';

/** The Vandelay mark: a friendly head in a hard hat. Face uses ink, so it works in both themes. */
export function LogoMark({ size = 26 }: { size?: number }) {
  const gid = useId();
  return (
    <svg className="v-logo__mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--v-brand-hat-a)" />
          <stop offset="1" stopColor="var(--v-brand-hat-b)" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="15.4" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9.6" cy="15.9" r="1.05" fill="currentColor" />
      <circle cx="14.4" cy="15.9" r="1.05" fill="currentColor" />
      <path d="M9.7 18.5q2.3 1.7 4.6 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.9 11.1a7.1 7.1 0 0 1 14.2 0z" fill={`url(#${gid})`} />
      <rect x="2.3" y="10.3" width="19.4" height="2.4" rx="1.2" fill="var(--v-brand-hat-b)" />
      <path d="M12 4.6v3.4" stroke="var(--v-brand-hat-ridge)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="v-logo" type="button" onClick={onClick} aria-label="Vandelay home">
      <LogoMark />
      Vandelay
    </button>
  );
}
