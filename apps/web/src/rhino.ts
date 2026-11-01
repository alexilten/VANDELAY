import type { RhinoModule } from 'rhino3dm';

let rhino: Promise<RhinoModule> | undefined;

/** rhino3dm ships a large WASM binary, so load it lazily, once, when an export needs it. */
export const loadRhino = (): Promise<RhinoModule> =>
  (rhino ??= import('rhino3dm').then((m) => m.default()));
