import * as T from 'three';
import type {Collider} from '../types';
import {isWalkable} from '../player/collision';
import {greenItems,RUBBISH,seededRandom,type GreenState} from '../../server/greenRules.mjs';
import {GREEN_BINS} from './greenUi';

// Pooled low-poly props, at most 24 visible: no textures or downloaded assets.
export function createGreenLitter(parent:T.Group,colliders:Collider[]){
 const materials=new Map<number,T.MeshStandardMaterial>();
 const mat=(color:number)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.85}));return materials.get(color)!;};
 const box=new T.BoxGeometry(1,1,1),ball=new T.IcosahedronGeometry(1,0),can=new T.CylinderGeometry(1,1,1,8),cone=new T.CylinderGeometry(.55,1,1,8);
 function prop(shape:string){
  const group=new T.Group();
  const part=(geo:T.BufferGeometry,color:number,p:number[],s:number[],rz=0)=>{const m=new T.Mesh(geo,mat(color));m.position.set(p[0],p[1],p[2]);m.scale.set(s[0],s[1],s[2]);m.rotation.z=rz;group.add(m);return m;};
  if(shape==='banana')for(let i=-1;i<=1;i++)part(box,0xeac44e,[i*.16,.13,0],[.15,.16,.55],i*.55);
  if(shape==='can'){part(can,0x68a2ae,[0,.22,0],[.22,.44,.22],Math.PI/2);part(can,0xdde6df,[.23,.22,0],[.2,.025,.2],Math.PI/2);}
  if(shape==='tissue')for(let i=0;i<3;i++)part(ball,0xdcd9c8,[i*.13-.13,.12,0],[.2,.14,.22]);
  if(shape==='leaf'){part(ball,0xa67b31,[0,.07,0],[.34,.055,.52]);part(box,0x654c2b,[0,.12,0],[.025,.025,.7]);}
  if(shape==='bottle'){part(cone,0x92d6d0,[0,.18,0],[.22,.65,.22],Math.PI/2);part(can,0x316e9d,[.37,.18,0],[.1,.12,.1],Math.PI/2);part(box,0xf2f4db,[0,.34,0],[.24,.04,.34]);}
  if(shape==='paper'){part(box,0xf5f0d9,[0,.035,0],[.65,.06,.46]);for(let i=0;i<3;i++)part(box,0x8caaa2,[0,.071,-.13+i*.1],[.4,.009,.012]);}
  if(shape==='orange')for(let i=0;i<3;i++)part(ball,0xeb8c2d,[Math.cos(i*2)*.16,.08,Math.sin(i*2)*.16],[.18,.07,.24]);
  if(shape==='apple'){part(cone,0xe6d7a4,[0,.14,0],[.13,.25,.13]);for(const y of [.04,.29])part(ball,0xbe4934,[0,y,0],[.22,.08,.22]);}
  if(shape==='cardboard'){part(box,0xb98c52,[0,.07,0],[.65,.1,.5]);part(box,0xdac095,[0,.13,0],[.08,.01,.5]);}
  if(shape==='greasy-box'){part(box,0xd9c097,[0,.1,0],[.58,.18,.46]);part(ball,0x806947,[.03,.2,0],[.19,.015,.13]);}
  if(shape==='wrapper'){part(box,0xd26886,[0,.08,0],[.55,.1,.36]);for(const x of [-.28,.28])part(box,0xebd3a6,[x,.08,0],[.06,.11,.4]);part(box,0xf5e6aa,[0,.14,0],[.2,.01,.22]);}
  if(shape==='pen'){part(can,0x4e6ba5,[0,.06,0],[.055,.7,.055],Math.PI/2);part(cone,0xced2ce,[.38,.06,0],[.04,.12,.04],Math.PI/2);}
  return group;
 }
 const prototypes=RUBBISH.map(r=>prop(r.shape));
 const litter=Array.from({length:24},()=>{const m=new T.Group();m.visible=false;parent.add(m);return m;});
 let last='';
 function configure(id:string,state:GreenState){
  if(last===id)return;last=id;const rng=seededRandom(state.seed??917),items=greenItems(state),used:{x:number;z:number}[]=[];
  litter.forEach((m,i)=>{
   m.clear();m.visible=false;if(i>=items.length)return;m.add(prototypes[items[i]].clone(true));
   // Jittered cells behind the bins; keep props reachable and outside structures.
   let p={x:123+(i%6)*3.2,z:-40-Math.floor(i/6)*3};
   for(let attempt=0;attempt<80;attempt++){
    const candidate=attempt<12?{x:p.x+(rng()-.5)*1.4,z:p.z+(rng()-.5)*1.2}:{x:122+rng()*19,z:-39-rng()*11};
    if(isWalkable(candidate,colliders,{minX:121,maxX:143,minZ:-51,maxZ:-38},.9)&&used.every(q=>Math.hypot(q.x-candidate.x,q.z-candidate.z)>1.25)){p=candidate;break;}
   }
   used.push(p);m.position.set(p.x,.07,p.z);m.rotation.y=rng()*Math.PI*2;m.userData.item=i;m.userData.kind=items[i];m.name='green-litter-'+i;
  });
 }
 return {litter,configure};
}

export function greenBinLabel(index:number){
 const b=GREEN_BINS[index],c=document.createElement('canvas');c.width=512;c.height=384;const ctx=c.getContext('2d')!;
 ctx.fillStyle=b.color;ctx.fillRect(0,0,512,384);ctx.strokeStyle='#fff3d7';ctx.lineWidth=10;ctx.strokeRect(10,10,492,364);
 ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 118px "Segoe UI Symbol",sans-serif';ctx.fillText(b.symbol,256,92);
 ctx.font='bold 72px "Segoe UI",sans-serif';ctx.fillText(b.label,256,215);ctx.font='48px "Yu Gothic","Meiryo",sans-serif';ctx.fillText(b.jp,256,305);
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
 return new T.Mesh(new T.PlaneGeometry(1.4,1.05),new T.MeshBasicMaterial({map:texture,toneMapped:false}));
}
