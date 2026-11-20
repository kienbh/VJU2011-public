import {tr} from '../i18n/index.ts';
import * as THREE from 'three';
import {detailBatch,districtPlaster} from './districtFinishes';
import {LAB_ENTRY} from '../play/labEntry';

/** Proposed readable entrance details, not surveyed architecture. Footprints stay unchanged. */
/** Proposed readable entrance details, not surveyed architecture. Footprints stay unchanged. */
function plaque(parent:THREE.Group,text:string,width:number,height:number,x:number,y:number,z:number,rotation=0){
  const c=document.createElement('canvas');c.width=2048;c.height=Math.round(2048*height/width);const ctx=c.getContext('2d')!;
  ctx.fillStyle='#173f4a';ctx.fillRect(0,0,c.width,c.height);ctx.strokeStyle='#c7b88d';ctx.lineWidth=3;ctx.strokeRect(4,4,c.width-8,c.height-8);
  let size=Math.floor(c.height*.62);do{ctx.font=`600 ${size}px Segoe UI`;if(ctx.measureText(text).width<=c.width-80)break;size--;}while(size>16);
  ctx.fillStyle='#f5edda';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,c.width/2,c.height/2);
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map,roughness:.65}));
  sign.position.set(x,y,z);sign.rotation.y=rotation;sign.name=text;parent.add(sign);
}
export function labEntrance(x:number,z:number,w:number,h:number){
  const group=new THREE.Group();group.name='lab-hasuko-proposed-facade';
  const d=detailBatch('lab-window-frames-and-entry'),face=z+7.15;
  const frame=new THREE.MeshStandardMaterial({color:0xb8c9c8,metalness:.42,roughness:.38});
  const plaster=districtPlaster(0xece8da),teal=districtPlaster(0x345d64);
  const glass=new THREE.MeshStandardMaterial({color:0x476f78,metalness:.18,roughness:.28});glass.name='campus-window-glass';
  const spacing=(w-2.2)/10;
  for(let i=0;i<10;i++){
    const bx=x+(i-4.5)*spacing;
    for(let floor=0;floor<2;floor++){
      if(floor===0&&(i===2||i===4||i===5))continue;
      const by=(floor+.6)*h/2,ow=spacing*.7;
      for(const side of [-1,1])d.add(frame,bx+side*ow/2,by,face,.075,1.75,.16);
      d.add(frame,bx,by,face,.065,1.7,.16);
      d.add(plaster,bx,by-.94,face+.1,ow+.36,.15,.4);
      d.add(teal,bx,by+1,face+.12,ow+.38,.12,.5);
    }
    d.add(plaster,bx-spacing/2,h/2,face-.06,.18,h,.2);
  }
  d.add(teal,x,1.55,face+.03,6.1,3.1,.15);
  for(const dx of [-2,-.67,.67,2]){
    d.add(glass,x+dx,1.5,face+.14,1.25,2.75,.08);
    for(const side of [-1,1])d.add(frame,x+dx+side*.63,1.5,face+.21,.06,2.85,.08);
    d.add(frame,x+dx+.43,1.3,face+.26,.05,.55,.07);
  }
  d.add(teal,x,3.06,face+.8,7.6,.16,2);
  d.add(frame,x,3.17,face+.8,7.7,.06,2.1);
  d.add(plaster,x,.08,face+1,8,.14,2.3);
  d.add(teal,x,3.84,face+.04,17.8,.94,.18);
  group.add(d.finish());plaque(group,tr('PHÒNG THÍ NGHIỆM'),17.4,.83,x,3.84,face+.15);
  const entry=new THREE.Group();entry.name=LAB_ENTRY.name;
  const ed=detailBatch('lab-secondary-door-frame'),ex=x-2.5*spacing;
  ed.add(teal,ex,1.45,face+.08,3.1,2.9,.22);
  for(const side of [-1,1]){
    ed.add(glass,ex+side*.67,1.38,face+.23,1.25,2.5,.08);
    ed.add(frame,ex+side*1.33,1.38,face+.29,.08,2.6,.12);
    ed.add(frame,ex+side*.18,1.28,face+.36,.06,.48,.08);
  }
  ed.add(frame,ex,1.38,face+.29,.07,2.6,.12);
  ed.add(plaster,ex,.1,face+.7,3.5,.16,1.8);
  entry.add(ed.finish());
  plaque(entry,tr('FTH · VẬT LÝ'),3.4,.58,ex,3.02,face+.31);
  group.add(entry);
  return group;
}
export function sportsEntrances(x:number,z:number,w:number,depth:number,h:number){
  const group=new THREE.Group();group.name='multipurpose-sports-proposal';
  const d=detailBatch('sports-entries-and-east-elevation');
  const frame=new THREE.MeshStandardMaterial({color:0xa8bbb9,metalness:.5,roughness:.36});
  const glass=new THREE.MeshStandardMaterial({color:0x527984,roughness:.28,metalness:.2});glass.name='campus-window-glass';
  const teal=districtPlaster(0x284d59),cream=districtPlaster(0xe4e3d6),stone=districtPlaster(0xb2aea2);
  for(const side of [-1,1]){
    const face=z+side*(depth/2+.36);
    // Large layered portal covers the old blank wall and its middle bay.
    d.add(teal,x,4.4,face,19,8.8,.3);
    d.add(glass,x,3.4,face+side*.21,16.4,6.2,.08);
    for(let i=0;i<7;i++)d.add(frame,x-8.2+i*16.4/6,3.4,face+side*.3,.12,6.35,.12);
    for(const y of [.3,3,6.5])d.add(frame,x,y,face+side*.3,16.5,.13,.12);
    for(const dx of [-2.7,0,2.7])d.add(frame,x+dx,1.5,face+side*.39,.06,.8,.08);
    d.add(cream,x,7.15,face+side*.15,20,1.4,.42);
    d.add(teal,x,5.05,face+side*1.3,21,.23,3.15);
    d.add(frame,x,5.2,face+side*1.3,21.1,.07,3.2);
    // Open, shallow forecourt; no posts or added solid on the walking route.
    d.add(stone,x,.08,face+side*1.65,25,.12,3.4);
    for(const dx of [-10.8,10.8])d.add(cream,x+dx,4.5,face,.5,9,.6);
    plaque(group,tr('NHÀ ĐA NĂNG'),17,1,x,7.2,face+side*.4,side===1?0:Math.PI);
    for(let i=0;i<8;i++){
      const bx=x-w/2+2.6+i*(w-5.2)/7;
      d.add(glass,bx,h-1.25,face,3.8,1.25,.12);
      d.add(frame,bx,h-1.94,face+side*.06,4,.09,.18);
    }
  }
  // The pitch-facing long wall also reads as a sports hall rather than a blank shed.
  for(let i=0;i<8;i++){
    const bz=z-depth/2+3.5+i*(depth-7)/7;
    d.add(cream,x+w/2+.12,h/2,bz,.24,h,.4);
    d.add(teal,x+w/2+.08,h-1.5,bz+2.3,.16,1.8,4.2);
    for(let j=0;j<6;j++)d.add(frame,x+w/2+.2,h-2.2+j*.25,bz+2.3,.14,.06,4.1);
  }
  group.add(d.finish());return group;
}
