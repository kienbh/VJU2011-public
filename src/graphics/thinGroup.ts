import * as THREE from 'three';

/** Evenly spaced subset, retaining the exact original matrices/colors for restoration. */
export function thinGroup(mesh:THREE.InstancedMesh){
  const count=mesh.count,matrices=mesh.instanceMatrix.array.slice(),colors=mesh.instanceColor?.array.slice();
  return (density:number)=>{
    const next=Math.max(1,Math.round(count*Math.max(0,Math.min(1,density))));
    for(let i=0;i<next;i++){
      const source=Math.floor(i*count/next);
      mesh.instanceMatrix.array.set(matrices.slice(source*16,source*16+16),i*16);
      if(colors&&mesh.instanceColor)mesh.instanceColor.array.set(colors.slice(source*3,source*3+3),i*3);
    }
    mesh.count=next;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    mesh.computeBoundingSphere();
  };
}
