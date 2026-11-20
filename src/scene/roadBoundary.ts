import * as THREE from 'three';
import polygonClipping from 'polygon-clipping';
import type {Pair,Polygon} from 'polygon-clipping';

/** Union actual road footprints and round their re-entrant corners, including
 * variable-width/angled arms. One boundary drives both asphalt fillets and paint. */
export function roadBoundary(campus:THREE.Object3D,inset=.32,paintWidth=.11){
  const polygons:Polygon[]=[],caps:[Pair,Pair][]=[];
  const snap=(n:number)=>Math.round(n*10000)/10000;
  campus.updateMatrixWorld(true);
  const inverse=campus.matrixWorld.clone().invert();
  campus.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!object.userData.road)return;
    const position=object.geometry.getAttribute('position'),transform=inverse.clone().multiply(object.matrixWorld);
    const point=(i:number):Pair=>{const p=new THREE.Vector3().fromBufferAttribute(position,i).applyMatrix4(transform);return [snap(p.x),snap(p.z)];};
    if(object.userData.road){
      const left:Pair[]=[],right:Pair[]=[];
      for(let i=0;i<position.count;i+=2){left.push(point(i));right.push(point(i+1));}
      caps.push([left[0],right[0]],[left.at(-1)!,right.at(-1)!]);
      polygons.push([[...left,...right.reverse(),left[0]]]);
    }
  });
  const union=polygons.length?polygonClipping.union(polygons[0],...polygons.slice(1)):[];
  const spans:{a:Pair;b:Pair;corners:Pair[]}[]=[],contours:Pair[][]=[],surfacePatches:Pair[][]=[];
  const distance=(p:Pair,a:Pair,b:Pair)=>{
    const dx=b[0]-a[0],dz=b[1]-a[1],t=THREE.MathUtils.clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz),0,1);
    return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);
  };
  for(const polygon of union)for(const closed of polygon){
    let ring=closed.slice(0,-1);if(ring.length<3)continue;
    // Remove redundant samples on straight runs, retaining the sampled road bends.
    ring=ring.filter((p,i)=>{
      const a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
      return Math.abs((p[0]-a[0])*(b[1]-p[1])-(p[1]-a[1])*(b[0]-p[0]))>1e-5;
    });
    const rounded:Pair[]=[];
    for(let i=0;i<ring.length;i++){
      const p=ring[i],a=ring[(i+ring.length-1)%ring.length],b=ring[(i+1)%ring.length];
      const v0=new THREE.Vector2(p[0]-a[0],p[1]-a[1]),v1=new THREE.Vector2(b[0]-p[0],b[1]-p[1]);
      const l0=v0.length(),l1=v1.length();v0.normalize();v1.normalize();
      // Only re-entrant corners: adding asphalt here rounds the real junction.
      // Tangent points come from actual road edges, even on a flared/angled arm.
      if(v0.cross(v1)<-.35){
        const radius=Math.min(3,l0*.45,l1*.45),entry:Pair=[p[0]-v0.x*radius,p[1]-v0.y*radius],exit:Pair=[p[0]+v1.x*radius,p[1]+v1.y*radius],arc:Pair[]=[];
        for(let k=0;k<=16;k++){const t=k/16,u=1-t;arc.push([u*u*entry[0]+2*u*t*p[0]+t*t*exit[0],u*u*entry[1]+2*u*t*p[1]+t*t*exit[1]]);}
        rounded.push(...arc);surfacePatches.push([p,...arc]);
      }else rounded.push(p);
    }
    ring=rounded;
    // polygon-clipping emits CCW outer rings and CW holes: asphalt is always left.
    const offset=ring.map((p,i):Pair=>{
      const prev=ring[(i+ring.length-1)%ring.length],next=ring[(i+1)%ring.length];
      const d0=new THREE.Vector2(p[0]-prev[0],p[1]-prev[1]).normalize(),d1=new THREE.Vector2(next[0]-p[0],next[1]-p[1]).normalize();
      const n0=new THREE.Vector2(-d0.y,d0.x),n1=new THREE.Vector2(-d1.y,d1.x),bisector=n0.clone().add(n1).normalize();
      const amount=Math.min(inset/Math.max(.2,bisector.dot(n1)),inset*3);
      return [p[0]+bisector.x*amount,p[1]+bisector.y*amount];
    });contours.push(offset);
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length;
      // Open road ends are not stop lines. Junction endcaps have already disappeared in the union.
      if(caps.some(([a,b])=>distance(ring[i],a,b)<.002&&distance(ring[j],a,b)<.002))continue;
      const edge=(k:number,delta:number):Pair=>[offset[k][0]+(offset[k][0]-ring[k][0])*delta/inset,offset[k][1]+(offset[k][1]-ring[k][1])*delta/inset];
      spans.push({a:offset[i],b:offset[j],corners:[edge(i,-paintWidth/2),edge(j,-paintWidth/2),edge(i,paintWidth/2),edge(j,paintWidth/2)]});
    }
  }
  return {spans,contours,surfacePatches,roadPolygons:union,footprints:polygons.length};
}

/** Raised paving must stop at the asphalt, including rounded junction patches. */
export function pavingOutsideRoads(paving:Polygon,campus:THREE.Object3D){
  const {roadPolygons,surfacePatches}=roadBoundary(campus);
  return polygonClipping.difference(paving,...roadPolygons,...surfacePatches.map(ring=>[ring] as Polygon));
}
