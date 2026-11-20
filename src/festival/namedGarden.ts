import {tr,tName} from '../i18n/index.ts';
import * as THREE from 'three';
import type {Collider} from '../types';
import {GARDEN_PLOTS,PLANT_GARDEN} from './festivalLayout';
import {createBouquetVisual,disposeBouquetVisual} from './bouquetVisual';
import {createGardenSign} from './gardenSign';
import type {FlowerLoopState} from './flowerLoop';

const GROUND=.3,SIGN_Y=1.78,POST_Z=1.2;
/** Readable from both sides: a second face turned around, instead of a mirrored back. */
/** Readable from both sides: a second face turned around, instead of a mirrored back. */
function twoSided(sign:THREE.Mesh){
  (sign.material as THREE.Material).side=THREE.FrontSide;
  const back=new THREE.Mesh(sign.geometry,sign.material);back.rotation.y=Math.PI;sign.add(back);return sign;
}

/** The corner lawn as a planting garden: beds on a grid with walkable gravel between rows.
 * Each bed takes one bouquet and a name sign; tapping it opens the student's wish.
 * Decorative proposal on the existing lawn footprint; no surveyed landscaping. */
/** The corner lawn as a planting garden: beds on a grid with walkable gravel between rows.
 * Each bed takes one bouquet and a name sign; tapping it opens the student's wish.
 * Decorative proposal on the existing lawn footprint; no surveyed landscaping. */
