import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import type {Collider} from '../types';
import {detailBatch,districtPlaster} from './districtFinishes';

// Owner correction: two taller storeys, a shorter frontage and an open canteen entry.
// Dimensions remain model proportions, not measurements of the real building.
export const CANTEEN={x:170,z:-60,width:48,depth:38,height:11.8,entryWidth:6.4,entryDepth:4};
export function createCanteenLibrary(){
  const group=new THREE.Group();group.name='canteen-library-rmit';
  group.userData={floors:2,provisionalDimensions:true};
  const {x,z,width:w,depth:d,height:h,entryWidth:entry,entryDepth:recess}=CANTEEN;
  const face=z+d/2,half=(w-entry)/2;
  const plaster=districtPlaster(0xe1e6e2),teal=districtPlaster(0x346d74);
  const frame=new THREE.MeshStandardMaterial({color:0xb9c9c7,metalness:.4,roughness:.38});
  const glass=new THREE.MeshStandardMaterial({color:0x416772,metalness:.15,roughness:.3});glass.name='campus-window-glass';
  const shade=new THREE.MeshStandardMaterial({color:0x253e42,roughness:.9});
  const stone=districtPlaster(0xb6b6aa),details=detailBatch('canteen-structural-details');
  function box(name:string,px:number,py:number,pz:number,bw:number,bh:number,bd:number,mat:THREE.Material){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(bw,bh,bd),mat);mesh.name=name;mesh.position.set(px,py,pz);mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  const colliders:Collider[]=[];
  function solid(px:number,pz:number,bw:number,bd:number,label:string){colliders.push({minX:px-bw/2,maxX:px+bw/2,minZ:pz-bd/2,maxZ:pz+bd/2,label});}
  // The vestibule is genuinely recessed and walkable; the inner door closes the interior.
  box('canteen-main-body',x,h/2,z-recess/2,w,h,d-recess,plaster);solid(x,z-recess/2,w,d-recess,tr('Căng tin · khối sau'));
  for(const side of [-1,1]){
    const bx=x+side*(entry/2+half/2);
    box('canteen-entry-wing',bx,h/2,face-recess/2,half,h,recess,plaster);solid(bx,face-recess/2,half,recess,tr('Căng tin · cánh sảnh'));
  }
  box('canteen-entry-lintel',x,(h+4.2)/2,face-recess/2,entry,h-4.2,recess,plaster);
  box('canteen-entry-floor',x,.16,face-1,entry,.12,6,stone).userData.navigationSurface=true;
  box('canteen-road-to-entry-path',x,.16,(face-28)/2,entry,.12,-28-face,stone).userData.navigationSurface=true;
  box('canteen-inner-glazing',x,2.1,face-recess+.06,entry-.16,3.8,.08,glass);
  for(const dx of [-entry/2,0,entry/2])details.add(frame,x+dx,2.1,face-recess+.16,.1,3.9,.12);
  for(const dx of [-.25,.25])details.add(frame,x+dx,1.7,face-recess+.25,.06,.7,.08);
  box('canteen-green-roof',x,h+.3,z,w+.9,.6,d+.9,teal);
  // Eight bays give the two floors a clear rhythm; lower middle bays frame the entrance.
  const spacing=w/8;
  for(let i=0;i<8;i++){
    const bx=x+(i-3.5)*spacing;
    for(let floor=0;floor<2;floor++){
      if(floor===0&&(i===3||i===4))continue;
      const by=floor===0?2.3:8.1,wh=floor===0?3.3:2.8,ww=4.5;
      details.add(shade,bx,by,face+.04,ww+.2,wh+.2,.12);
      details.add(glass,bx,by,face+.13,ww,wh,.08);
      for(const dx of [-ww/2,0,ww/2])details.add(frame,bx+dx,by,face+.21,.085,wh+.1,.12);
      for(const dy of [-wh/2,wh/2])details.add(frame,bx,by+dy,face+.21,ww+.1,.09,.12);
      details.add(plaster,bx,by-wh/2-.12,face+.23,ww+.45,.16,.4);
    }
  }
  for(let i=0;i<=8;i++){
    const bx=x-w/2+i*spacing;
    if(i!==4)details.add(plaster,bx,h/2,face+.1,.32,h,.32);
  }
  for(const by of [5.65,11.55])details.add(plaster,x,by,face+.2,w,.32,.42);
  for(const side of [-1,1])details.add(teal,x+side*(w/2-.7),h/2,face+.25,.65,h,.2);
  box('canteen-entrance-canopy',x,4.55,face+.95,13,.24,2.5,teal);
  group.add(details.finish());
  function sign(text:string,px:number,py:number,width:number,height:number,pz=face+.46){
    const c=document.createElement('canvas');c.width=2048;c.height=Math.round(2048*height/width);
    const ctx=c.getContext('2d')!;ctx.fillStyle='#174752';ctx.fillRect(0,0,c.width,c.height);
    const size=c.height*.65;ctx.font=`700 ${size}px "Segoe UI", Arial, sans-serif`;
    const fit=Math.min(size,size*(c.width*.94)/ctx.measureText(text).width);ctx.font=`700 ${fit}px "Segoe UI", Arial, sans-serif`;
    ctx.fillStyle='#fff3da';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2);
    const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map,fog:false,toneMapped:false}));
    mesh.name=text;mesh.position.set(px,py,pz);group.add(mesh);
  }
  sign(tr('GIẢNG ĐƯỜNG 3 / THƯ VIỆN'),x-12,10.35,22,1.05);
  sign('RMIT - VNU',x+12,10.35,22,1.05);
  sign(tr('CĂNG TIN'),x,3.85,6.2,.75,face+.1);
  return {group,colliders};
}
