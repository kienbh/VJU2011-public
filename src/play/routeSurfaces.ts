import * as T from 'three';
import type {RouteArea,RouteLane} from './routePlanner';

/** Read the same transformed paths that are drawn in the campus, not a second map. */
export function routeSurfaces(scene:T.Object3D){
 const lanes:RouteLane[]=[],areas:RouteArea[]=[];scene.updateWorldMatrix(true,true);
 scene.traverse(m=>{
  if(m.userData.road&&Array.isArray(m.userData.centerline)){
   const scale=m.getWorldScale(new T.Vector3());
   lanes.push({points:m.userData.centerline.map(([x,z]:number[])=>{const p=m.localToWorld(new T.Vector3(x,0,z));return {x:p.x,z:p.z};}),width:m.userData.width*Math.min(Math.abs(scale.x),Math.abs(scale.z)),cost:m.name.includes('pedestrian')?1:1.2});
  }
  if(m.userData.navigationSurface){const box=new T.Box3().setFromObject(m);areas.push({minX:box.min.x,maxX:box.max.x,minZ:box.min.z,maxZ:box.max.z});}
 });
 return {lanes,areas};
}
