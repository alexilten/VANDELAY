import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Object3D } from 'three';
import { App } from './App.tsx';
import './styles.css';

// Vandelay is Z up everywhere. Set it once before any scene is created.
Object3D.DEFAULT_UP.set(0, 0, 1);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
