export function Logo({ onClick }: { onClick: () => void }) {
  return (
    <button className="v-logo" type="button" onClick={onClick} aria-label="Vandelay home">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5 L12 20 L20 5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="5.5" r="2" fill="var(--v-color-accent)" />
      </svg>
      Vandelay
    </button>
  );
}
