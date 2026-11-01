import { toMetres, type Mm } from '@vandelay/kernel';

/** The kernel works in mm; three.js scenes work in metres. Convert only at this boundary. */
export const toScene = (value: Mm): number => toMetres(value);
