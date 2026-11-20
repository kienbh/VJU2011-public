import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Collider} from '../types';
import type {StageSeat} from '../festival/stageLayout';
import type {SocialCorner} from './tea';

import {roundedRoad} from '../scene/roads';
import {CAMPFIRE,CAMPFIRE_TITLE} from './campfireLayout';
export {CAMPFIRE} from './campfireLayout';
// Three benches, two places each. South gap opens onto the access path.
const benches=[{x:CAMPFIRE.x,z:CAMPFIRE.z-4.2,heading:Math.PI},{x:CAMPFIRE.x-4,z:CAMPFIRE.z,heading:-Math.PI/2},{x:CAMPFIRE.x+4,z:CAMPFIRE.z,heading:Math.PI/2}];
export const CAMPFIRE_SEATS:StageSeat[]=benches.flatMap((b,i)=>[-.85,.85].map((offset,j)=>({
 id:`campfire-${i}-${j}`,number:i*2+j+1,row:i,x:b.x+Math.cos(b.heading)*offset,z:b.z-Math.sin(b.heading)*offset,eyeY:1.45,heading:b.heading,
})));

export function createCampfire(colliders:Collider[]){
 const root=new T.Group();root.name='lakeside-stone-benches-and-bbq';
 const stone=new T.MeshStandardMaterial({color:0xc6c0ae,roughness:.93}),edge=new T.MeshStandardMaterial({color:0x77776c,roughness:.95});
 const paving=new T.MeshStandardMaterial({color:0xaaa28d,roughness:1}),iron=new T.MeshStandardMaterial({color:0x30332f,roughness:.7,metalness:.45});
 const timber=new T.MeshStandardMaterial({color:0x4f3528,roughness:1}),food=new T.MeshStandardMaterial({color:0xb7653a,roughness:.7}),pepper=new T.MeshStandardMaterial({color:0xa53526,roughness:.75});
 const batches=new Map<T.Material,T.BufferGeometry[]>();
 function add(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,rotation=new T.Euler()){
  g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(rotation),new T.Vector3(1,1,1)));
  const list=batches.get(m)||[];list.push(g);batches.set(m,list);
 }
 const box=(m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=0)=>add(new T.BoxGeometry(w,h,d),m,x,y,z,new T.Euler(0,r,0));
 const {x,z}=CAMPFIRE;
 add(new T.CylinderGeometry(5.6,5.6,.08,48),paving,x,.035,z);
 // Join the west edge of the access road without spilling paving over its markings.
 root.add(roundedRoad('campfire-pedestrian-path',[[x,z+5],[x,z+8],[81.4,z+8]],2.5,paving,2));
 for(const b of benches){
  const transform=(dx:number,y:number,dz:number)=>new T.Vector3(dx,y,dz).applyAxisAngle(new T.Vector3(0,1,0),b.heading).add(new T.Vector3(b.x,0,b.z));
  const piece=(dx:number,y:number,dz:number,w:number,h:number,d:number,m=stone)=>{const p=transform(dx,y,dz);box(m,p.x,p.y,p.z,w,h,d,b.heading);};
  piece(0,.57,0,3.6,.2,.92);piece(0,1.1,.42,3.6,.75,.16);
  piece(0,1.48,.42,3.7,.09,.22);for(const dx of [-1.25,1.25])piece(dx,.27,0,.32,.54,.72,edge);
  const a=transform(-1.85,0,.42),c=transform(1.85,0,.42);
  colliders.push({minX:Math.min(a.x,c.x)-.1,maxX:Math.max(a.x,c.x)+.1,minZ:Math.min(a.z,c.z)-.1,maxZ:Math.max(a.z,c.z)+.1,segment:[a.x,a.z,c.x,c.z],thickness:.1,maxY:1.6,label:tr('Lưng ghế đá bếp nướng')});
 }
 // Stone ring, charred wood, hot coals and an open grill. No dynamic shadows.
 add(new T.CylinderGeometry(1.18,1.22,.13,32),iron,x,.16,z);
 for(let i=0;i<16;i++){const a=i*Math.PI/8;box(edge,x+Math.cos(a)*1.25,.28,z+Math.sin(a)*1.25,.46,.4,.32,-a);}
 for(const r of [-.55,.55])box(timber,x,.35,z,1.7,.22,.25,r);
 const coal=new T.MeshBasicMaterial({color:0xe65a1d,toneMapped:false});
 for(let i=0;i<18;i++){const a=i*2.399,r=.82*Math.sqrt((i+.5)/18);add(new T.DodecahedronGeometry(.12,0),coal,x+Math.cos(a)*r,.31,z+Math.sin(a)*r);}
 const gz=z-.65;
 for(const dx of [-.82,.82])for(const dz of [-.42,.42])box(iron,x+dx,.58,gz+dz,.055,1.05,.055);
 for(let i=0;i<13;i++)box(iron,x-.84+i*.14,1.12,gz,.025,.035,.92);
 for(const dz of [-.46,.46])box(iron,x,1.12,gz+dz,1.8,.06,.05);
 for(let i=0;i<4;i++){
  const sx=x-.63+i*.42;box(timber,sx,1.18,gz,.025,.025,1.2);
  for(let j=0;j<3;j++){box(j===1?pepper:food,sx,1.25,gz-.28+j*.28,.25,.16,.2,.07*i);for(const d of [-.06,.06])box(timber,sx+d,1.335,gz-.28+j*.28,.02,.01,.18);}
 }
 colliders.push({minX:x-1.55,maxX:x+1.55,minZ:z-1.55,maxZ:z+1.55,maxY:1.4,label:tr('Bếp lửa và vỉ nướng')});
 for(const [material,parts] of batches){const mesh=new T.Mesh(mergeGeometries(parts)!,material);mesh.receiveShadow=true;root.add(mesh);parts.forEach(g=>g.dispose());}
 // Layered curved flames, a shared sprite atlas and small bounded ember batch.
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;const ctx=canvas.getContext('2d')!;
 const gradient=ctx.createRadialGradient(32,90,1,32,75,55);gradient.addColorStop(0,'#fff4b9');gradient.addColorStop(.25,'#ffd253');gradient.addColorStop(.6,'#ef701bdd');gradient.addColorStop(1,'#d5350000');
 ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(32,5);ctx.bezierCurveTo(55,45,60,100,34,123);ctx.bezierCurveTo(2,115,7,70,32,5);ctx.fill();
 const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;
 const flameMaterial=new T.SpriteMaterial({map,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 const flames=Array.from({length:7},(_,i)=>{const f=new T.Sprite(flameMaterial);f.position.set(x+Math.sin(i*2.4)*.5,.7,z+.3+Math.cos(i*2.4)*.3);root.add(f);return f;});
 const emberGeo=new T.BufferGeometry();const positions=new Float32Array(18*3);emberGeo.setAttribute('position',new T.BufferAttribute(positions,3));
 const embers=new T.Points(emberGeo,new T.PointsMaterial({color:0xffba52,size:.045,transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));embers.frustumCulled=false;root.add(embers);
 const light=new T.PointLight(0xffa34c,3,9,2);light.position.set(x,1.1,z);root.add(light);
 const labelCanvas=document.createElement('canvas');labelCanvas.width=1024;labelCanvas.height=256;const c=labelCanvas.getContext('2d')!;
 c.fillStyle='#fff4d9';c.fillRect(0,0,1024,256);c.fillStyle='#314d40';c.font='bold 70px Segoe UI';c.textAlign='center';c.fillText(tr('GHẾ ĐÁ & BẾP NƯỚNG'),512,108);c.font='42px Segoe UI';c.fillText(tr('Ngồi lại · Cùng trò chuyện'),512,190);
 const labelTexture=new T.CanvasTexture(labelCanvas);labelTexture.colorSpace=T.SRGBColorSpace;
 const label=new T.Mesh(new T.PlaneGeometry(3.6,.9),new T.MeshBasicMaterial({map:labelTexture,toneMapped:false}));label.position.set(x-3.6,1.15,z+6.3);root.add(label);
 const post=new T.Mesh(new T.BoxGeometry(.1,.85,.1),edge);post.position.set(x-3.6,.43,z+6.28);root.add(post);
 let t=0;root.userData.animate=(dt:number,at:T.Vector3,reduced:boolean)=>{
  const near=Math.hypot(at.x-x,at.z-z)<35;light.visible=near;embers.visible=near&&!reduced;
  if(!near)return;if(!reduced)t+=Math.min(dt,.05);
  flames.forEach((f,i)=>{const pulse=reduced?1:1+Math.sin(t*4+i*1.7)*.14;f.scale.set(.45*pulse,(.75+i%3*.19)*pulse,1);});
  if(embers.visible){for(let i=0;i<18;i++){const phase=(t*.4+i/18)%1;positions.set([x+Math.sin(i*2.4+t)*(.15+phase*.4),.4+phase*2.1,z+.2+Math.cos(i*2.4+t*.7)*phase*.4],i*3);}emberGeo.attributes.position.needsUpdate=true;}
 };
 root.userData.animate(0,new T.Vector3(x,0,z),true);
 return root;
}

export const CAMPFIRE_CORNER:SocialCorner={id:'campfire',title:CAMPFIRE_TITLE,action:tr('Ngồi ghế đá'),centre:CAMPFIRE,seats:CAMPFIRE_SEATS,create:createCampfire,extras:[[tr('Chuyện bên bếp'),tr('Cùng ngồi chuyện trò bên bếp lửa 🔥')],[tr('Mời xiên nướng'),tr('Mời bạn một xiên nướng 🍢')]]};
