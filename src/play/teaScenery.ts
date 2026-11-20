import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Collider} from '../types';
import type {StageSeat} from '../festival/stageLayout';
export const TEA={x:137,z:-116};
export const TEA_SEATS:StageSeat[]=[[-2,0],[1,1.8],[1,-1.8]].flatMap(([dx,dz])=>[0,1].map(table=>{
 const tx=table?141:131,tz=table?-112:-117,x=tx+dx,z=tz+dz;
 return {id:'',number:0,row:0,x,z,eyeY:1.4,heading:Math.atan2(x-tx,z-tz)};
})).map((s,i)=>({...s,id:'tea-'+i,number:i+1}));
export function createTeaScenery(colliders:Collider[]){
 const root=new T.Group();root.name='tea-corner';
 const materials=new Map<string,T.Material>(),batches=new Map<T.Material,T.BufferGeometry[]>();
 const mat=(color:string)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.75}));return materials.get(color)!;};
 const add=(g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,rotation=new T.Euler())=>{
  g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(rotation),new T.Vector3(1,1,1)));
  const batch=batches.get(m)||[];batch.push(g);batches.set(m,batch);
 };
 const box=(m:T.Material,x:number,y:number,z:number,w:number,h:number,d:number,r=new T.Euler())=>add(new T.BoxGeometry(w,h,d),m,x,y,z,r);
 const branch=(a:T.Vector3,b:T.Vector3,r:number)=>{const g=new T.CylinderGeometry(r*.55,r,a.distanceTo(b),9);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),b.clone().sub(a).normalize()));const c=a.clone().add(b).multiplyScalar(.5);add(g,mat('#75614c'),c.x,c.y,c.z);};
 // A layered Terminalia canopy: broad, individually oriented leaves, with space underneath.
 add(new T.CylinderGeometry(2.3,2.3,.1,36),mat('#72624b'),TEA.x,.08,TEA.z);
 add(new T.TorusGeometry(2.35,.12,6,48),mat('#c1b496'),TEA.x,.15,TEA.z,new T.Euler(Math.PI/2,0,0));
 branch(new T.Vector3(TEA.x,0,TEA.z),new T.Vector3(TEA.x-.35,8.5,TEA.z+.2),.65);
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;branch(new T.Vector3(TEA.x,1.2,TEA.z),new T.Vector3(TEA.x+Math.cos(a)*1.8,.15,TEA.z+Math.sin(a)*1.8),.2);}
 const shape=new T.Shape();shape.moveTo(0,-.5);shape.quadraticCurveTo(.5,-.2,.24,.36);shape.quadraticCurveTo(.12,.6,0,.7);shape.quadraticCurveTo(-.5,.25,0,-.5);
 const leaves=new T.InstancedMesh(new T.ShapeGeometry(shape,3),new T.MeshStandardMaterial({color:'#ffffff',roughness:.85,side:T.DoubleSide}),1500),dummy=new T.Object3D();
 for(let tier=0;tier<3;tier++){
  const radius=7.4-tier*1.8,y=6.7+tier*1.6;
  for(let i=0;i<7;i++){const a=i*2.399+tier;branch(new T.Vector3(TEA.x-.2,y-1.3,TEA.z),new T.Vector3(TEA.x+Math.cos(a)*radius*.8,y,TEA.z+Math.sin(a)*radius*.8),.15);}
  for(let i=0;i<500;i++){const a=i*2.399+tier,r=radius*Math.sqrt((i+.5)/500),idx=tier*500+i;dummy.position.set(TEA.x+Math.cos(a)*r,y+Math.sin(i*3.7)*.35+Math.max(0,1-r/radius)*.7,TEA.z+Math.sin(a)*r);dummy.rotation.set(-Math.PI/2+Math.sin(i)*.25,Math.cos(i)*.3,a);dummy.scale.set(1.05,1.4,1);dummy.updateMatrix();leaves.setMatrixAt(idx,dummy.matrix);leaves.setColorAt(idx,new T.Color(['#507a42','#739447','#3c683f','#819b4b'][i%4]));}
 }
 root.add(leaves);colliders.push({minX:TEA.x-.7,maxX:TEA.x+.7,minZ:TEA.z-.7,maxZ:TEA.z+.7,maxY:9,label:tr('Gốc bàng góc trà đá')});
 const plastic=[mat('#245b68'),mat('#a74335')],tableMat=mat('#659385');
 TEA_SEATS.forEach((s,i)=>{
  const transform=(x:number,y:number,z:number)=>new T.Vector3(x,y,z).applyAxisAngle(new T.Vector3(0,1,0),s.heading).add(new T.Vector3(s.x,0,s.z));
  const piece=(x:number,y:number,z:number,w:number,h:number,d:number)=>{const p=transform(x,y,z);box(plastic[i%2],p.x,p.y,p.z,w,h,d,new T.Euler(0,s.heading,0));};
  piece(0,.55,0,.82,.12,.76);for(const x of [-.32,.32])for(const z of [-.28,.28])piece(x,.27,z,.085,.54,.085);
  piece(0,1.05,.32,.8,.12,.1);for(const x of [-.32,-.11,.11,.32])piece(x,.84,.32,.08,.42,.08);
  // Only the backrest blocks walking; approach from the front remains open.
  const a=transform(-.4,0,.32),b=transform(.4,0,.32);colliders.push({minX:Math.min(a.x,b.x)-.08,maxX:Math.max(a.x,b.x)+.08,minZ:Math.min(a.z,b.z)-.08,maxZ:Math.max(a.z,b.z)+.08,segment:[a.x,a.z,b.x,b.z],thickness:.06,maxY:1.2,label:tr('Lưng ghế trà đá')});
 });
 for(const [tx,tz] of [[131,-117],[141,-112]]){
  add(new T.CylinderGeometry(.85,.85,.12,24),tableMat,tx,.73,tz);
  for(const dx of [-.5,.5])for(const dz of [-.5,.5])box(tableMat,tx+dx,.36,tz+dz,.09,.72,.09);
  add(new T.CylinderGeometry(.29,.24,.055,20),mat('#eee4cb'),tx,.83,tz);
  for(let i=0;i<24;i++){const a=i*2.399,r=.22*Math.sqrt(i/24);const g=new T.SphereGeometry(1,5,4);g.scale(.026,.016,.063);add(g,mat('#423d31'),tx+Math.cos(a)*r,.88,tz+Math.sin(a)*r,new T.Euler(0,a,0));}
  for(const a of [0,2.1,4.2]){
   const x=tx+Math.cos(a)*.57,z=tz+Math.sin(a)*.57;
   add(new T.CylinderGeometry(.1,.075,.28,12),mat('#c9dbc8'),x,.93,z);
   add(new T.CylinderGeometry(.082,.082,.012,12),mat('#a68346'),x,1.075,z);
   box(mat('#edf2df'),x,1.09,z,.055,.035,.055);
  }
  colliders.push({minX:tx-.85,maxX:tx+.85,minZ:tz-.85,maxZ:tz+.85,maxY:.8,label:tr('Bàn trà đá')});
 }
 for(const [material,parts] of batches){const m=new T.Mesh(mergeGeometries(parts)!,material);m.receiveShadow=true;root.add(m);parts.forEach(g=>g.dispose());}
 return root;
}
