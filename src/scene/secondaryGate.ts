import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Collider} from '../types';

/** Proposed open secondary entrance; all planting and gate leaves stay off the lane. */
/** Proposed open secondary entrance; all planting and gate leaves stay off the lane. */
export function createSecondaryGate(left:T.Vector3,right:T.Vector3,colliders:Collider[]){
 const group=new T.Group();group.name='secondary-gate-and-flower-approach';
 const metal=new T.MeshStandardMaterial({color:0x344e47,roughness:.65,metalness:.35});
 const brass=new T.MeshStandardMaterial({color:0xb89b63,roughness:.65,metalness:.3});
 const stone=new T.MeshStandardMaterial({color:0xc3b8a1,roughness:.95});
 const soil=new T.MeshStandardMaterial({color:0x46372c,roughness:1});
 const leaves=new T.MeshLambertMaterial({color:0x58774b});
 const parts=new Map<T.Material,T.BufferGeometry[]>();
 function add(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number){g.translate(x,y,z);const list=parts.get(m)||[];list.push(g);parts.set(m,list);}
 function box(m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){add(new T.BoxGeometry(w,h,d),m,x,y,z);}
 // High lintel bridges existing piers, with a readable name facing both approaches.
 const centre=left.clone().add(right).multiplyScalar(.5),span=right.x-left.x;
 const beam=new T.Mesh(new T.BoxGeometry(span+1.5,.55,.48),metal);beam.position.set(centre.x,4.25,centre.z);beam.rotation.y=-Math.atan2(right.z-left.z,span);group.add(beam);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle='#344e47';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#fff2d1';ctx.font='600 64px "Segoe UI",Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tr('VJU · CỔNG PHỤ'),512,66);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 for(const side of [-1,1]){const name=new T.Mesh(new T.PlaneGeometry(5.7,.71),new T.MeshBasicMaterial({map:texture,toneMapped:false}));name.position.set(centre.x,4.26,centre.z+side*.26);name.rotation.y=side===1?beam.rotation.y:beam.rotation.y+Math.PI;group.add(name);}
 for(const [p,side] of [[left,1],[right,-1]] as const){
  // Leaves are already folded inward along the grass, not drawn across the opening.
  const x=p.x+side*.73,z=p.z-2.5;
  for(const end of [-2.35,2.35])box(metal,x,1.36,z+end,.12,2.45,.12);
  for(const y of [.19,.64,2.53])box(metal,x,y,z,.12,.12,4.82);
  for(let i=0;i<13;i++)box(metal,x,1.55,z-2.15+i*.36,.07,1.84,.07);
  for(const y of [.55,2.3])box(brass,p.x+side*.62,y,p.z-.15,.28,.17,.22);
  colliders.push({minX:x-.1,maxX:x+.1,minZ:z-2.45,maxZ:z+2.45,segment:[x,z-2.45,x,z+2.45],thickness:.1,maxY:2.6,label:tr('Cánh cổng phụ đang mở')});
 }
 const positions:Array<[number,number]>=[];
 const firstZ=Math.min(left.z,right.z)-7;
 for(const x of [left.x,right.x])for(let i=0;i<3;i++){
  const z=firstZ-i*2.6;if(z<48.5)continue;positions.push([x,z]);
  add(new T.CylinderGeometry(.78,.58,.68,12),stone,x,.38,z);
  add(new T.CylinderGeometry(.72,.72,.06,12),soil,x,.73,z);
  const crown=new T.SphereGeometry(.69,10,7);crown.scale(1,.55,1);add(crown,leaves,x,.94,z);
  colliders.push({minX:x-.8,maxX:x+.8,minZ:z-.8,maxZ:z+.8,maxY:1.4,label:tr('Chậu hoa lối cổng phụ')});
 }
 const flowerColors=[0xeaa4b8,0xfff0cc,0xdab761];
 const flowers=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshLambertMaterial(),positions.length*24);
 const stamp=new T.Object3D();let index=0;
 for(const [x,z] of positions)for(let i=0;i<24;i++){
  const angle=i*2.399,r=.58*Math.sqrt((i+.5)/24);stamp.position.set(x+Math.cos(angle)*r,.99+.38*Math.sqrt(1-(r/.69)**2),z+Math.sin(angle)*r);stamp.scale.set(.13,.065,.13);stamp.updateMatrix();flowers.setMatrixAt(index,stamp.matrix);flowers.setColorAt(index,new T.Color(flowerColors[i%3]));index++;
 }flowers.computeBoundingSphere();group.add(flowers);
 for(const [material,geometries] of parts){const geometry=mergeGeometries(geometries.map(g=>{const n=g.index?g.toNonIndexed():g;n.deleteAttribute('uv');return n;}))!;const mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;group.add(mesh);geometries.forEach(g=>g.dispose());}
 group.userData={proposedDesign:true,open:true,planters:positions,clearLane:[204,210],leafInnerEdges:[left.x+.83,right.x-.83]};
 return group;
}