export function createNamedGarden(){
  const group=new THREE.Group();group.name='named-local-bouquets';
  const content=new THREE.Group();group.add(content);
  const stamp=new THREE.Object3D(),count=GARDEN_PLOTS.length,{x:gx,z:gz,w,d}=PLANT_GARDEN;
  const colliders:Collider[]=[];
  const standard=(color:number,roughness=.95)=>new THREE.MeshStandardMaterial({color,roughness});
  const instanced=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,n:number)=>{const m=new THREE.InstancedMesh(geometry,material,n);m.name=name;m.receiveShadow=true;group.add(m);return m;};
  const place=(m:THREE.InstancedMesh,i:number,x:number,y:number,z:number,sx=1,sy=1,sz=1,rx=0)=>{stamp.position.set(x,y,z);stamp.rotation.set(rx,0,0);stamp.scale.set(sx,sy,sz);stamp.updateMatrix();m.setMatrixAt(i,stamp.matrix);};

  // Gravel walks: three between the rows and one down the middle, meeting both entrances.
  const walks=instanced('plant-garden-gravel-walks',new THREE.BoxGeometry(1,1,1),standard(0xd9d1bb),4);
  [18.4,23,27.6].forEach((z,i)=>place(walks,i,gx,GROUND+.02,z,w-2.4,.05,1.1));
  place(walks,3,gx,GROUND+.025,gz,1.3,.05,d-2.4);

  const soil=instanced('plot-soil-beds',new THREE.CylinderGeometry(.95,1.05,.16,24),standard(0x5b4030,1),count);
  const ring=instanced('plot-stone-rings',new THREE.TorusGeometry(1,.08,6,24),standard(0xcbbf9f,.9),count);
  const targets:THREE.Object3D[]=[],hitMaterial=new THREE.MeshBasicMaterial({visible:false});
  GARDEN_PLOTS.forEach(([x,z],i)=>{
    place(soil,i,x,GROUND+.08,z);place(ring,i,x,GROUND+.14,z,1,1,1,Math.PI/2);
    const hit=new THREE.Mesh(new THREE.BoxGeometry(2.4,2.6,2.9),hitMaterial);hit.position.set(x,1.4,z+.35);hit.userData.plot=i;group.add(hit);targets.push(hit);
    colliders.push({minX:x-.75,maxX:x+.75,minZ:z-.75,maxZ:z+.75,maxY:.9,label:tr('Ô cắm hoa')});
  });

  // Low flowering border on the lawn edge, open at the east and south entrances.
  let seed=20261120;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const border:{x:number;z:number}[]=[];
  for(let t=-w/2+.9;t<=w/2-.9;t+=.72)for(const z of [gz-d/2+.9,gz+d/2-.9])if(!(z>gz&&Math.abs(t)<2.2))border.push({x:gx+t,z});
  for(let t=-d/2+1.6;t<=d/2-1.6;t+=.72)for(const x of [gx-w/2+.9,gx+w/2-.9])if(!(x>gx&&Math.abs(t)<3))border.push({x,z:gz+t});
  const mound=instanced('plant-garden-border-leaves',new THREE.SphereGeometry(1,8,6),standard(0x4f7a48),border.length);
  const bloom=instanced('plant-garden-border-blooms',new THREE.SphereGeometry(1,8,6),standard(0xffffff,.8),border.length);
  const palette=[0xe08a9a,0xf3e7c9,0xecc35a,0xaa98cd,0xe998b7];
  border.forEach((b,i)=>{
    const s=.85+random()*.4;place(mound,i,b.x,GROUND+.2,b.z,.42*s,.3*s,.4*s);
    place(bloom,i,b.x+(random()-.5)*.15,GROUND+.42*s+.06,b.z+(random()-.5)*.15,.24*s,.12*s,.24*s);bloom.setColorAt(i,new THREE.Color(palette[Math.floor(random()*palette.length)]));
  });

  // A low plaque at the left corner as seen from the courtyard; the entrance stays open.
  const signX=gx+w/2+.35,signZ=gz+d/2-2.1;
  const title=twoSided(createGardenSign(tr('VƯỜN HOA TRI ÂN'),tr('Mỗi chậu hoa, một lời cảm ơn'),3.7,.72));
  title.name='plant-garden-entrance-sign';title.rotation.y=Math.PI/2;title.position.set(signX,1.38,signZ);group.add(title);
  const posts=instanced('plant-garden-entrance-posts',new THREE.BoxGeometry(1,1,1),standard(0x6f5238,.9),2);
  [-1,1].forEach((side,i)=>{const z=signZ+side*1.93;place(posts,i,signX,.98,z,.12,1.55,.12);colliders.push({minX:signX-.18,maxX:signX+.18,minZ:z-.18,maxZ:z+.18,maxY:1.8,label:tr('Biển góc vườn hoa')});});
  const counterCanvas=document.createElement('canvas');counterCanvas.width=1024;counterCanvas.height=180;
  const counterContext=counterCanvas.getContext('2d')!,counterTexture=new THREE.CanvasTexture(counterCanvas);counterTexture.colorSpace=THREE.SRGBColorSpace;counterTexture.anisotropy=8;
  const counter=new THREE.Mesh(new THREE.PlaneGeometry(3.7,.65),new THREE.MeshBasicMaterial({map:counterTexture,toneMapped:false,fog:false}));
  counter.name='garden-neon-total';counter.rotation.y=Math.PI/2;counter.position.set(signX+.015,.68,signZ);group.add(counter);
  let lastTotal:number|null|undefined=undefined;
  function setTotal(total:number|null){
    if(total===lastTotal)return;lastTotal=total;
    const c=counterContext;c.fillStyle='#152e2b';c.fillRect(0,0,1024,180);c.strokeStyle='#789480';c.lineWidth=3;c.strokeRect(8,8,1008,164);
    c.textBaseline='middle';c.textAlign='left';c.font='600 34px "Segoe UI", Arial';c.fillStyle='#d9e8d5';c.fillText(tr('CHẬU HOA ĐÃ GỬI'),32,53);
    c.font='26px "Segoe UI", Arial';c.fillStyle='#b4c9c0';c.fillText(total===null?tr('Chưa kết nối số liệu'):tr('Gồm chậu chờ xét duyệt'),32,113);
    c.textAlign='right';c.font='700 92px Consolas, monospace';c.shadowColor='#92f3c4';c.shadowBlur=12;c.fillStyle='#c1ffdf';c.fillText(total===null?'—':total.toLocaleString('vi-VN'),982,90);c.shadowBlur=0;counterTexture.needsUpdate=true;
  }
  setTotal(null);

  // Empty beds share one small plaque texture; named beds get a staked sign each.
  const empty=createGardenSign(tr('Ô còn trống'),tr('Chạm để cắm bó hoa'),1.25,.48);
  const emptySigns=instanced('plot-empty-plaques',empty.geometry,empty.material as THREE.Material,count);
  const stakes=instanced('plot-sign-posts',new THREE.CylinderGeometry(.04,.05,1,6),standard(0x6f5238,.9),count);
  // One ring marks the bed the carried bouquet would go to.
  const marker=new THREE.Mesh(new THREE.RingGeometry(1.14,1.42,40),new THREE.MeshBasicMaterial({color:0xffd978,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,fog:false,toneMapped:false}));
  marker.rotation.x=-Math.PI/2;marker.visible=false;marker.name='plot-target-ring';group.add(marker);

  let previous='';let elapsed=1.2,pulse=0;const bouquets:THREE.Group[]=[];
  function setState(state:FlowerLoopState){
    const key=JSON.stringify(state.planted);if(key===previous)return;
    const initial=!previous;previous=key;
    content.traverse(o=>{if(o instanceof THREE.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials){if('map' in m&&(m as THREE.MeshBasicMaterial).map)(m as THREE.MeshBasicMaterial).map!.dispose();}}});
    disposeBouquetVisual(content);bouquets.length=0;elapsed=initial?1.2:0;
    let empties=0,named=0;
    GARDEN_PLOTS.forEach(([x,z],i)=>{
      const p=state.planted[i];
      if(!p){place(emptySigns,empties++,x,GROUND+.36,z+POST_Z,1,1,1,-.95);return;}
      const bouquet=createBouquetVisual(p.flowers);bouquet.position.set(x,GROUND+.33,z);bouquet.scale.setScalar(2.4);bouquet.userData.signature=p.signature;content.add(bouquet);bouquets.push(bouquet);
      place(stakes,named++,x,(SIGN_Y+GROUND)/2-.2,z+POST_Z,1,SIGN_Y-GROUND,1);
      const sign=twoSided(createGardenSign(tName(p.signature),p.recipient?tr('Dành tặng {0}',{0:tName(p.recipient)}):tr('Một lời cảm ơn · 20.11'),2.2,.8));
      sign.name=`plot-sign-${i+1}`;sign.position.set(x,SIGN_Y,z+POST_Z+.06);sign.rotation.x=-.12;content.add(sign);
    });
    emptySigns.count=empties;stakes.count=named;emptySigns.instanceMatrix.needsUpdate=stakes.instanceMatrix.needsUpdate=true;
  }
  function setTarget(index:number){
    marker.visible=index>=0&&index<count;
    if(marker.visible){const [x,z]=GARDEN_PLOTS[index];marker.position.set(x,GROUND+.2,z);}
  }
  function update(dt:number,reduced:boolean){
    elapsed=Math.min(1.2,elapsed+dt);const scale=reduced?1:THREE.MathUtils.smoothstep(elapsed,0,1.2);for(const bouquet of bouquets)bouquet.scale.setScalar(2.4*(.5+.5*scale));
    if(marker.visible){pulse+=dt;(marker.material as THREE.MeshBasicMaterial).opacity=reduced?.8:.55+.3*Math.sin(pulse*3.2);}
  }
  return {group,targets,colliders,setState,setTarget,setTotal,update};
}
