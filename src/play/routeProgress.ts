type Point={x:number;z:number};
export function routeDistance(at:Point,points:Point[]){let best=Infinity;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,d=dx*dx+dz*dz,t=d?Math.max(0,Math.min(1,((at.x-a.x)*dx+(at.z-a.z)*dz)/d)):0;best=Math.min(best,Math.hypot(at.x-a.x-t*dx,at.z-a.z-t*dz));}return best;}
/** Advance along the nearest route segment; never jump to a distant visible destination. */
export function shortcutIndex(at:Point,points:Point[],clear:(a:Point,b:Point)=>boolean){
 let nearest=-1,best=Infinity;
 for(let i=1;i<points.length;i++){const d=routeDistance(at,[points[i-1],points[i]]);if(d<best-1e-5){best=d;nearest=i;}}
 // Once at a turn, continue on the next segment rather than pinning the old corner.
 if(nearest>=1&&nearest<points.length-1&&Math.hypot(at.x-points[nearest].x,at.z-points[nearest].z)<.8)nearest++;
 return nearest>=1&&clear(at,points[nearest])?nearest:-1;
}
