import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Festival-only, visual dressing: no colliders and no changes to the approved gate. */
export function slenderGateLamp(x:number,z:number){
  const group=new THREE.Group();group.name='gate-festival-slender-lamp';group.position.set(x,0,z);
  const metal=new THREE.MeshStandardMaterial({color:0x34413f,metalness:.55,roughness:.5});
  const trim=new THREE.MeshStandardMaterial({color:0x9d865c,metalness:.5,roughness:.6});
  const glass=new THREE.MeshBasicMaterial({color:0xc7ad7c,toneMapped:false});
  const add=(geo:THREE.BufferGeometry,mat:THREE.Material,y:number)=>{const m=new THREE.Mesh(geo,mat);m.position.y=y;group.add(m);return m;};
  add(new THREE.CylinderGeometry(.18,.24,.14,16),metal,.28);
  add(new THREE.CylinderGeometry(.06,.085,2.5,12),metal,1.6);
  add(new THREE.CylinderGeometry(.2,.2,.06,16),trim,2.87);
  add(new THREE.CylinderGeometry(.135,.135,.42,16),glass,3.1);
  for(let i=0;i<4;i++){const a=i*Math.PI/2,m=add(new THREE.CylinderGeometry(.016,.016,.46,8),metal,3.1);m.position.x=Math.cos(a)*.16;m.position.z=Math.sin(a)*.16;}
  add(new THREE.CylinderGeometry(.22,.24,.075,16),metal,3.35);
  // Static, downward pool; no per-pole lights, glare sprites or animation.
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;
  const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,212,147,.32)');g.addColorStop(.4,'rgba(245,188,111,.16)');g.addColorStop(1,'rgba(235,171,89,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  const pool=new THREE.Mesh(new THREE.PlaneGeometry(5.4,5.4),new THREE.MeshBasicMaterial({map,transparent:true,opacity:.42,depthWrite:false,toneMapped:false}));
  pool.name='gate-festival-lamp-soft-pool';pool.rotation.x=-Math.PI/2;pool.position.y=.274;group.add(pool);
  return group;
}

export function createGateDressing(){
  const group=new THREE.Group();group.name='gate-festival-dressing';
  // Outside observer's RIGHT. Keep the existing planter and its collision;
  // restore a low adjacent planting in the grass between fence and street.
  const bed=new THREE.Group();bed.name='gate-festival-low-garden';group.add(bed);
  bed.userData={bounds:{minX:99,maxX:107,minZ:55.65,maxZ:58.05},maxHeight:.72,visualOnly:true};
  const soil=new THREE.Mesh(new RoundedBoxGeometry(8,.12,2.4,3,.055),new THREE.MeshStandardMaterial({color:0x35422c,roughness:1}));
  soil.position.set(103,.08,56.85);bed.add(soil);
  const petals=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({roughness:.86}),300);
  const leaves=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,5),new THREE.MeshStandardMaterial({color:0x42653c,roughness:1}),120);
  const centres=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshStandardMaterial({color:0xd9a349,roughness:.85}),60);
  const stamp=new THREE.Object3D(),colors=[0xf2c673,0xe8af7d,0xb94c51,0xe6d2a3];let seed=201120;
  const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<60;i++){
    const row=Math.floor(i/20),x=99.35+(i%20)*.38+(random()-.5)*.12,z=56.04+row*.66+(random()-.5)*.22;
    const y=.36+random()*.24,a=random()*Math.PI*2,size=.11+random()*.055,color=new THREE.Color(colors[(Math.floor(i/6)+row)%colors.length]);
    for(let k=0;k<5;k++){
      const t=a+k*Math.PI*2/5;stamp.position.set(x+Math.cos(t)*size*.66,y,z+Math.sin(t)*size*.66);stamp.rotation.set(.12,-t,.14);stamp.scale.set(size,.045,size*.66);stamp.updateMatrix();petals.setMatrixAt(i*5+k,stamp.matrix);petals.setColorAt(i*5+k,color);
    }
    stamp.position.set(x,y+.025,z);stamp.rotation.set(0,0,0);stamp.scale.set(.055,.038,.055);stamp.updateMatrix();centres.setMatrixAt(i,stamp.matrix);
    for(let k=0;k<2;k++){stamp.position.set(x+(k?-.12:.12),y-.13,z);stamp.rotation.set(0,a,k?.4:-.4);stamp.scale.set(.22,.055,.1);stamp.updateMatrix();leaves.setMatrixAt(i*2+k,stamp.matrix);}
  }
  petals.name='gate-low-flower-petals';leaves.name='gate-low-flower-leaves';bed.add(petals,leaves,centres);
  // Third light fits within the already-solid right planter footprint.
  group.add(slenderGateLamp(98,57));
  return group;
}
