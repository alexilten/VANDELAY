import { CATEGORIES, mm } from '@vandelay/kernel';
import { Canvas } from '@react-three/fiber';
import { useApp } from './store.ts';
import { toScene } from './units.ts';

// Placeholder front door. The real homepage and design system land in their own PR.
// Example module size only (not real product data): 3.6 m × 9.6 m × 3.0 m.
const MODULE = { w: mm(3600), d: mm(9600), h: mm(3000) };

export function App() {
  const { category, setCategory } = useApp();
  return (
    <main className="shell">
      <h1>What would you like to build?</h1>
      <nav className="categories">
        {CATEGORIES.map((c) => (
          <button key={c} aria-pressed={c === category} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </nav>
      <div className="viewport">
        <Canvas camera={{ position: [12, -14, 9], fov: 35 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, -6, 14]} intensity={1.2} />
          <mesh position={[0, 0, toScene(MODULE.h) / 2]}>
            <boxGeometry args={[toScene(MODULE.w), toScene(MODULE.d), toScene(MODULE.h)]} />
            <meshStandardMaterial color="#e8e8ed" />
          </mesh>
          <gridHelper args={[40, 40]} rotation={[Math.PI / 2, 0, 0]} />
        </Canvas>
      </div>
      <p className="note">Example geometry</p>
    </main>
  );
}
