import { Component, lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { CategoryId } from '../design/categories';
import { ExampleTag } from '../design/components';
import { Massing } from '../flow/Massing';
import type { OptionGeometry } from './geometry';

const Viewer3D = lazy(() => import('./Viewer3D'));

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
};

/** The live model of the chosen option, with a 2D sketch while it loads or when 3D isn't available. */
export function ViewerPanel({ category, option, optionName, geometry, engine = false }: Props) {
  const webgl = useMemo(hasWebGL, []);
  const [touched, setTouched] = useState(false);
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
            <Viewer3D geometry={geometry} modelKey={`${category}-${option}-${geometry.solids.length}`} />
          </Suspense>
        </Guard>
      ) : (
        fallback
      )}
      <div className="v-viewer__tags">
        <ExampleTag>{engine ? 'Engine model · example site' : 'Example model'}</ExampleTag>
      </div>
      {webgl ? <span className={`v-viewer__hint ${touched ? 'is-hidden' : ''}`}>Drag to look around</span> : null}
    </div>
  );
}
