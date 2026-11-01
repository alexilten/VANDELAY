/**
 * Length in millimetres. All kernel geometry is stored in mm.
 * The brand keeps plain numbers from being mixed up with metres or feet.
 */
export type Mm = number & { readonly __unit: 'mm' };

export const mm = (value: number): Mm => value as Mm;
export const fromMetres = (m: number): Mm => (m * 1000) as Mm;
export const toMetres = (value: Mm): number => value / 1000;
export const fromFeet = (ft: number): Mm => (ft * 304.8) as Mm;
