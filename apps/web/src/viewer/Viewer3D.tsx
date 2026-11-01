import { Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CanvasTexture, DoubleSide, Euler, Object3D, PlaneGeometry, Vector3, type Group, type Mesh } from 'three';
import { solidBounds, terrainZ, type OptionGeometry, type Point2, type Solid, type Terrain } from './geometry';
import { DARK, LIGHT, type ScenePalette } from './palette';
import { useIsDark } from './useIsDark';

// Vandelay is Z up everywhere. Set here, where three first loads, so it runs
// before any scene exists while keeping three out of the first page load.
Object3D.DEFAULT_UP.set(0, 0, 1);

/** mm (site data) → metres (three.js). */
const M = 0.001;

type Props = {
  geometry: OptionGeometry;
  /** Changes when the option changes, so the building rises in again. */
  modelKey: string;
  /** Opens moving parts such as sliding shutters. */
  open?: boolean;
};

export default function Viewer3D({ geometry, modelKey, open = true }: Props) {
  const dark = useIsDark();
  const palette = dark ? DARK : LIGHT;
  const frame = useMemo(() => frameFor(geometry), [geometry]);
  const reduced = useMemo(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [auto, setAuto] = useState(!reduced);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
      camera={{ fov: 30, near: frame.radius / 50, far: frame.radius * 40, position: frame.camera }}
    >
      <hemisphereLight args={[palette.sky, palette.groundLight, palette.fill]} />
      <directionalLight
        castShadow
        position={[frame.center.x - frame.radius * 1.2, frame.center.y - frame.radius * 1.6, frame.center.z + frame.radius * 2.2]}
        intensity={palette.sun}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-frame.radius * 1.6}
        shadow-camera-right={frame.radius * 1.6}
        shadow-camera-top={frame.radius * 1.6}
        shadow-camera-bottom={-frame.radius * 1.6}
        shadow-camera-near={frame.radius * 0.1}
        shadow-camera-far={frame.radius * 8}
      />
      <CameraRig frame={frame} />
      <Ground terrain={geometry.site.terrain} frame={frame} palette={palette} />
      <Outline points={geometry.site.boundary} terrain={geometry.site.terrain} color={palette.lot} width={1.6} />
      {geometry.site.buildable ? (
        <Outline points={geometry.site.buildable} terrain={geometry.site.terrain} color={palette.buildable} width={1} dashed />
      ) : null}
      <Plants geometry={geometry} palette={palette} />
      <Rise key={modelKey} base={frame.base} animate={!reduced}>
        {geometry.solids.map((s) => (
          <SolidMesh key={s.id} solid={s} palette={palette} open={open} animate={!reduced} />
        ))}
      </Rise>
      <OrbitControls
        makeDefault
        target={frame.center}
        enableDamping
        dampingFactor={0.08}
        autoRotate={auto}
        autoRotateSpeed={0.5}
        minDistance={frame.radius * 0.6}
        maxDistance={frame.radius * 6}
        maxPolarAngle={Math.PI * 0.47}
        enablePan={false}
        onStart={() => setAuto(false)}
      />
    </Canvas>
  );
}

// ── framing ──────────────────────────────────────────────────────────────────

interface Frame {
  center: Vector3;
  radius: number;
  base: number;
  camera: [number, number, number];
  extent: { x0: number; y0: number; x1: number; y1: number };
}

function frameFor(g: OptionGeometry): Frame {
  const b = solidBounds(g.solids);
  const has = g.solids.length > 0;
  const xs = g.site.boundary.map((p) => p[0]);
  const ys = g.site.boundary.map((p) => p[1]);
  const lot = { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
  const min = has ? b.min : [lot.x0, lot.y0, 0];
  const max = has ? b.max : [lot.x1, lot.y1, 0];
  const cx = ((min[0]! + max[0]!) / 2) * M;
  const cy = ((min[1]! + max[1]!) / 2) * M;
  const cz = ((min[2]! + max[2]!) / 2) * M;
  // Frame the building, but keep the lot in view.
  const span = Math.max((max[0]! - min[0]!) * M, (max[1]! - min[1]!) * M, (max[2]! - min[2]!) * M);
  const lotSpan = Math.max(lot.x1 - lot.x0, lot.y1 - lot.y0) * M;
  // Frame the building; include the lot only when it is not much bigger than the building.
  const radius = Math.max(span * 0.85, Math.min(lotSpan * 0.34, span * 1.4), 8);
  const center = new Vector3(cx, cy, cz);
  const dir = new Vector3(-0.75, -1.15, 0.72).normalize().multiplyScalar(radius * 2.4);
  const camera: [number, number, number] = [cx + dir.x, cy + dir.y, cz + dir.z];
  const margin = Math.max(radius * 3, lotSpan) / M;
  const base = has ? min[2]! * M : 0;
  return { center, radius, base, camera, extent: { x0: lot.x0 - margin, y0: lot.y0 - margin, x1: lot.x1 + margin, y1: lot.y1 + margin } };
}

/** Eases the camera to a new framing when the option or category changes. */
function CameraRig({ frame }: { frame: Frame }) {
  const { camera, controls } = useThree() as unknown as { camera: { position: Vector3; near: number; far: number; updateProjectionMatrix: () => void }; controls?: { target: Vector3; update: () => void } };
  const goal = useRef<{ pos: Vector3; target: Vector3; t: number } | null>(null);
  useEffect(() => {
    camera.near = frame.radius / 50;
    camera.far = frame.radius * 40;
    camera.updateProjectionMatrix();
    goal.current = { pos: new Vector3(...frame.camera), target: frame.center.clone(), t: 0 };
  }, [frame, camera]);
  useFrame((_, dt) => {
    const g = goal.current;
    if (!g || !controls) return;
    g.t = Math.min(1, g.t + dt * 1.6);
    const k = 1 - Math.pow(1 - g.t, 3);
    camera.position.lerp(g.pos, k * 0.25);
    controls.target.lerp(g.target, k * 0.25);
    controls.update();
    if (g.t >= 1) goal.current = null;
  });
  return null;
}

// ── site ─────────────────────────────────────────────────────────────────────

/** A soft-edged radial fade so the ground dissolves into the page instead of ending in a hard square. */
let fadeTexture: CanvasTexture | undefined;
function getFade(): CanvasTexture {
  if (fadeTexture) return fadeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.55, '#fff');
  g.addColorStop(1, '#000');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  fadeTexture = new CanvasTexture(c);
  return fadeTexture;
}

