/** Y-up; dimensions are relative blockout units, not measured metres. */
export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  label?: string;
  /** Optional physical height for camera obstruction; walking remains 2D. */
  maxY?: number;
  polygon?: readonly (readonly [number, number])[];
  segment?: readonly [number, number, number, number];
  thickness?: number;
}
