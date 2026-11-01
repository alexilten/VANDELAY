import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { CategoryId } from '../design/categories';
import { ExampleTag } from '../design/components';
import { Massing } from '../flow/Massing';
import type { OptionGeometry } from './geometry';
import { formatHour, SEASONS, sunPosition } from './sun';

const Viewer3D = lazy(() => import('./Viewer3D'));

/** Used for sun studies when a site has no location yet. Northern California-ish; an example, and labelled so. */
const EXAMPLE_LAT = 37.8;

function SunGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** WebGL is missing in some browsers, in tests and in thumbnail capture; fall back to the 2D sketch there. */
function hasWebGL(): boolean {
  try {
    if (typeof window === 'undefined' || /jsdom/i.test(navigator.userAgent)) return false;
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

class Guard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

type Props = {
  category: CategoryId;
  option: number;
  optionName: string;
  geometry: OptionGeometry;
  /** True when the geometry comes from a real engine (still on an example site). */
  engine?: boolean;
  /** Overlay controls, e.g. the checks chip. */
  children?: ReactNode;
};

/** The live model of the chosen option, with a 2D sketch while it loads or when 3D isn't available. */
export function ViewerPanel({ category, option, optionName, geometry, engine = false, children }: Props) {
  const webgl = useMemo(hasWebGL, []);
  const [touched, setTouched] = useState(false);
  const [study, setStudy] = useState(false);
  const [season, setSeason] = useState(1);
  const [hour, setHour] = useState(15);
  const geo = geometry.site.geo;
  const lat = geo?.lat ?? EXAMPLE_LAT;
  const sun = useMemo(() => (study ? sunPosition(lat, SEASONS[season]?.day ?? 79, hour) : null), [study, lat, season, hour]);
  const fallback = (
    <div className="v-viewer__fallback">
      <Massing category={category} index={option} />
    </div>
  );
  return (
    <div
      className="v-viewer"
      role="img"
      aria-label={`${engine ? 'Engine-generated 3D model on an example site' : 'Example 3D model'}: ${optionName}. Drag to look around.`}
      onPointerDown={() => setTouched(true)}
    >
      {webgl ? (
        <Guard fallback={fallback}>
          <Suspense fallback={fallback}>
            <Viewer3D geometry={geometry} modelKey={`${category}-${option}-${geometry.solids.length}`} sun={sun} />
          </Suspense>
        </Guard>
      ) : (
        fallback
      )}
      <div className="v-viewer__tags">
        <ExampleTag>{engine ? 'Engine model · example site' : 'Example model'}</ExampleTag>
      </div>
      {children}
      {webgl ? (
        <div className={`v-sun ${study ? 'is-open' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="v-sun__toggle" aria-pressed={study} onClick={() => setStudy((s) => !s)}>
            <SunGlyph /> Sun study
          </button>
          {study ? (
            <div className="v-sun__controls">
              <div className="v-seg" role="group" aria-label="Day of the year">
                {SEASONS.map((s, i) => (
                  <button key={s.id} type="button" aria-pressed={season === i} onClick={() => setSeason(i)}>
                    {s.label}
                  </button>
                ))}
              </div>
              <label className="v-sun__time">
                <span>{formatHour(hour)}</span>
                <input type="range" min={5} max={20} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="Solar time" />
              </label>
              <span className="v-fine">
                {sun && sun.elevation < 0 ? 'Sun below the horizon' : `Sun ${Math.round(sun?.elevation ?? 0)}° up`} · solar time · {geo ? `${lat.toFixed(1)}°` : `example latitude ${lat}°`}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
      {webgl ? <span className={`v-viewer__hint ${touched || study ? 'is-hidden' : ''}`}>Drag to look around</span> : null}
    </div>
  );
}
