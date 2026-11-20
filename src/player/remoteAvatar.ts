import {roundedRectPath} from '../browserCompat';
import * as T from 'three';
import {tName} from '../i18n/index.ts';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {Appearance} from './appearance';
import {VISITOR_STYLES} from './visitorAvatar';

/** Original low-detail visitor: eight draw calls, no realtime shadows or downloaded asset. */
export function createRemoteAvatar(name:string,a:Appearance){
 const root=new T.Group();root.name='campus-remote-player';
 const style=VISITOR_STYLES[a.palette],coat=a.outfit==='vju'?'#f0eee3':style.coat;
 const material=new T.MeshLambertMaterial({vertexColors:true});
 type Part=[number,number,number,number,number,number,string];
 function mesh(parts:Part[],parent:T.Object3D){
  const geometries=parts.map(([w,h,d,x,y,z,color])=>{
   const g=new RoundedBoxGeometry(w,h,d,1,Math.min(.07,w/3,h/3,d/3));g.translate(x,y,z);
   const c=new T.Color(color),colors=new Float32Array(g.getAttribute('position').count*3);
   for(let i=0;i<colors.length;i+=3)c.toArray(colors,i);g.setAttribute('color',new T.BufferAttribute(colors,3));return g;
  });
  const geometry=mergeGeometries(geometries)!;geometries.forEach(g=>g.dispose());const m=new T.Mesh(geometry,material);parent.add(m);return m;
 }
 const body=new T.Group();root.add(body);
 const parts:Part[]=[
  [.56,.61,.39,0,1.24,0,coat],[.43,.48,.13,0,1.24,.25,style.bag],
  [.5,.46,.46,0,1.8,0,style.skin],[.53,.2,.49,0,2.03,.015,style.hair],
  [.035,.045,.025,-.1,1.84,-.24,'#252e35'],[.035,.045,.025,.1,1.84,-.24,'#252e35'],
 ];
 if(a.hair==='bob')parts.push([.54,.39,.2,0,1.83,.19,style.hair]);
 if(a.hair==='ponytail')parts.push([.2,.48,.2,0,1.78,.34,style.hair]);
 if(a.body==='female')parts[0][0]=.5;
 mesh(parts,body);
 const arms:T.Group[]=[],legs:T.Group[]=[],knees:T.Group[]=[];
 for(const side of [-1,1]){
  const arm=new T.Group();arm.position.set(side*.37,1.44,0);body.add(arm);arms.push(arm);
  mesh([[.18,.36,.22,0,-.18,0,coat],[.15,.19,.18,0,-.43,0,style.skin]],arm);
  const leg=new T.Group();leg.position.set(side*.17,.88,0);body.add(leg);legs.push(leg);
  mesh([[.23,.38,.25,0,-.18,0,'#344550']],leg);
  const knee=new T.Group();knee.position.y=-.38;leg.add(knee);knees.push(knee);
  mesh([[.23,.32,.25,0,-.15,0,'#344550'],[.26,.15,.4,0,-.35,-.07,'#efe6d6']],knee);
 }
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#1c3434df';ctx.beginPath();roundedRectPath(ctx,1,5,254,52,20);ctx.fill();ctx.fillStyle='#fff5df';ctx.font='600 26px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tName(name).slice(0,24),128,32,240);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const tagMaterial=new T.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}),tag=new T.Sprite(tagMaterial);tag.position.y=2.42;tag.scale.set(2.1,.525,1);root.add(tag);
 let phase=0;
 return {root,update(position:T.Vector3,heading:number,distance:number,dt:number,seated:boolean,groundSeat:boolean,reduced:boolean){
  root.position.set(position.x,position.y-1.7,position.z);root.rotation.y=heading;phase+=distance*4.5;
  const swing=reduced||seated||distance<.0001?0:Math.sin(phase)*.58;
  for(let i=0;i<2;i++){legs[i].rotation.x=groundSeat?1.4:seated?Math.PI/2:(i===0?swing:-swing);legs[i].rotation.z=groundSeat?(i===0?.65:-.65):0;knees[i].rotation.x=groundSeat?-.3:seated?-Math.PI/2:0;arms[i].rotation.x=seated?.35:(i===0?-swing:swing)*.7;}
  body.position.y=!seated&&!reduced&&distance>.0001?Math.abs(Math.sin(phase))*.04:0;
  root.userData.seated=seated;void dt;
 },dispose(){root.traverse(o=>{if(o instanceof T.Mesh)o.geometry.dispose();});material.dispose();tagMaterial.dispose();texture.dispose();root.removeFromParent();}};
}
