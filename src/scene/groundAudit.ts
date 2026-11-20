import * as T from 'three';
/** Development-only geometry evidence. Excludes lawns, asphalt and water from candidate paving. */
export function groundSurfaceAudit(scene:T.Object3D){
 const roads:number[][][][]=[],surfaces:{name:string;triangles:number[][][];height:number}[]=[];scene.updateMatrixWorld(true);
 scene.traverse(o=>{
  if(!(o instanceof T.Mesh)||o instanceof T.InstancedMesh||!o.visible)return;
  const a=o.geometry.getAttribute('position');if(!a)return;const idx=o.geometry.index;
  const point=(i:number)=>new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld);
  if(o.userData.road&&!o.name.includes('pedestrian')){const left:number[][]=[],right:number[][]=[];for(let i=0;i<a.count;i+=2){const l=point(i),r=point(i+1);left.push([l.x,l.z]);right.push([r.x,r.z]);}roads.push([[...left,...right.reverse(),left[0]]]);return;}
  const material=Array.isArray(o.material)?o.material[0]:o.material,map=(material as T.MeshStandardMaterial).map;
  if(/asphalt|grass/.test(map?.name||'')||/water|shallow|meadow|lawn|lake|shore/.test(o.name)&&!o.name.includes('pedestrian')&&!o.name.includes('terrace'))return;
  const triangles:number[][][]=[];let height=0;
  for(let i=0;i<(idx?.count||a.count);i+=3){const p=[0,1,2].map(j=>point(idx?idx.getX(i+j):i+j));if(p.some(v=>v.y<.04||v.y>.34)||Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y))>.0001)continue;
   const area=Math.abs((p[1].x-p[0].x)*(p[2].z-p[0].z)-(p[1].z-p[0].z)*(p[2].x-p[0].x))/2;if(area<.01)continue;triangles.push(p.map(v=>[v.x,v.z]));height=p[0].y;
  }
  if(triangles.length)surfaces.push({name:o.name||o.parent?.name||o.uuid,triangles,height});
 });return {roads,surfaces};
}
