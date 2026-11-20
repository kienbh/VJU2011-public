import type {Collider} from '../types';
import {isWalkable,type GroundPoint,type WalkBounds} from '../player/collision';

export type RouteLane={points:GroundPoint[];width:number;cost?:number};
export type RouteArea=WalkBounds;
export const ROUTE_RADIUS=.85;
const distance=(a:GroundPoint,b:GroundPoint)=>Math.hypot(a.x-b.x,a.z-b.z);
const segmentDistance=(p:GroundPoint,a:GroundPoint,b:GroundPoint)=>{
 const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1)));
 return Math.hypot(p.x-a.x-t*dx,p.z-a.z-t*dz);
};

/** Reusable weighted A*: prefer built paths/plazas and clearance, not straight-line shortcuts. */
export function createRoutePlanner(colliders:Collider[],bounds:WalkBounds,lanes:RouteLane[]=[],areas:RouteArea[]=[]) {
 const step=1.5,w=Math.floor((bounds.maxX-bounds.minX)/step)+1,h=Math.floor((bounds.maxZ-bounds.minZ)/step)+1,count=w*h;
 const point=(id:number)=>({x:bounds.minX+id%w*step,z:bounds.minZ+Math.floor(id/w)*step});
 const terrain=new Float32Array(count).fill(5),free=new Int8Array(count),weights=new Float32Array(count),edgeKnown=new Uint8Array(count),edgeFree=new Uint8Array(count);
 const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],reverse=[1,0,3,2,7,6,5,4];
 // Buckets keep collision checks local; include the wider comfort margin too.
 const bucketSize=12,buckets=new Map<string,Collider[]>();let colliderCount=-1;
 function refresh(){if(colliderCount===colliders.length)return;colliderCount=colliders.length;buckets.clear();free.fill(0);weights.fill(0);edgeKnown.fill(0);edgeFree.fill(0);
  for(const c of colliders)for(let x=Math.floor((c.minX-2.3)/bucketSize);x<=Math.floor((c.maxX+2.3)/bucketSize);x++)for(let z=Math.floor((c.minZ-2.3)/bucketSize);z<=Math.floor((c.maxZ+2.3)/bucketSize);z++){
   const key=x+','+z,list=buckets.get(key);if(list)list.push(c);else buckets.set(key,[c]);
  }
 }
 const nearby=(p:GroundPoint)=>buckets.get(Math.floor(p.x/bucketSize)+','+Math.floor(p.z/bucketSize))||[];
 const walkable=(p:GroundPoint,radius=ROUTE_RADIUS)=>Number.isFinite(p.x)&&Number.isFinite(p.z)&&isWalkable(p,nearby(p),bounds,radius);
 const clear=(a:GroundPoint,b:GroundPoint)=>{if(!walkable(a)||!walkable(b))return false;const n=Math.ceil(distance(a,b)/.35);for(let i=1;i<n;i++)if(!walkable({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n}))return false;return true;};
 const raster=(box:WalkBounds,visit:(p:GroundPoint)=>number)=>{
  for(let z=Math.max(0,Math.floor((box.minZ-bounds.minZ)/step));z<=Math.min(h-1,Math.ceil((box.maxZ-bounds.minZ)/step));z++)
   for(let x=Math.max(0,Math.floor((box.minX-bounds.minX)/step));x<=Math.min(w-1,Math.ceil((box.maxX-bounds.minX)/step));x++){
    const id=z*w+x;terrain[id]=Math.min(terrain[id],visit(point(id)));
   }
 };
 for(const area of areas)raster(area,p=>p.x>=area.minX&&p.x<=area.maxX&&p.z>=area.minZ&&p.z<=area.maxZ?1.1:5);
 for(const lane of lanes)for(let i=1;i<lane.points.length;i++){
  const a=lane.points[i-1],b=lane.points[i],radius=Math.max(.5,lane.width/2-ROUTE_RADIUS),cost=Math.max(1,lane.cost??1.2);
  raster({minX:Math.min(a.x,b.x)-radius,maxX:Math.max(a.x,b.x)+radius,minZ:Math.min(a.z,b.z)-radius,maxZ:Math.max(a.z,b.z)+radius},p=>segmentDistance(p,a,b)<=radius?cost:5);
 }
 const safe=(id:number)=>{if(!free[id])free[id]=walkable(point(id))?1:-1;return free[id]===1;};
 const weight=(id:number)=>weights[id]||(weights[id]=terrain[id]+(walkable(point(id),2.2)?0:3));
 const atId=(p:GroundPoint)=>Math.max(0,Math.min(h-1,Math.round((p.z-bounds.minZ)/step)))*w+Math.max(0,Math.min(w-1,Math.round((p.x-bounds.minX)/step)));
 function cost(a:GroundPoint,b:GroundPoint){const length=distance(a,b),n=Math.max(1,Math.ceil(length/.5));let sum=0;for(let i=0;i<n;i++){const t=(i+.5)/n;sum+=weight(atId({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}));}return length*sum/n;}
 function snap(p:GroundPoint){let best=-1,d=Infinity;const x=Math.round((p.x-bounds.minX)/step),z=Math.round((p.z-bounds.minZ)/step);
  for(let dz=-3;dz<=3;dz++)for(let dx=-3;dx<=3;dx++){const nx=x+dx,nz=z+dz;if(nx<0||nx>=w||nz<0||nz>=h)continue;const id=nz*w+nx,q=point(id),dist=distance(p,q);if(dist<d&&safe(id)&&clear(p,q)){best=id;d=dist;}}return best;
 }
 function find(start:GroundPoint,end:GroundPoint):GroundPoint[]{
  refresh();if(!walkable(start)||!walkable(end))return [];
  if(distance(start,end)<.01)return [{...start},{...end}];
  const first=snap(start),last=snap(end);if(first<0||last<0)return [];
  const scores=new Float64Array(count).fill(Infinity),parent=new Int32Array(count).fill(-1);
  type Entry={id:number;g:number;f:number};const heap:Entry[]=[];
  const push=(entry:Entry)=>{heap.push(entry);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=entry.f)break;heap[i]=heap[p];i=p;}heap[i]=entry;};
  const pop=()=>{const top=heap[0],tail=heap.pop()!;if(heap.length){let i=0;while(i*2+1<heap.length){let child=i*2+1;if(child+1<heap.length&&heap[child+1].f<heap[child].f)child++;if(heap[child].f>=tail.f)break;heap[i]=heap[child];i=child;}heap[i]=tail;}return top;};
  const goal=point(last);scores[first]=0;push({id:first,g:0,f:distance(point(first),goal)});let found=false;
  while(heap.length){const {id,g}=pop();if(g!==scores[id])continue;if(id===last){found=true;break;}const x=id%w,z=Math.floor(id/w),a=point(id);
   for(let direction=0;direction<directions.length;direction++){const [dx,dz]=directions[direction];
    const nx=x+dx,nz=z+dz,n=nz*w+nx;if(nx<0||nx>=w||nz<0||nz>=h||!safe(n))continue;
    const next=g+step*(dx&&dz?Math.SQRT2:1)*(weight(id)+weight(n))/2;if(next>=scores[n])continue;
    const b=point(n),bit=1<<direction,back=1<<reverse[direction];
    if(!(edgeKnown[id]&bit)){edgeKnown[id]|=bit;edgeKnown[n]|=back;if(clear(a,b)){edgeFree[id]|=bit;edgeFree[n]|=back;}}
    if(!(edgeFree[id]&bit))continue;scores[n]=next;parent[n]=id;push({id:n,g:next,f:next+distance(b,goal)});
   }
  }
  if(!found)return [];
  const chain:GroundPoint[]=[end];for(let id=last;id!==first;id=parent[id])chain.push(point(id));chain.push(point(first),start);chain.reverse();
  const cumulative=[0];for(let i=1;i<chain.length;i++)cumulative.push(cumulative[i-1]+cost(chain[i-1],chain[i]));
  const route=[chain[0]];let at=0;
  while(at<chain.length-1){let next=Math.min(chain.length-1,at+24);
   // Smoothing may remove grid zigzags, but must not undo the preferred walkway.
   while(next>at+1&&(!clear(chain[at],chain[next])||cost(chain[at],chain[next])>(cumulative[next]-cumulative[at])*1.02))next--;
   if(distance(route[route.length-1],chain[next])>.01)route.push(chain[next]);at=next;
  }
  return route;
 }
 refresh();
 return {find,clearSegment:(a:GroundPoint,b:GroundPoint)=>{refresh();return clear(a,b);}};
}
