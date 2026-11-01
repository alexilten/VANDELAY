import type { MaterialId } from './geometry';

export interface MaterialLook {
  readonly color: string;
  readonly roughness: number;
  readonly metalness: number;
  readonly opacity?: number;
}

export interface ScenePalette {
  readonly materials: Record<MaterialId, MaterialLook>;
  readonly ground: string;
  readonly plant: string;
  readonly lot: string;
  readonly buildable: string;
  readonly sky: string;
  readonly groundLight: string;
  readonly sun: number;
  readonly fill: number;
}

/*
 * Material looks for the architecture: cedar, weathered steel, blackened
 * steel, board-formed concrete and clear glass. The UI around the viewer stays
 * Apple-neutral; only the buildings carry material colour.
 */
const MATERIALS: Record<MaterialId, MaterialLook> = {
  timber: { color: '#b8865a', roughness: 0.8, metalness: 0 },
  corten: { color: '#9a4b2b', roughness: 0.75, metalness: 0.15 },
  blackSteel: { color: '#38383b', roughness: 0.6, metalness: 0.4 },
  concrete: { color: '#c7c3bb', roughness: 0.95, metalness: 0 },
  glass: { color: '#a9c3cf', roughness: 0.05, metalness: 0.2, opacity: 0.38 },
  grass: { color: '#8ea873', roughness: 1, metalness: 0 },
};

export const LIGHT: ScenePalette = {
  materials: MATERIALS,
  ground: '#ecebe6',
  plant: '#93a882',
  lot: '#0071e3',
  buildable: '#8e8e93',
  sky: '#ffffff',
  groundLight: '#d9d4c7',
  sun: 2.2,
  fill: 1.1,
};

export const DARK: ScenePalette = {
  materials: {
    ...MATERIALS,
    timber: { color: '#9c7049', roughness: 0.8, metalness: 0 },
    concrete: { color: '#8f8b84', roughness: 0.95, metalness: 0 },
    blackSteel: { color: '#3a3a3e', roughness: 0.5, metalness: 0.55 },
    glass: { color: '#7fa6b8', roughness: 0.05, metalness: 0.3, opacity: 0.45 },
  },
  ground: '#2c2c30',
  plant: '#47593c',
  lot: '#2997ff',
  buildable: '#86868b',
  sky: '#c9d3e3',
  groundLight: '#1c1c1e',
  sun: 2.2,
  fill: 0.95,
};
