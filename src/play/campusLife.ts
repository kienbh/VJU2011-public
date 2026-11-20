import {roundedRectPath} from '../browserCompat';
import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRemoteAvatar} from '../player/remoteAvatar';
import {DEFAULT_APPEARANCE} from '../player/appearance';
import {isWalkable,type WalkBounds} from '../player/collision';
import type {Collider} from '../types';
import {phoneScreen} from '../mobile';

export type PetKind='dog'|'cat';
type Point={x:number;z:number};
type Walker={position:T.Vector3;route:Point[];target:number;wait:number;heading:number;distance:number};
/** Ambient, local characters, deliberately excluded from online-player presence. */
/** Ambient, local characters, deliberately excluded from online-player presence. */
export function createCampusLife(colliders:Collider[],bounds:WalkBounds){
 const root=new T.Group();root.name='campus-local-life';
 const sphere=new T.SphereGeometry(1,10,7),cone=new T.ConeGeometry(1,1,5);
 const material=new T.MeshLambertMaterial({vertexColors:true});
 let clock=0,lastCall=-5;
 function merged(parts:Array<[T.BufferGeometry,number,number,number,number,number,number,number]>,parent:T.Object3D){
  const gs=parts.map(([shape,x,y,z,sx,sy,sz,color])=>{const g=shape.clone().toNonIndexed();g.scale(sx,sy,sz);g.translate(x,y,z);g.deleteAttribute('uv');const c=new T.Color(color),a=new Float32Array(g.getAttribute('position').count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);g.setAttribute('color',new T.BufferAttribute(a,3));return g;});
  const geometry=mergeGeometries(gs)!;gs.forEach(g=>g.dispose());const m=new T.Mesh(geometry,material);parent.add(m);return m;
 }
 function route(points:number[][]):Walker{
  // Validate entire segments, not only destinations: no crossing walls, flower beds or water.
  const safe=(a:Point,b:Point)=>{const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35));for(let i=0;i<=n;i++)if(!isWalkable({x:a.x+(b.x-a.x)*i/n,z:a.z+(b.z-a.z)*i/n},colliders,bounds,.65))return false;return true;};
  const candidates=points.map(([x,z])=>({x,z})).filter(p=>safe(p,p)),start=candidates[0];
  const valid=start?candidates.filter(p=>safe(start,p)):[];
  // Return to the safe centre between each destination, never cut a corner.
  const path=valid.flatMap(p=>[start,p]);
  return {position:new T.Vector3(start?.x??0,1.96,start?.z??0),route:path,target:1,wait:0,heading:0,distance:0};
 }
 function move(w:Walker,dt:number,speed:number,at:T.Vector3,reduced:boolean){
  w.distance=0;if(reduced||w.route.length<4)return;
  w.wait-=dt;if(w.wait>0||Math.hypot(w.position.x-at.x,w.position.z-at.z)<1.6)return;
  const goal=w.route[w.target%w.route.length],dx=goal.x-w.position.x,dz=goal.z-w.position.z,d=Math.hypot(dx,dz);
  if(d<.07){w.target=(w.target+1)%w.route.length;w.wait=1.1+(w.target%3)*.7;return;}
  const step=Math.min(d,dt*speed);w.position.x+=dx/d*step;w.position.z+=dz/d*step;w.distance=step;w.heading=Math.atan2(-dx,-dz);
 }
 const npcRoutes=[[[48,23],[54,23],[48,19]], [[-24,3],[-16,3],[-24,9]], [[80,18],[80,27],[76,18]]];
 const npcs=npcRoutes.map((points,i)=>{
  // Language per walker: Japanese, Vietnamese, Japanese. The label always says NPC.
  const lang=i===1?'vi' as const:'ja' as const,walk=route(points),avatar=createRemoteAvatar(lang==='ja'?tr('Khách Nhật · NPC'):tr('Khách Việt · NPC'),{...DEFAULT_APPEARANCE,palette:i as 0|1|2});
  avatar.root.name='local-walking-npc-'+i;avatar.root.userData={role:'decorative-npc',onlinePlayer:false};root.add(avatar.root);return {walk,avatar,lang};
 });
 const specs:Array<{kind:PetKind;color:number;patch:number;points:number[][]}>=[
  {kind:'dog',color:0xc69b62,patch:0xf3e4c9,points:[[42,23],[47,23],[42,28]]},
  {kind:'cat',color:0xda884c,patch:0xffe7c6,points:[[-32,6],[-27,6],[-32,11]]},
  {kind:'dog',color:0xe5d8bd,patch:0x554338,points:[[65,26],[71,26],[65,30]]},
  {kind:'cat',color:0x737e88,patch:0xf3eee4,points:[[48,40.5],[53,40.5],[48,42]]},
  {kind:'cat',color:0xeee2c9,patch:0x403e3b,points:[[-38,40.5],[-32,40.5],[-38,42]]},
  {kind:'dog',color:0x774e37,patch:0xd6bb91,points:[[83,9],[83,15],[79,9]]},
 ];
 const pets=specs.map((spec,i)=>{
  const walk=route(spec.points),body=new T.Group(),cat=spec.kind==='cat';body.name='campus-pet-'+i;body.userData={petId:i,kind:spec.kind,onlinePlayer:false};root.add(body);
  const c=spec.color,p=spec.patch,dark=0x282922;
  merged([[sphere,0,.52,0,.24,.26,.48,c],[sphere,0,.42,-.17,.21,.18,.27,p],[sphere,.18,.62,.17,.09,.17,.22,p]],body);
  const head=new T.Group();head.position.set(0,.78,-.43);body.add(head);
  merged([[sphere,0,0,0,.25,.23,.24,c],[sphere,0,-.09,-.2,cat?.15:.18,.1,cat?.08:.18,p],[sphere,0,-.05,cat?-.27:-.36,.05,.035,.035,dark],
   [sphere,-.12,.05,-.21,.045,.055,.025,cat?0x86a65a:dark],[sphere,.12,.05,-.21,.045,.055,.025,cat?0x86a65a:dark],
   [cat?cone:sphere,-.19,cat?.23:-.01,.015,cat?.11:.09,cat?.24:.24,.09,c],[cat?cone:sphere,.19,cat?.23:-.01,.015,cat?.11:.09,cat?.24:.24,.09,c]],head);
  const legs:T.Group[]=[];
  for(const x of [-.16,.16])for(const z of [-.29,.29]){const leg=new T.Group();leg.position.set(x,.43,z);body.add(leg);merged([[sphere,0,-.14,0,.075,.21,.075,c],[sphere,0,-.31,-.025,.09,.06,.12,p]],leg);legs.push(leg);}
  const tail=new T.Group();tail.position.set(0,.6,.4);tail.rotation.x=.5;body.add(tail);merged([[sphere,0,.19,.08,.065,cat?.34:.23,.065,c]],tail);
  if(cat)body.scale.setScalar(.76);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=80;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff5df';ctx.beginPath();roundedRectPath(ctx,2,2,252,76,24);ctx.fill();ctx.fillStyle='#29453f';ctx.font='bold 31px "Segoe UI",sans-serif';ctx.textAlign='center';ctx.fillText(cat?tr('Meo meo!'):tr('Gâu gâu!'),128,51);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;const label=new T.Sprite(new T.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));label.position.y=1.7;label.scale.set(1.65,.52,1);body.add(label);label.visible=false;
  return {body,head,legs,tail,label,walk,kind:spec.kind,until:0,phase:0};
 });
 function interact(id:number){const pet=pets[id];if(!pet?.body.visible||clock-lastCall<1.2)return null;lastCall=clock;pet.until=clock+2;pet.walk.wait=2;return pet.kind;}
 /** Greeted walker pauses and turns to the player; it resumes its route afterwards. */
 /** Greeted walker pauses and turns to the player; it resumes its route afterwards. */
 function greetNpc(i:number,at:T.Vector3){const n=npcs[i];if(!n)return;n.walk.wait=Math.max(n.walk.wait,4.5);n.walk.heading=Math.atan2(-(at.x-n.walk.position.x),-(at.z-n.walk.position.z));}
 return {root,interact,greetNpc,
  npcTargets:()=>npcs.map((n,i)=>({index:i,lang:n.lang,position:n.walk.position,visible:n.avatar.root.visible})),
  hit(ray:T.Raycaster,at:T.Vector3){const hits=ray.intersectObjects(pets.filter(p=>p.body.visible&&p.body.position.distanceTo(at)<12).map(p=>p.body),true);const hit=hits[0];if(!hit)return null;let node:T.Object3D|null=hit.object;while(node&&node.userData.petId===undefined)node=node.parent;return node?.userData.petId??null;},
  nearest(at:T.Vector3){let result:number|null=null,d=2.8;pets.forEach((p,i)=>{const n=Math.hypot(at.x-p.walk.position.x,at.z-p.walk.position.z);if(p.body.visible&&n<d){d=n;result=i;}});return result;},
  update(dt:number,at:T.Vector3,reduced:boolean,active:boolean){
   dt=Math.min(.05,Math.max(0,dt));if(!document.hidden)clock+=dt;
   npcs.forEach(({walk,avatar},i)=>{avatar.root.visible=walk.route.length>0&&(!phoneScreen.matches||i<2)&&walk.position.distanceTo(at)<70;
    if(!avatar.root.visible)return;move(walk,active&&!document.hidden?dt:0,.7,at,reduced);avatar.update(walk.position,walk.heading,walk.distance,dt,false,false,reduced);});
   pets.forEach((p,i)=>{p.body.visible=p.walk.route.length>0&&(!phoneScreen.matches||i<4)&&p.walk.position.distanceTo(at)<55;if(!p.body.visible)return;
    move(p.walk,active&&!document.hidden?dt:0,p.kind==='cat'?.45:.65,at,reduced);p.body.position.copy(p.walk.position);p.body.position.y=.27;p.body.rotation.y=p.walk.heading;p.phase+=p.walk.distance*8;
    p.legs.forEach((leg,j)=>leg.rotation.x=p.walk.distance&&!reduced?Math.sin(p.phase+(j===0||j===3?0:Math.PI))*.4:0);
    p.label.visible=clock<p.until;p.tail.rotation.z=reduced?0:Math.sin(clock*(p.label.visible?12:2)+i)*.2;p.head.rotation.z=reduced?0:Math.sin(clock*1.3+i)*.05;
   });
  },state:()=>({npcs:npcs.map(p=>({position:p.walk.position.toArray(),route:p.walk.route,visible:p.avatar.root.visible})),pets:pets.map((p,id)=>({id,kind:p.kind,position:p.body.position.toArray(),route:p.walk.route,visible:p.body.visible,speaking:p.label.visible}))})};
}
