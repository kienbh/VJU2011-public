import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {Collider} from '../types';
import type {StageSeat} from '../festival/stageLayout';
import {roundedRoad} from '../scene/roads';
import {createKoi} from './koi';
import {createGreenLitter,greenBinLabel} from './greenScenery';
export function createPlayScenery(colliders:Collider[],camera?:T.Camera){
 const group=new T.Group();group.name='campus-play-gardens';
 const koi=createKoi(camera);group.add(koi.root);
 if(import.meta.env.DEV)(window as unknown as {__VJU_KOI__:unknown}).__VJU_KOI__=koi;
 const mat=(c:number)=>new T.MeshStandardMaterial({color:c,roughness:.85});
 const wood=mat(0x79533d),stone=mat(0xc3b7a0),grass=mat(0x627654),soil=mat(0x644d39),pink=mat(0xeeb7c8),cream=mat(0xf5dfb9);
 const mesh=(geometry:T.BufferGeometry,material:T.Material,x:number,y:number,z:number,parent:T.Object3D=group)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;};
 const box=(m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>mesh(new T.BoxGeometry(w,h,d),m,x,y,z);
 const sphere=new T.SphereGeometry(1,10,7),dummy=new T.Object3D();
 function cylinder(a:T.Vector3,b:T.Vector3,r:number,material=wood){const o=mesh(new T.CylinderGeometry(r*.65,r,a.distanceTo(b),9),material,...a.clone().add(b).multiplyScalar(.5).toArray() as [number,number,number]);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize());return o;}
 function sign(text:string,x:number,z:number,w=2.6){
  const [title,subtitle]=text.split(' · '),small=w<2,width=small?w:Math.max(w,3.8),height=width*.375,centre=small?1.05:1.45;
  const c=document.createElement('canvas');c.width=1024;c.height=384;const ctx=c.getContext('2d')!;
  ctx.fillStyle='#fff5dc';ctx.fillRect(0,0,1024,384);ctx.fillStyle='#294c43';ctx.fillRect(0,0,22,384);ctx.strokeStyle='#a98347';ctx.lineWidth=6;ctx.strokeRect(16,16,992,352);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#173d34';let size=112;do{ctx.font=`700 ${size}px "Segoe UI",Arial,sans-serif`;if(ctx.measureText(title).width<=920)break;size-=2;}while(size>72);
  ctx.fillText(title,512,subtitle?145:192);if(subtitle){ctx.font='600 62px "Segoe UI",Arial,sans-serif';ctx.fillStyle='#5b5039';ctx.fillText(subtitle,512,278,920);}
  const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const board=mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,side:T.DoubleSide,toneMapped:false}),x,centre,z);board.name='play-readable-sign';board.userData.label=text;
  box(wood,x,centre,z-.06,width+.1,height+.1,.1);if(!small)for(const dx of [-width*.33,width*.33])box(wood,x+dx,(centre-height/2)/2,z,.09,centre-height/2,.09);
 }
 sign(tr('THƯ VIỆN VJU · Vào phòng đọc'),175,-39,4.2);
 const path=mat(0xc5bda6);
 group.add(roundedRoad('lakeside-pedestrian-path',[[88.12,-119],[100,-119],[110,-123],[123,-123]],3.5,path,4));
 group.add(roundedRoad('lotus-pedestrian-path',[[103,-178.62],[103,-181],[106,-181]],3,path,1));
 // One asymmetrical cherry tree. Blossoms use shared geometry and two instanced batches.
 mesh(new T.CylinderGeometry(3.1,3.3,.16,40),soil,112,.13,-120);
 const rim=mesh(new T.TorusGeometry(3.25,.17,6,48),stone,112,.22,-120);rim.rotation.x=Math.PI/2;
 cylinder(new T.Vector3(112,0,-120),new T.Vector3(111.4,6,-120),.65);
 const clusters:Array<[number,number,number,number]>=[];
 for(let i=0;i<8;i++){
  const angle=i*2.399,r=3.5+(i%3)*.7,end=new T.Vector3(112+Math.cos(angle)*r,6.6+(i%3)*.7,-120+Math.sin(angle)*r);
  cylinder(new T.Vector3(111.4,3.5+i*.22,-120),end,.22);
  for(let j=0;j<110;j++){const a=j*2.399,r=2*Math.sqrt((j+.5)/110);clusters.push([end.x+Math.cos(a)*r,end.y+Math.sin(j*1.9)*.85,end.z+Math.sin(a)*r,.55+(j%3)*.15]);}
 }
 const petalParts=Array.from({length:5},(_,i)=>{const g=new T.CircleGeometry(.26,5);g.scale(.7,1,1);g.translate(0,.24,0);g.rotateZ(i*Math.PI*2/5);return g;});
 const blossomMaterial=mat(0xffffff);blossomMaterial.side=T.DoubleSide;
 const blossoms=new T.InstancedMesh(mergeGeometries(petalParts)!,blossomMaterial,clusters.length);petalParts.forEach(g=>g.dispose());
 clusters.forEach(([x,y,z,s],i)=>{dummy.position.set(x,y,z);dummy.scale.set(s*1.2,s*.7,s);dummy.rotation.set(i*.3,i,0);dummy.updateMatrix();blossoms.setMatrixAt(i,dummy.matrix);blossoms.setColorAt(i,new T.Color(i%3===0?0xffe7ec:i%3===1?0xe9a9bf:0xf6cbd7));});group.add(blossoms);
 colliders.push({minX:111.3,maxX:112.7,minZ:-120.7,maxZ:-119.3,maxY:5,label:tr('Gốc anh đào')});
 const petals=new T.InstancedMesh(new T.SphereGeometry(1,5,3),pink,70);group.add(petals);
 const seats:StageSeat[]=[];
 for(const [i,[x,z]] of ([[104,-116],[109,-112],[117,-113],[123,-118]] as number[][]).entries()){
  box(wood,x,.12,z,3.5,.12,2.4);box(cream,x,.2,z,3.25,.08,2.2);
  for(const dx of [-.8,.8]){box(pink,x+dx,.29,z,.9,.14,.8);seats.push({id:`sakura-${i}-${dx}`,number:seats.length+1,row:i,x:x+dx,z,eyeY:1.2,heading:0});}
 }
 const bench=(x:number,z:number,id:string,heading=0)=>{
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=heading;group.add(g);
  mesh(new T.BoxGeometry(3,.18,.85),wood,0,.55,0,g);mesh(new T.BoxGeometry(3,.8,.12),wood,0,1.1,.38,g);
  for(const dx of [-1.1,1.1])mesh(new T.BoxGeometry(.12,.56,.65),wood,dx,.28,0,g);
  const a=new T.Vector3(-1.5,0,.38).applyAxisAngle(new T.Vector3(0,1,0),heading).add(g.position),b=new T.Vector3(1.5,0,.38).applyAxisAngle(new T.Vector3(0,1,0),heading).add(g.position);
  colliders.push({minX:Math.min(a.x,b.x)-.1,maxX:Math.max(a.x,b.x)+.1,minZ:Math.min(a.z,b.z)-.1,maxZ:Math.max(a.z,b.z)+.1,segment:[a.x,a.z,b.x,b.z],thickness:.08,maxY:1.5,label:tr('Lưng ghế ngắm cảnh')});
  seats.push({id,number:seats.length+1,row:5,x,z,eyeY:1.45,heading});
 };
 bench(121,-110,'sakura-bench',.55);sign(tr('Góc anh đào'),100,-114,2.6);
 // Lotus garden on the far-bank lawn, outside the main lake and guest-house approach.
 const pond=new T.Shape();for(let i=0;i<48;i++){const a=i/48*Math.PI*2,x=115+Math.cos(a)*7,z=-185+Math.sin(a)*4.7;i?pond.lineTo(x,-z):pond.moveTo(x,-z);}pond.closePath();
 const geo=new T.ShapeGeometry(pond),water=mesh(geo,new T.MeshStandardMaterial({color:0x557f79,roughness:.25,metalness:.25}),0,.09,0);water.rotation.x=-Math.PI/2;
 const polygon=Array.from({length:48},(_,i)=>[115+Math.cos(i/48*Math.PI*2)*7,-185+Math.sin(i/48*Math.PI*2)*4.7] as const);
 colliders.push({minX:108,maxX:122,minZ:-190,maxZ:-180,polygon,maxY:.1,label:'Ao sen'});
 for(let i=0;i<22;i++){
  const a=i*2.399,r=2+(i%5)*.7,x=115+Math.cos(a)*r,z=-185+Math.sin(a)*r*.6;
  const leaf=mesh(new T.CircleGeometry(.65+(i%3)*.14,12),grass,x,.14,z);leaf.rotation.x=-Math.PI/2;
  if(i%3===0){cylinder(new T.Vector3(x,.12,z),new T.Vector3(x,.7,z),.025,grass);for(let j=0;j<7;j++){const a=j*Math.PI*2/7,p=mesh(sphere,pink,x+Math.sin(a)*.22,.75,z+Math.cos(a)*.22);p.scale.set(.16,.12,.38);p.rotation.set(-.25,a,0);}const centre=mesh(sphere,cream,x,.82,z);centre.scale.set(.13,.08,.13);}
 }
 for(let i=0;i<36;i++){const a=i/36*Math.PI*2;const r=mesh(sphere,stone,115+Math.cos(a)*7.2,.2,-185+Math.sin(a)*4.9);r.scale.set(.45,.28,.32);}
 bench(105,-185,'lotus-west',-Math.PI/2);bench(125,-185,'lotus-east',Math.PI/2);sign(tr('Ao sen · Một khoảng yên'),100,-179,2.8);
 // Three clearly labelled containers; never rely on colour alone.
 for(const [i,[label,color]] of ( [[tr('Hữu cơ'),0x286346],[tr('Tái chế'),0x235d88],[tr('Còn lại'),0xa34b22]] as [string,number][]).entries()){
  const x=132+i*2.1;box(mat(color),x,.8,-36,1.6,1.5,1.4);box(wood,x,1.59,-36,1.7,.16,1.5);const badge=greenBinLabel(i);badge.position.set(x,.86,-35.28);badge.userData.label=label;group.add(badge);
  colliders.push({minX:x-.8,maxX:x+.8,minZ:-36.7,maxZ:-35.3,maxY:1.8,label:tr('Thùng phân loại')});
 }
 sign(tr('Sân trường xanh'),140,-34,2.8);
 const greenScenery=createGreenLitter(group,colliders),litter=greenScenery.litter;
 const decor=new T.Group();decor.position.set(106,0,-114);group.add(decor);
 const pot=mesh(new T.CylinderGeometry(.45,.3,.7,12),stone,0,.35,0,decor);pot.visible=false;
 const label=mesh(new T.BoxGeometry(.75,.4,.08),cream,0,.9,0,decor);label.visible=false;
 const model=mesh(new T.IcosahedronGeometry(.5),pink,0,1.3,0,decor);model.visible=false;
 return {group,seats,litter,koi,configureGreen:greenScenery.configure,decor:(choice:string)=>{pot.visible=['pot','model'].includes(choice);label.visible=choice==='label';model.visible=choice==='model';},
  update(t:number,reduced:boolean,at:T.Vector3){
   koi.update(t,reduced,at);
   const near=Math.hypot(at.x-112,at.z+120)<40;petals.visible=near&&!reduced;
   if(petals.visible)for(let i=0;i<70;i++){const a=i*2.399,phase=(t*.35+i*.137)%1;dummy.position.set(112+Math.cos(a)*(i%7)+Math.sin(t*.4+i)*.5,7-phase*6.8,-120+Math.sin(a)*(i%6));dummy.scale.set(.075,.025,.12);dummy.rotation.set(t+i,i,t*.4);dummy.updateMatrix();petals.setMatrixAt(i,dummy.matrix);}petals.instanceMatrix.needsUpdate=true;
  }};
}