function Ground({ terrain, frame, palette }: { terrain: Terrain; frame: Frame; palette: ScenePalette }) {
  const geo = useMemo(() => {
    const { x0, y0, x1, y1 } = frame.extent;
    const w = (x1 - x0) * M;
    const h = (y1 - y0) * M;
    const g = new PlaneGeometry(w, h, 64, 64);
    const pos = g.attributes.position!;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) / M + cx;
      const y = pos.getY(i) / M + cy;
      pos.setXYZ(i, x * M, y * M, terrainZ(terrain, x, y) * M);
    }
    g.computeVertexNormals();
    return g;
  }, [terrain, frame]);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={palette.ground} roughness={1} alphaMap={getFade()} transparent depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

/** A closed outline draped on the ground, sampled along each edge. */
function Outline({ points, terrain, color, width, dashed = false }: { points: readonly Point2[]; terrain: Terrain; color: string; width: number; dashed?: boolean }) {
  const pts = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const n = 12;
      for (let k = 0; k < n; k++) {
        const x = a[0] + ((b[0] - a[0]) * k) / n;
        const y = a[1] + ((b[1] - a[1]) * k) / n;
        out.push([x * M, y * M, terrainZ(terrain, x, y) * M + 0.06]);
      }
    }
    out.push(out[0]!);
    return out;
  }, [points, terrain]);
  return <Line points={pts} color={color} lineWidth={width} dashed={dashed} dashSize={0.8} gapSize={0.6} transparent opacity={0.9} />;
}

function Plants({ geometry, palette }: { geometry: OptionGeometry; palette: ScenePalette }) {
  return (
    <group>
      {(geometry.plants ?? []).map((p, i) => {
        const h = p.height * M;
        const z = terrainZ(geometry.site.terrain, p.at[0], p.at[1]) * M;
        return (
          <mesh key={i} position={[p.at[0] * M, p.at[1] * M, z + h / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <coneGeometry args={[h * 0.17, h, 7]} />
            <meshStandardMaterial color={palette.plant} roughness={1} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

// ── buildings ────────────────────────────────────────────────────────────────

/** Grows its children up from the ground when mounted. */
function Rise({ base, animate, children }: { base: number; animate: boolean; children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  const t = useRef(animate ? 0 : 1);
  useFrame((_, dt) => {
    if (!ref.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt * 1.8);
    const k = 1 - Math.pow(1 - t.current, 3);
    ref.current.scale.z = Math.max(0.001, k);
  });
  return (
    <group ref={ref} position={[0, 0, base]} scale={[1, 1, animate ? 0.001 : 1]}>
      <group position={[0, 0, -base]}>{children}</group>
    </group>
  );
}

function SolidMesh({ solid: s, palette, open, animate }: { solid: Solid; palette: ScenePalette; open: boolean; animate: boolean }) {
  const look = palette.materials[s.material];
  const ref = useRef<Mesh>(null);
  const rotation = useMemo(() => new Euler(((s.tilt ?? 0) * Math.PI) / 180, 0, (s.rotation * Math.PI) / 180, 'ZYX'), [s.tilt, s.rotation]);
  const home = useMemo(() => new Vector3(s.center[0] * M, s.center[1] * M, s.center[2] * M), [s.center]);
  const slide = useRef(0);
  useFrame((_, dt) => {
    const m = s.mechanism;
    if (!m || !ref.current) return;
    const goal = open ? 1 : 0;
    slide.current = animate ? slide.current + (goal - slide.current) * Math.min(1, dt * 1.5) : goal;
    const d = slide.current * m.travel * M;
    ref.current.position.set(home.x + m.axis[0] * d, home.y + m.axis[1] * d, home.z);
  });
  const glass = s.material === 'glass';
  return (
    <mesh ref={ref} position={home} rotation={rotation} castShadow={!glass} receiveShadow>
      <boxGeometry args={[s.size[0] * M, s.size[1] * M, s.size[2] * M]} />
      <meshStandardMaterial
        color={look.color}
        roughness={look.roughness}
        metalness={look.metalness}
        transparent={look.opacity !== undefined}
        opacity={look.opacity ?? 1}
        depthWrite={!glass}
      />
    </mesh>
  );
}
