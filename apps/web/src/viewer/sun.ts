/**
 * Where the sun is, for sun studies. A standard low-precision solar position
 * (declination from day of year, hour angle from solar time), good to about a
 * degree, which is plenty for seeing shadows. Uses local solar time, not clock
 * time, so noon is when the sun is due south (north of the tropics).
 */

export interface SunPosition {
  /** Unit vector toward the sun in the site frame (+X east, +Y north, +Z up). */
  readonly dir: readonly [x: number, y: number, z: number];
  /** Degrees above the horizon (negative = below). */
  readonly elevation: number;
  /** Compass bearing in degrees (0 = north, 90 = east). */
  readonly azimuth: number;
}

const RAD = Math.PI / 180;

export function sunPosition(latDeg: number, dayOfYear: number, solarHour: number): SunPosition {
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + dayOfYear)) * RAD;
  const ha = 15 * (solarHour - 12) * RAD;
  const lat = latDeg * RAD;
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(ha);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  const cosAz = (Math.sin(decl) - Math.sin(el) * Math.sin(lat)) / (Math.cos(el) * Math.cos(lat) || 1e-9);
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / RAD;
  if (ha > 0) az = 360 - az;
  const ce = Math.cos(el);
  return {
    dir: [Math.sin(az * RAD) * ce, Math.cos(az * RAD) * ce, Math.sin(el)],
    elevation: el / RAD,
    azimuth: az,
  };
}

/** The three moments a sun study usually looks at, as day of year. */
export const SEASONS = [
  { id: 'winter', label: 'Dec 21', day: 355 },
  { id: 'equinox', label: 'Mar 20', day: 79 },
  { id: 'summer', label: 'Jun 21', day: 172 },
] as const;

export const formatHour = (h: number): string => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const am = hh < 12;
  const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${am ? 'am' : 'pm'}`;
};
