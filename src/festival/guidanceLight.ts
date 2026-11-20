import * as THREE from 'three';

/** One non-colliding batch of soft warm pools along the actual left turn. */
export function createGuidanceLight() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'rgba(255,206,137,.62)');
  gradient.addColorStop(.28,'rgba(255,194,120,.38)');
  gradient.addColorStop(.66,'rgba(255,184,105,.13)');
  gradient.addColorStop(1,'rgba(255,175,96,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.MeshBasicMaterial({
    map,transparent:true,opacity:.42,depthWrite:false,toneMapped:false,
  });
  const pools=[
    [84,49,8,12,0],[84,38,8,12,0],[80,30.5,12,9,.3],
    [67,29,14,8,0],[54,29,13,8,0],[46,24,9,12,0],
    [45.6,15.6,9,13,.2],[0,18,7,5,0],[34,11,7,5,0],[-39,23,7,5,0],
  ] as const;
  const lights=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),material,pools.length);
  const transform=new THREE.Object3D();
  pools.forEach(([x,z,w,d,yaw],i)=>{
    transform.position.set(x,.274,z);transform.rotation.set(-Math.PI/2,0,yaw);
    transform.scale.set(w,d,1);transform.updateMatrix();lights.setMatrixAt(i,transform.matrix);
  });
  lights.instanceMatrix.needsUpdate=true;lights.renderOrder=3;lights.name='festival-guidance-light';
  return lights;
}
