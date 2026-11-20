import {roundedRectPath} from '../browserCompat';
import {createBouquetVisual,disposeBouquetVisual} from '../festival/bouquetVisual';
import type {FlowerKind} from '../greetings/flowers';
import * as THREE from 'three';
import {tName} from '../i18n/index.ts';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {DEFAULT_APPEARANCE,type Appearance} from './appearance';

export const VISITOR_STYLES=[
  {name:'Áo xanh · ba lô kem',coat:'#417b78',bag:'#d8b789',skin:'#dba880',hair:'#302c2c'},
  {name:'Áo đỏ · ba lô xanh',coat:'#a64a56',bag:'#729ba3',skin:'#b97d58',hair:'#292528'},
  {name:'Áo vàng · ba lô nâu',coat:'#cfaa58',bag:'#866958',skin:'#f1c5a0',hair:'#694838'},
];
/** Original procedural character asset. No external model, request or licence dependency. */
export function createVisitorAvatar(){
  const root=new THREE.Group();root.name='visitor-avatar';
  const body=new THREE.Group();root.add(body);
  const mat=(color:string)=>new THREE.MeshStandardMaterial({color,roughness:.8});
  const coat=mat(VISITOR_STYLES[0].coat),bag=mat(VISITOR_STYLES[0].bag),skin=mat(VISITOR_STYLES[0].skin),hair=mat(VISITOR_STYLES[0].hair);
  const trousers=mat('#344550'),shoe=mat('#efe6d6'),sole=mat('#78675b'),dark=mat('#252e35');
  function rounded(parent:THREE.Object3D,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material,r=.06){
    const mesh=new THREE.Mesh(new RoundedBoxGeometry(w,h,d,2,r),m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  function ball(parent:THREE.Object3D,r:number,x:number,y:number,z:number,m:THREE.Material,sx=1,sy=1,sz=1){const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,16,12),m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);return mesh;}
  const torso=rounded(body,.65,.7,.38,0,1.16,0,coat,.12);
  rounded(body,.46,.53,.22,0,1.2,.29,bag,.09);
  rounded(body,.34,.16,.08,0,1.08,.43,coat,.03);
  for(const side of [-1,1])rounded(body,.065,.65,.05,side*.2,1.18,-.21,bag,.02);
  ball(body,.11,0,1.55,0,skin);
  ball(body,.29,0,1.85,-.025,skin,.93,1.08,.9);
  ball(body,.3,0,1.95,.015,hair,1, .75,1);
  rounded(body,.5,.13,.16,0,1.99,-.23,hair,.05);
  const longHair=new THREE.Group();body.add(longHair);
  rounded(longHair,.55,.4,.18,0,1.69,.17,hair,.07);
  for(const side of [-1,1])rounded(longHair,.1,.33,.28,side*.25,1.73,-.015,hair,.04);
  const ponytail=new THREE.Group();body.add(ponytail);
  ball(ponytail,.16,0,1.85,.32,hair,.8,1.55,1);
  ball(ponytail,.12,0,1.56,.38,hair,.8,1.5,.8);
  ball(ponytail,.055,0,1.89,.31,bag,1.6,.6,1.1);
  const collar=new THREE.Group();body.add(collar);
  for(const side of [-1,1]){const flap=rounded(collar,.16,.17,.055,side*.09,1.44,-.214,bag,.025);flap.rotation.z=side*.5;}
  const uniformBadge=new THREE.Group();body.add(uniformBadge);
  const label=document.createElement('canvas');label.width=128;label.height=64;const lctx=label.getContext('2d')!;
  lctx.clearRect(0,0,128,64);lctx.fillStyle='#b83043';lctx.font='bold 38px Arial';lctx.textAlign='center';lctx.fillText('VJU',64,43);
  const labelTexture=new THREE.CanvasTexture(label);labelTexture.colorSpace=THREE.SRGBColorSpace;
  const badge=new THREE.Mesh(new THREE.PlaneGeometry(.19,.095),new THREE.MeshBasicMaterial({map:labelTexture,transparent:true,side:THREE.DoubleSide}));badge.position.set(0,1.28,-.207);badge.rotation.y=Math.PI;uniformBadge.add(badge);
  for(const side of [-1,1]){
    ball(body,.058,side*.275,1.83,-.02,skin);
    ball(body,.026,side*.095,1.85,-.274,dark,1,1.3,.55);
  }
  rounded(body,.09,.018,.02,0,1.72,-.273,hair,.008);
  const arms:THREE.Group[]=[],legs:THREE.Group[]=[],knees:THREE.Group[]=[],sleeves:THREE.Mesh[]=[];
  for(const side of [-1,1]){
    const arm=new THREE.Group();arm.position.set(side*.39,1.44,0);body.add(arm);arms.push(arm);
    rounded(arm,.13,.4,.15,0,-.26,0,skin,.05);
    sleeves.push(rounded(arm,.2,.43,.23,0,-.18,0,coat,.08));ball(arm,.105,0,-.49,0,skin,1,1.2,1);
    const leg=new THREE.Group();leg.position.set(side*.17,.88,0);body.add(leg);legs.push(leg);
    rounded(leg,.23,.38,.25,0,-.18,0,trousers,.065);
    const knee=new THREE.Group();knee.position.y=-.38;leg.add(knee);knees.push(knee);
    rounded(knee,.23,.32,.25,0,-.15,0,trousers,.065);
    rounded(knee,.26,.15,.4,0,-.35,-.07,shoe,.055);rounded(knee,.27,.045,.41,0,-.42,-.07,sole,.016);
  }
  // Contact shadow is a single translucent disc, not an extra shadow-casting light.
  const c=document.createElement('canvas');c.width=c.height=64;const ctx=c.getContext('2d')!;
  const grad=ctx.createRadialGradient(32,32,4,32,32,30);grad.addColorStop(0,'#0007');grad.addColorStop(1,'#0000');ctx.fillStyle=grad;ctx.fillRect(0,0,64,64);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1.8),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.035;root.add(shadow);
  let phase=0,facing=0,kickTime=0,kickHeading=0;
  // Name tag above the head: one small sprite, redrawn only when the name changes.
  const tagCanvas=document.createElement('canvas');tagCanvas.width=512;tagCanvas.height=96;
  const tagMap=new THREE.CanvasTexture(tagCanvas);tagMap.colorSpace=THREE.SRGBColorSpace;
  const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tagMap,transparent:true,depthWrite:false,fog:false,toneMapped:false}));
  tag.name='visitor-name-tag';tag.position.y=2.42;tag.visible=false;root.add(tag);
  function setName(value:string){
    const text=value.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,24);
    tag.visible=!!text;root.userData.name=text;if(!text)return;
    const ctx=tagCanvas.getContext('2d')!;ctx.clearRect(0,0,512,96);ctx.font='600 46px "Segoe UI", Arial, sans-serif';
    const width=Math.min(500,ctx.measureText(tName(text)).width+56),left=(512-width)/2;
    ctx.fillStyle='rgba(28,44,50,.82)';ctx.beginPath();roundedRectPath(ctx,left,10,width,76,38);ctx.fill();
    ctx.strokeStyle='rgba(230,197,139,.9)';ctx.lineWidth=3;ctx.stroke();
    ctx.fillStyle='#fff6e2';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tName(text),256,50,480);
    tagMap.needsUpdate=true;tag.scale.set(2.2,2.2*96/512,1);
  }
  function setAppearance(config:Appearance){
    root.userData.appearance={...config};
    const style=VISITOR_STYLES[config.palette]||VISITOR_STYLES[0];coat.color.set(config.outfit==='vju'?'#f0eee3':style.coat);bag.color.set(config.outfit==='vju'?'#397a76':style.bag);skin.color.set(style.skin);hair.color.set(style.hair);
    torso.scale.x=config.body==='female'?.88:1;torso.scale.z=config.body==='female'?.94:1;
    for(let i=0;i<arms.length;i++){arms[i].position.x=(i===0?-1:1)*(config.body==='female'?.35:.39);sleeves[i].scale.y=config.outfit==='casual'?1:.52;sleeves[i].position.y=config.outfit==='casual'?-.18:-.08;}
    longHair.visible=config.hair==='bob';ponytail.visible=config.hair==='ponytail';collar.visible=config.outfit!=='casual';uniformBadge.visible=config.outfit==='vju';
    trousers.color.set(config.outfit==='vju'?'#263e50':'#344550');
  }
  const grip=new THREE.Group();grip.position.set(0,-.49,0);grip.rotation.x=-1.05;arms[1].add(grip);
  let heldKey='',held:THREE.Group|undefined;
  function setBouquet(flowers:FlowerKind[]){const key=flowers.join(',');if(key===heldKey)return;heldKey=key;if(held){grip.remove(held);disposeBouquetVisual(held);}held=createBouquetVisual(flowers);held.scale.setScalar(1.15);grip.add(held);root.userData.heldFlowers=[...flowers];}
  setAppearance(DEFAULT_APPEARANCE);
  return {root,setAppearance,setBouquet,setName,kick(heading:number){kickTime=.55;kickHeading=heading;},setStyle(index:number){setAppearance({...DEFAULT_APPEARANCE,palette:index});},
    update(position:THREE.Vector3,delta:THREE.Vector3,heading:number,dt:number,reduced:boolean,seated=false,groundSeat=false){
      root.position.set(position.x,position.y-1.7,position.z);
      const moving=delta.lengthSq()>.000001;
      kickTime=Math.max(0,kickTime-dt);
      const target=kickTime>0?kickHeading:moving?Math.atan2(-delta.x,-delta.z):heading;
      facing+=Math.atan2(Math.sin(target-facing),Math.cos(target-facing))*Math.min(1,dt*15);root.rotation.y=facing;
      phase+=delta.length()*4.5;
      const swing=moving?Math.sin(phase)*.58:0;
      legs[0].rotation.x=seated?Math.PI/2:swing;legs[1].rotation.x=seated?Math.PI/2:-swing;
      if(kickTime>0&&!seated&&!reduced)legs[1].rotation.x=Math.sin((1-kickTime/.55)*Math.PI)*1.1;
      for(const [i,leg] of legs.entries()){leg.rotation.z=groundSeat?(i===0?.65:-.65):0;if(groundSeat)leg.rotation.x=1.4;}
      for(const knee of knees)knee.rotation.x=groundSeat?-.3:seated?-Math.PI/2:0;
      arms[0].rotation.x=seated?.35:-swing*.7;arms[1].rotation.x=heldKey?1.05:seated?.35:swing*.7;
      root.userData.seated=seated;
      body.position.y=moving&&!reduced?Math.abs(Math.sin(phase))*.045:0;
    }};
}
