/** Placeholder site drawing: contours, lot line and a buildable area. Not a real parcel. */
export function SiteMap() {
  return (
    <svg className="v-sitemap" viewBox="0 0 300 200" role="img" aria-label="Example site with lot line, contours and buildable area">
      <g fill="none" stroke="var(--v-color-ink-3)" strokeOpacity="0.5" strokeWidth="1">
        <path d="M0 46 Q140 30 300 56" />
        <path d="M0 92 Q150 74 300 100" />
        <path d="M0 138 Q160 118 300 146" />
        <path d="M0 184 Q170 162 300 190" />
      </g>
      <rect x="60" y="34" width="180" height="132" rx="6" fill="var(--v-color-accent)" fillOpacity="0.08" stroke="var(--v-color-accent)" strokeWidth="1.5" strokeDasharray="5 4" />
      <rect x="96" y="62" width="96" height="60" rx="4" fill="var(--v-color-accent)" fillOpacity="0.22" />
      <path transform="translate(270 24)" d="M0 12 L5 -4 L10 12 L5 8 Z" fill="var(--v-color-ink)" />
    </svg>
  );
}
