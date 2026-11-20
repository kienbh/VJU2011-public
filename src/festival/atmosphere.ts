import * as THREE from 'three';
import {GARDEN_PLOTS,PLANT_GARDEN} from './festivalLayout';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Collider } from '../types';

/** Small, local festival assets. People are decorative NPCs, never online visitors.
 * All placements stay beside existing furniture and outside the clear walking routes. */
export function createFestivalAtmosphere() {
  const group=new THREE.Group();group.name='festival-atmosphere';
  const colliders:Collider[]=[];
  const rounded=new RoundedBoxGeometry(1,1,1,2,.08);
  const sphere=new THREE.SphereGeometry(1,16,12);
  const limb=new THREE.CapsuleGeometry(1,1,5,12);
  const shirt=new THREE.LatheGeometry([new THREE.Vector2(0,.73),new THREE.Vector2(.24,.73),new THREE.Vector2(.27,.85),new THREE.Vector2(.28,1.16),new THREE.Vector2(.31,1.31),new THREE.Vector2(.23,1.43),new THREE.Vector2(.12,1.45),new THREE.Vector2(0,1.45)],18);
  const dark=new THREE.MeshStandardMaterial({color:0x293340,roughness:.8});
  const cream=new THREE.MeshStandardMaterial({color:0xf0dfbf,roughness:.9});
  const hair=new THREE.MeshStandardMaterial({color:0x24231f,roughness:1});
  const gold=new THREE.MeshStandardMaterial({color:0x9c7949,roughness:.5,metalness:.55});
  const red=new THREE.MeshStandardMaterial({color:0xb5574b,roughness:.86});
  const warm=new THREE.MeshBasicMaterial({color:0xffdfa8,toneMapped:false});
  const merged=new Map<THREE.Material,THREE.BufferGeometry[]>();
  function part(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number) {
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
  }
  // Soft silhouettes, clothed bodies, asymmetrical poses and a card/bag as context.
  const visitors=[
    {x:72,z:46,angle:.7,color:0x637d88,skin:0xcb9c7c,scale:1.04,card:true},
    {x:60,z:31,angle:Math.PI,color:0xa05c4e,skin:0xdfb08b,scale:.98,card:false},
    {x:32,z:30.5,angle:Math.PI,color:0x60745a,skin:0xbc8a66,scale:1.08,card:true},
    {x:57,z:15,angle:-1.1,color:0xd5b985,skin:0xd0a080,scale:1,card:true},
    {x:18,z:-10,angle:1.2,color:0x576985,skin:0xe0b595,scale:1.03,card:false},
    {x:-27,z:-12,angle:-.3,color:0xae7467,skin:0xc79977,scale:1.06,card:true},
  ];
  visitors.forEach((spec,index)=>{
    const person=new THREE.Group();person.name=`decorative-npc-${index+1}`;person.userData={role:'decorative-npc',onlinePlayer:false};
    person.position.set(spec.x,.25,spec.z);person.rotation.y=spec.angle;person.scale.setScalar(spec.scale);group.add(person);
    const cloth=new THREE.MeshStandardMaterial({color:spec.color,roughness:.95});
    const skin=new THREE.MeshStandardMaterial({color:spec.skin,roughness:.9});
    for(const x of [-.16,.16]) {
      part(person,sphere,dark,x,.13,.07,.14,.105,.24);
      part(person,limb,dark,x,.51,0,.105,.225,.12);
    }
    part(person,shirt,cloth,0,0,0,1,1,.69);
    for(const x of [-.28,.28])part(person,sphere,cloth,x,1.3,0,.17,.15,.16);
    part(person,rounded,cream,0,1.43,.02,.23,.08,.28);
    part(person,sphere,skin,0,1.68,.02,.235,.28,.23);
    const cap=part(person,sphere,hair,0,1.82,-.035,.245,.17,.23);cap.rotation.x=-.2;
    if(index%2)part(person,sphere,hair,.02,1.65,-.2,.2,.27,.12);
    for(const x of [-.085,.085])part(person,sphere,dark,x,1.7,.235,.018,.023,.009);
    part(person,sphere,skin,0,1.63,.25,.038,.045,.037);
    const left=part(person,limb,cloth,-.37,1.1,.04,.095,.19,.11);left.rotation.z=-.18;
    const right=part(person,limb,cloth,.37,1.13,.09,.095,.18,.11);right.rotation.x=-.48;
    part(person,sphere,skin,-.45,.81,.06,.095,.12,.09);
    part(person,sphere,skin,.4,.91,.22,.095,.12,.09);
    if(spec.card){const card=part(person,rounded,cream,.32,1.02,.33,.38,.28,.025);card.rotation.z=.15;part(person,rounded,red,.32,1.025,.347,.12,.12,.008);}
    else{part(person,rounded,red,-.4,.8,-.02,.32,.39,.17);part(person,rounded,gold,-.38,1.1,-.02,.035,.35,.035);}
    const r=.6*spec.scale;colliders.push({minX:spec.x-r,maxX:spec.x+r,minZ:spec.z-r,maxZ:spec.z+r,label:'Khách lễ hội (NPC)'});
  });

  // Independent edge posts: every cable terminates at a physical attachment.
  // Bases stay behind the seating, away from the gate-to-board walking axis.
  const anchors=[20,44,68].map(x=>new THREE.Vector3(x,5.8,34));
  for(const p of anchors){
    part(group,rounded,dark,p.x,3.05,p.z,.14,5.5,.14);
    part(group,rounded,gold,p.x,.4,p.z,.55,.3,.55);
    part(group,sphere,gold,p.x,5.8,p.z,.14,.14,.14);
    colliders.push({minX:p.x-.3,maxX:p.x+.3,minZ:p.z-.3,maxZ:p.z+.3,label:'Cột dây đèn mép sân'});
  }
  group.userData.lightAnchors=anchors.map(p=>p.toArray());
  function stringLights(a:THREE.Vector3,b:THREE.Vector3) {
    const points=Array.from({length:41},(_,i)=>{const t=i/40;return a.clone().lerp(b,t).add(new THREE.Vector3(0,-Math.sin(t*Math.PI)*.65,0));});
    const cable=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),40,.018,4,false),dark);group.add(cable);
    for(let i=1;i<20;i++){
      const p=points[i*2];part(group,rounded,gold,p.x,p.y-.09,p.z,.045,.18,.045);
      part(group,sphere,warm,p.x,p.y-.23,p.z,.09,.12,.09);
    }
  }
  stringLights(anchors[0],anchors[1]);
  stringLights(anchors[1],anchors[2]);

  // Merge static parts by material: six visitors and both light strings cost a few
  // draw calls instead of one draw call per eye, finger, bulb or sleeve.
  group.updateMatrixWorld(true);
  group.traverse(o=>{if(o instanceof THREE.Mesh){const mat=o.material as THREE.Material;const list=merged.get(mat)??[];list.push(o.geometry.clone().applyMatrix4(o.matrixWorld));merged.set(mat,list);}});
  group.clear();
  for(const [material,geometries] of merged){const geometry=mergeGeometries(geometries.map(g=>{const copy=g.index?g.toNonIndexed():g;copy.deleteAttribute('uv');copy.deleteAttribute('uv1');return copy;}));if(geometry){const mesh=new THREE.Mesh(geometry,material);mesh.name='festival-dressed-props';mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);}for(const g of geometries)g.dispose();}
  group.userData.decorativeNPCs=visitors.map(v=>({x:v.x,z:v.z}));

  // Contact shadows, not additional dynamic lights/shadow maps per person.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;
  const radial=ctx.createRadialGradient(32,32,0,32,32,32);radial.addColorStop(0,'rgba(10,15,22,.55)');radial.addColorStop(1,'rgba(10,15,22,0)');ctx.fillStyle=radial;ctx.fillRect(0,0,64,64);
  const shadow=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false});
  for(const {x,z} of visitors){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.7,1.25),shadow);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.28,z);group.add(mesh);}

  // Near-camera grass tufts are geometry, not a flat green carpet; scatter only
  // within existing planting strips. Leave the route and entire centre clear.
  const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-.014,0,0,.014,0,0,-.002,.09,.008,.022,.09,.008,.02,.18,.022,.034,.18,.022,.059,.26,.048],3));blade.setIndex([0,1,2,1,3,2,2,3,4,3,5,4,4,5,6]);blade.computeVertexNormals();
  const grass=new THREE.InstancedMesh(blade,new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide}),18000);
  const stamp=new THREE.Object3D();let seed=2011;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<18000;i++){
    const bed=i<12500;const strip=[-60,-36,-12,12,36][i%5];const x=bed?-69+random()*26:strip-8+random()*(strip===36?7.5:16);const z=bed?13+random()*20:40+random()*3;
    stamp.position.set(x,.32,z);stamp.rotation.set(0,random()*Math.PI*2,0);const h=.5+random()*.65;stamp.scale.set(.8+random(),h,.8+random());
    // Keep the planting garden's gravel walks and soil beds free of blades.
    if(bed&&(Math.abs(x-PLANT_GARDEN.x)<.95||[18.4,23,27.6].some(walk=>Math.abs(z-walk)<.85)||GARDEN_PLOTS.some(([px,pz])=>Math.hypot(x-px,z-pz)<1.2)))stamp.scale.setScalar(0);
    stamp.updateMatrix();grass.setMatrixAt(i,stamp.matrix);grass.setColorAt(i,new THREE.Color().setHSL(.21+random()*.06,.22+random()*.25,.2+random()*.12));
  }
  grass.name='near-route-grass-blades';group.add(grass);
  return {group,colliders};
}
