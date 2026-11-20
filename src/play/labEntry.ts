import {tr} from '../i18n/index.ts';
/** One shared doorway, on the left of the existing laboratory main entrance. */
export const LAB_ENTRY = { x: 106.05, z: -61.5, name: 'lab-placeholder-entry' } as const;
export function nearLabEntry(at: { x: number; z: number }) {
  // Only approach from outside; the building remains closed while labs are in development.
  return at.z > LAB_ENTRY.z && Math.hypot(at.x - LAB_ENTRY.x, at.z - LAB_ENTRY.z) < 4.8;
}
export const LAB_ROOMS = [
  { id: 'lab-fth', name: tr('Phòng thí nghiệm FTH') },
  { id: 'lab-physics', name: tr('Phòng thí nghiệm Vật lý') },
] as const;
