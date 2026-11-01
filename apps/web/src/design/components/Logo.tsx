/**
 * The Vandelay mark: a hard hat drawn in three lines (dome, brim, ridge) inside
 * an ink square. Original and placeholder-grade; one colour plus the signal ridge.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg className="v-logo__mark" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--v-brand)" />
      <g fill="none" stroke="var(--v-color-bg)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M6.5 15.5a5.5 5.5 0 0 1 11 0" />
        <path d="M4.5 15.5h15" />
      </g>
      <path d="M12 7.6v3.4" stroke="var(--v-brand-hat-ridge)" strokeWidth="1.8" strokeLinecap="round" />
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
