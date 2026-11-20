/** Festival furniture only; approved campus buildings and roads are unchanged. */
export const BOARD = {x:0,z:8,width:29,depth:1.2};
export const GARDEN = {x:34,z:-2,rx:12,rz:9};
/** Planting garden on the courtyard's west corner lawn: 4 rows of 6 beds. */
export const PLANT_GARDEN = {x:-56,z:23,w:28,d:22};
export const GARDEN_PLOTS: readonly (readonly [number,number])[] = Array.from({length:24},(_,i)=>[-66.5+(i%6)*4.2,16.1+Math.floor(i/6)*4.6] as const);
export function nearPlantGarden(p:{x:number;z:number}) {
  return Math.abs(p.x-PLANT_GARDEN.x)<PLANT_GARDEN.w/2+8 && Math.abs(p.z-PLANT_GARDEN.z)<PLANT_GARDEN.d/2+8;
}
/** Bed the visitor is standing at, or -1. */
export function plotAt(p:{x:number;z:number},reach=3.4) {
  let best=-1,distance=reach;
  GARDEN_PLOTS.forEach(([x,z],i)=>{const d=Math.hypot(p.x-x,p.z-z);if(d<distance){distance=d;best=i;}});
  return best;
}
// Five beds on the south arc, three on the north side; the whole island is for picking.
export const PICK_PATCHES = [[25,2],[29.5,4],[34,4.8],[38.5,4],[43,2],[27.5,-7],[34,-8.6],[40.5,-7],[44,-3]] as const;
/** Index of the closest unplanted bed, or -1 when the garden is full. */
export function nearestEmptyPlot(p:{x:number;z:number},planted:readonly unknown[]) {
  let best=-1,distance=Infinity;
  GARDEN_PLOTS.forEach(([x,z],i)=>{if(planted[i])return;const d=Math.hypot(p.x-x,p.z-z);if(d<distance){distance=d;best=i;}});
  return best;
}
export function nearFlowerGarden(p:{x:number;z:number}) {
  return Math.hypot((p.x-GARDEN.x)/1.3,p.z-GARDEN.z)<15 && p.x>19;
}
