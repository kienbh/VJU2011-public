import type { Collider } from '../types';

export type WalkBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type GroundPoint = { x: number; z: number };
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function isWalkable(point: GroundPoint, colliders: Collider[], bounds: WalkBounds, radius = 0.65): boolean {
  if (point.x < bounds.minX + radius || point.x > bounds.maxX - radius ||
      point.z < bounds.minZ + radius || point.z > bounds.maxZ - radius) return false;
  return !colliders.some(box => {
    if(point.x<box.minX-radius||point.x>box.maxX+radius||point.z<box.minZ-radius||point.z>box.maxZ+radius)return false;
    const segmentDistance=(ax:number,az:number,bx:number,bz:number)=>{
      const dx=bx-ax,dz=bz-az,t=clamp(((point.x-ax)*dx+(point.z-az)*dz)/(dx*dx+dz*dz||1),0,1);
      return Math.hypot(point.x-ax-t*dx,point.z-az-t*dz);
    };
    if(box.segment)return segmentDistance(...box.segment)<radius+(box.thickness??.23);
    if(box.polygon){
      let inside=false;const p=box.polygon;
      for(let i=0,j=p.length-1;i<p.length;j=i++){
        const [ax,az]=p[i],[bx,bz]=p[j];
        if(segmentDistance(ax,az,bx,bz)<radius)return true;
        if((az>point.z)!==(bz>point.z)&&point.x<(bx-ax)*(point.z-az)/(bz-az)+ax)inside=!inside;
      }
      return inside;
    }
    const dx = point.x - clamp(point.x, box.minX, box.maxX);
    const dz = point.z - clamp(point.z, box.minZ, box.maxZ);
    return dx * dx + dz * dz < radius * radius - 1e-8;
  });
}

/** Circular footprint, small swept steps and independent axes allow wall sliding. */
export function moveWithCollisions(
  start: GroundPoint, delta: GroundPoint, colliders: Collider[], bounds: WalkBounds, radius = 0.65,
): GroundPoint {
  const result = { x: start.x, z: start.z };
  const distance = Math.hypot(delta.x, delta.z);
  if (!Number.isFinite(distance) || distance === 0) return result;
  const steps = Math.ceil(distance / (radius * 0.45));
  const dx = delta.x / steps;
  const dz = delta.z / steps;
  const advance = (axis: 'x' | 'z', amount: number) => {
    if (!amount) return;
    const candidate = { ...result, [axis]: result[axis] + amount };
    if (isWalkable(candidate, colliders, bounds, radius)) { result[axis] += amount; return; }
    // Approach contact without leaving a visible gap; subsequent axis keeps sliding.
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 12; iteration++) {
      const middle = (low + high) / 2;
      candidate[axis] = result[axis] + amount * middle;
      if (isWalkable(candidate, colliders, bounds, radius)) low = middle;
      else high = middle;
    }
    result[axis] += amount * low;
  };
  for (let step = 0; step < steps; step++) {
    advance('x', dx);
    advance('z', dz);
  }
  return result;
}
