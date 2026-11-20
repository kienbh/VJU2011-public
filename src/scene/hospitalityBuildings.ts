import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import type {Collider} from '../types';
import {detailBatch,districtPlaster} from './districtFinishes';

function sign(text:string,width:number,height:number,background:string,ink:string){
  const c=document.createElement('canvas');c.width=1536;c.height=Math.round(1536*height/width);
  const ctx=c.getContext('2d')!;ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 ${Math.round(c.height*.53)}px "Segoe UI", sans-serif`;ctx.fillText(text,c.width/2,c.height*.52);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map,fog:false,toneMapped:false}));
}

/** Japanese-inspired clubhouse on the existing plot; entry faces its access lane. */
/** Japanese-inspired clubhouse on the existing plot; entry faces its access lane. */
export function createJapaneseClubHouse(){
  const group=new THREE.Group();group.name='japanese-club-house';group.position.set(170,0,-111);
  group.userData={floors:1,frontVector:[0,0,1],provisionalDesign:true};
  const detail=detailBatch('clubhouse-timber-and-shoji');
  const wall=districtPlaster(0xe2d8c1),wood=districtPlaster(0x5c4030),stone=districtPlaster(0x8c8a7d);
  const roof=new THREE.MeshStandardMaterial({color:0x2e3d40,roughness:.8}),glass=new THREE.MeshStandardMaterial({color:0x405a57,roughness:.3,metalness:.12,emissive:0xe8b974,emissiveIntensity:.35});
  glass.name='campus-window-glass-club';
  const light=new THREE.MeshBasicMaterial({color:0xffdfa2,toneMapped:false});
  const box=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>detail.add(m,x,y,z,w,h,d);
  box(wall,0,2.5,-1.6,26,5,12.8);
  for(const side of [-1,1])box(wall,side*7.7,2.5,6.4,10.6,5,3.2);
  box(wall,0,4.4,6.4,4.8,1.2,3.2);
  box(stone,0,.13,9.4,28,.24,3.6);box(wood,0,.28,8.65,27,.09,2.1);
  box(stone,0,.13,10.9,6,.12,2);box(stone,0,.13,6.4,4.8,.12,5.7);
  box(glass,0,1.95,4.86,4.5,3.6,.08);
  for(const x of [-2.3,0,2.3])box(wood,x,2,4.96,.11,3.8,.12);
  for(const x of [-.22,.22])box(wood,x,1.7,5.06,.05,.62,.1);
  for(const side of [-1,1]){
    for(const x of [4.2,7.7,11.2]){
      box(glass,x*side,2.4,8.06,2.9,3.1,.08);
      for(let i=0;i<=4;i++)box(wood,(x-1.45+i*.725)*side,2.4,8.16,.055,3.1,.1);
      for(const y of [1.05,2.25,3.8])box(wood,x*side,y,8.16,2.95,.065,.1);
    }
    for(const z of [-5,-1,3]){
      box(glass,side*13.04,2.35,z,.08,2.8,2.7);
      for(const dz of [-1.35,0,1.35])box(wood,side*13.13,2.35,z+dz,.1,2.85,.06);
    }
  }
  for(const x of [-13,-9.4,-5.9,-2.7,2.7,5.9,9.4,13])box(wood,x,2.65,9.25,.18,4.75,.2);
  for(const y of [.7,4.6])box(wood,0,y,8.2,26,.2,.18);
  box(wood,0,4.98,0,29,.22,19.5);
  const vertices=[-14.8,5.1,-10,14.8,5.1,-10,14.8,5.1,10,-14.8,5.1,10,-10,7.5,0,10,7.5,0];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,4,5,0,5,1,1,5,2,2,5,4,2,4,3,3,4,0]);geometry.computeVertexNormals();
  roof.side=THREE.DoubleSide;const hip=new THREE.Mesh(geometry,roof);hip.name='clubhouse-charcoal-hip-roof';group.add(hip);
  box(roof,0,7.57,0,20.5,.22,.35);
  // Fine standing seams articulate the roof without a repetitive heavy tile mesh.
  const seams:number[]=[];
  for(let x=-12;x<=12;x+=.7)for(const side of [-1,1]){
    const ridgeX=THREE.MathUtils.clamp(x,-10,10);seams.push(x,5.13,side*9.95,ridgeX,7.53,0);
  }
  const seamGeo=new THREE.BufferGeometry();seamGeo.setAttribute('position',new THREE.Float32BufferAttribute(seams,3));
  group.add(new THREE.LineSegments(seamGeo,new THREE.LineBasicMaterial({color:0x647373,transparent:true,opacity:.4})));
  for(const x of [-3.4,3.4]){
    box(wood,x,3.9,8.9,.07,1,.07);
    const lantern=new THREE.Mesh(new THREE.CylinderGeometry(.24,.24,.62,12),light);lantern.position.set(x,3.35,8.9);group.add(lantern);
    for(const y of [3.03,3.67])box(wood,x,y,8.9,.5,.065,.5);
  }
  const name=sign('CLUB HOUSE',5.4,.7,'#352b24','#f6dfa8');name.position.set(0,4.46,9.38);group.add(name);
  const colliders:Collider[]=[
    {minX:157,maxX:183,minZ:-119,maxZ:-106.2,label:tr('Club House · khối sau')},
    {minX:157,maxX:167.6,minZ:-106.2,maxZ:-103,label:tr('Club House · cánh trái')},
    {minX:172.4,maxX:183,minZ:-106.2,maxZ:-103,label:tr('Club House · cánh phải')},
  ];
  for(const x of [-13,-9.4,-5.9,-2.7,2.7,5.9,9.4,13])colliders.push({minX:170+x-.12,maxX:170+x+.12,minZ:-101.9,maxZ:-101.6,label:tr('Cột hiên Club House')});
  group.add(detail.finish());return {group,colliders};
}

/** Three-storey guest hotel, oriented toward the lake, on the existing far-bank plot. */
/** Three-storey guest hotel, oriented toward the lake, on the existing far-bank plot. */
export function createGuestHotel(){
  const group=new THREE.Group();group.name='vnu-guest-house-hotel';group.userData={floors:3,navigable:false,provisionalDesign:true};
  const details=detailBatch('guest-hotel-facades');
  const plaster=districtPlaster(0xe3e0d5),dark=districtPlaster(0x35494c),stone=districtPlaster(0xa6a496),timber=districtPlaster(0x886448);
  const metal=new THREE.MeshStandardMaterial({color:0x57696c,roughness:.4,metalness:.45});
  const warm=new THREE.MeshBasicMaterial({color:0xffdda4,toneMapped:false});
  const glazes=[0,1,2].map(i=>{const m=new THREE.MeshStandardMaterial({color:0x4b6570,roughness:.25,metalness:.2,emissive:0xffd69a,emissiveIntensity:.35+i*.14});m.name=`campus-window-glass-hotel-variation-${i}`;return m;});
  const box=(m:THREE.Material,x:number,y:number,z:number,w:number,h:number,d:number)=>details.add(m,x,y,z,w,h,d);
  box(stone,0,.16,0,32,.25,20);box(plaster,0,6.25,0,26,12.5,13);
  for(const y of [.55,4.35,8.55,12.55]){
    box(plaster,0,y,0,27.4,.22,14.3);box(dark,0,y-.19,6.7,26.9,.18,.34);
  }
  box(dark,0,13.05,0,27.7,.35,14.5);box(warm,0,12.71,7.12,26.5,.045,.06);
  for(let floor=0;floor<3;floor++){
    const y=2.3+floor*4.2;
    for(let col=0;col<6;col++){
      const x=(col-2.5)*4.05,glaze=glazes[(col+floor*2)%3];
      box(dark,x,y,6.57,3.65,3.2,.12);box(glaze,x,y,6.68,3.35,2.9,.1);
      for(const dx of [-1.7,0,1.7])box(metal,x+dx,y,6.8,.075,2.95,.12);
      if(floor>0){
        box(stone,x,y-1.63,7.1,3.75,.16,1.3);
        for(const dx of [-1.76,0,1.76])box(metal,x+dx,y-1.1,7.69,.055,.95,.06);
        box(metal,x,y-.63,7.69,3.6,.06,.07);
        box(warm,x,y-1.71,7.7,2.8,.035,.045);
      }
    }
    for(const side of [-1,1])for(const z of [-4,0,4]){
      box(dark,side*13.06,y,z,.12,3.1,2.7);box(glazes[(floor+1)%3],side*13.14,y,z,.07,2.8,2.45);
      box(metal,side*13.22,y,z,.09,2.85,.075);
    }
  }
  // Vertical timber screens flank an illuminated double-height arrival canopy.
  for(const side of [-1,1]){
    for(let i=0;i<5;i++)box(timber,side*(11.75+i*.22),6.45,6.95,.09,11.65,.3);
    box(dark,side*4.1,1.9,8.2,.2,3.7,.2);box(warm,side*4.1,2.2,8.34,.09,1.7,.04);
  }
  box(dark,0,4.02,8,9.4,.22,3.2);box(warm,0,3.88,9.38,8.8,.06,.07);
  box(glazes[2],0,2.05,6.86,4.6,3.5,.12);
  for(const x of [-2.3,0,2.3])box(metal,x,2.05,6.98,.09,3.6,.1);
  for(const x of [-.24,.24])box(metal,x,1.65,7.12,.045,.65,.08);
  box(stone,0,.16,9.1,8,.16,4.7);
  const name=sign('VJU · GUEST HOUSE',10,.8,'#263d42','#ffe1a9');name.position.set(0,4.65,7.03);group.add(name);
  group.add(details.finish());return group;
}
