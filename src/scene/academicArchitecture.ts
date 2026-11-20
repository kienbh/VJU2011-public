import {tr} from '../i18n/index.ts';
import {applyAcademicPlaster} from './academicPlaster';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Courtyard elevations interpreted from 02-mat-dung-hieu-bo.jpg and flycam 01.
 * Geometry is visual only: approved envelopes and collision remain in campus.ts.
 * Rear elevations and inaccessible interiors are intentionally simplified. */
/** Courtyard elevations interpreted from 02-mat-dung-hieu-bo.jpg and flycam 01.
 * Geometry is visual only: approved envelopes and collision remain in campus.ts.
 * Rear elevations and inaccessible interiors are intentionally simplified. */
export function createAcademicArchitecture() {
  const group = new THREE.Group(); group.name = 'photo-referenced-academic-facades';
  const material = (name:string,color:number,roughness=.85,metalness=0) => {
    const result=new THREE.MeshStandardMaterial({color,roughness,metalness});result.name=name;return result;
  };
  const paint=material('academic-warm-white-render',0xf0eee7), edge=material('academic-concrete-coping',0xd9dbd5);
  const reveal=material('academic-recessed-shadow',0x647574), frame=material('academic-dark-aluminium',0x384d50,.38,.55);
  const glass=material('academic-turquoise-glazing',0x508d91,.26,.26), glassAlt=material('academic-glazing-variation',0x668f91,.33,.22);
  const roof=material('academic-green-metal-roof',0x47766f,.59,.2), metal=material('academic-balcony-handrails',0x9ca9a8,.35,.65);
  const stone=material('academic-entrance-stone',0x8f9690,.82);
  // Subtle mineral pores, not a photographic façade or coarse dirt texture.
  const grain=document.createElement('canvas');grain.width=grain.height=128;
  const ctx=grain.getContext('2d')!;ctx.fillStyle='#b6b6b6';ctx.fillRect(0,0,128,128);
  let seed=731;for(let i=0;i<6000;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed%128;seed=(seed*1664525+1013904223)>>>0;const y=seed%128;ctx.fillStyle=`rgba(${i%2?255:0},${i%2?255:0},${i%2?255:0},.08)`;ctx.fillRect(x,y,1,1);}
  const bump=new THREE.CanvasTexture(grain);bump.wrapS=bump.wrapT=THREE.RepeatWrapping;bump.repeat.set(3,3);
  for(const m of [paint,edge,stone])applyAcademicPlaster(m);bump.dispose();
  const batches=new Map<THREE.Material,THREE.BufferGeometry[]>();
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,bevel=0) {
    const g=bevel?new RoundedBoxGeometry(w,h,d,1,Math.min(bevel,w/5,h/5,d/5)):new THREE.BoxGeometry(w,h,d);
    g.translate(x,y,z);if(!batches.has(m))batches.set(m,[]);
    // RoundedBox is non-indexed; merge a uniform representation with BoxGeometry.
    const geometry=g.index?g.toNonIndexed():g;if(geometry!==g)g.dispose();batches.get(m)!.push(geometry);
  }
  function frontWindow(x:number,y:number,z:number,w:number,h:number,variant=0) {
    // Dark reveal behind frames; glass is recessed inside the white surround.
    box(x,y,z,w+.22,h+.22,.14,reveal);
    box(x,y,z+.085,w,h,.06,variant%3===0?glassAlt:glass);
    for(const side of [-1,1])box(x+side*w/2,y,z+.14,.085,h+.17,.12,frame);
    for(const side of [-1,1])box(x,y+side*h/2,z+.14,w+.17,.085,.12,frame);
    box(x,y,z+.145,.075,h,.13,frame);
    box(x,y+h*.17,z+.145,w,.07,.13,frame);
    box(x,y-h/2-.16,z+.23,w+.38,.15,.38,edge,.025);
  }
  function label(text:string,sub:string,x:number,y:number,z:number,w:number) {
    const c=document.createElement('canvas');c.width=1536;c.height=256;const t=c.getContext('2d')!;
    t.fillStyle='#e8e9e1';t.fillRect(0,0,c.width,c.height);t.textAlign='center';
    let size=118;t.font=`700 ${size}px Arial`;while(t.measureText(text).width>1390){size--;t.font=`700 ${size}px Arial`;}
    t.fillStyle='#a3373c';t.fillText(text,768,134);t.fillStyle='#40565a';t.font='600 50px Arial';t.fillText(sub,768,211);
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,w/6),new THREE.MeshStandardMaterial({map:texture,roughness:.85}));
    mesh.position.set(x,y,z);group.add(mesh);
  }
  function parapet(x:number,z:number,w:number,d:number,y:number) {
    box(x,y,z,w,.34,d,edge,.045);
    box(x,y+.25,z-d/2+.25,w,.45,.5,paint,.035);
    for(const side of [-1,1])box(x+side*(w/2-.25),y+.25,z,.5,.45,d,paint,.035);
    box(x,y+.25,z+d/2-.25,w,.45,.5,paint,.035);
  }
  function lecture(x:number,title:string,number:number) {
    const w=32,d=40,z=-59;
    box(x,9,z,w,18,d,paint);
    // Green metal roof sits below the pale parapet visible in the aerial.
    box(x,18.45,z,w-1.1,.18,d-1.1,roof);parapet(x,z,w+1.8,d+1.3,18.2);
    for(let rib=0;rib<18;rib++)box(x-w/2+1+rib*1.75,18.57,z,.045,.05,d-2,roof);
    for(let floor=0;floor<4;floor++) {
      const y=2.3+floor*4.2;
      // Taller glazing on the end face, small paired classroom windows on the long sides.
      for(let col=0;col<4;col++)frontWindow(x-11.4+col*4.7,y,-38.91,3.6,2.7,col+floor);
      box(x,y+1.7,-38.67,w+.4,.5,.65,paint,.045);
      for(const side of [-1,1])for(let bay=0;bay<7;bay++) {
        const wz=-43-bay*4.7,sx=x+side*(w/2+.04);
        box(sx,y,wz,.12,2.45,2.5,reveal);
        box(sx+side*.08,y,wz,.08,2.22,2.24,bay%3===0?glassAlt:glass);
        for(const a of [-1,1])box(sx+side*.14,y,wz+a*1.12,.12,2.4,.075,frame);
        for(const a of [-1,1])box(sx+side*.14,y+a*1.11,wz,.12,.075,2.3,frame);
        box(sx+side*.14,y,wz,.12,2.25,.07,frame);
        box(sx+side*.15,y-1.3,wz,.35,.15,2.65,edge,.02);
      }
    }
    // Open stair tower: side cheeks + slabs rather than four opaque dark rectangles.
    const tx=x+8,tz=-36.4;
    box(tx,10,-38.67,6,20,.35,paint);
    for(const side of [-1,1])box(tx+side*2.7,10,tz,.6,20,5,paint);
    for(let floor=0;floor<4;floor++) {
      const fy=.55+floor*4.4;
      box(tx,fy,tz,5.1,.32,4.8,edge);
      box(tx,fy+1.05,-33.93,5.1,.75,.28,paint);
      box(tx,fy+1.55,-33.88,5.1,.065,.08,metal);
      for(let j=0;j<6;j++)box(tx-2.2+j*.88,fy+1.3,-33.88,.05,.48,.05,metal);
      // Readable diagonal underside, kept within the original tower volume.
      for(let step=0;step<7;step++)box(tx-1.9+step*.58,fy+.45+step*.48,-36.4,.6,.18,1.7,edge);
    }
    box(tx,18.65,-33.86,6,1.55,.4,paint);
    box(tx,20.3,tz,9,.6,7,edge,.055);
    label(title,`LECTURE HALL ${number}`,tx,18.65,-33.61,5.7);
    // A quiet stone base grounds the façade without new props on the road.
    box(x,.38,-38.77,w,.7,.4,stone);
  }
  lecture(-62,tr('GIẢNG ĐƯỜNG 2'),2);lecture(-27,tr('GIẢNG ĐƯỜNG 1'),1);

  // Headquarters: 3-storey gallery façade with central two-storey curtain glazing.
  // Owner review: 38 + 2 gap + 38 across unchanged outer edges x=-1..77.
  // Relative model units, not a surveyed measurement. Rebuild bays; never scale the whole model.
  const entryX=18;
  box(18,8.85,-48.7,38,17.7,18.6,paint);
  parapet(18,-48,38,22,18);
  box(18,18.34,-48,36,.14,18,roof);
  box(18,10.75,-49,15,21.5,11,paint);parapet(18,-49,18,13,21.8);
  for(const x of [14,22])frontWindow(x,20.05,-43.44,2.6,1.2);
  for(let floor=0;floor<3;floor++) {
    const y=2.8+floor*5.1;
    for(let col=0;col<7;col++) {
      const x=1.8+col*5.4;
      if(floor===0&&x>entryX-10&&x<entryX+10)continue; // Preserve the dark central opening.
      frontWindow(x,y,-39.32,4.15,3.5,col+floor);
    }
    if(floor===2)box(18,y+2.2,-37.55,38,.68,2.05,paint,.05);
    else for(const [lo,hi] of [[-1,8.8],[27.2,37]])box((lo+hi)/2,y+2.2,-37.55,hi-lo,.68,2.05,paint,.05);
    if(floor>0)for(const [cx,cw] of [[3.8,9.6],[32.2,9.6]]) {
      box(cx,y-1.3,-37.44,cw,.72,.26,paint);
      box(cx,y-.8,-37.35,cw,.07,.08,metal);
      for(let px=cx-cw/2;px<=cx+cw/2;px+=2)box(px,y-1.05,-37.35,.055,.5,.055,metal);
    }
  }
  // The photo shows a continuous dark grid: two outer sections with a lower center header.
  const topGlass=material('headquarters-curtain-dark-teal',0x36777e,.29,.24);
  box(entryX,8.1,-37.66,18.2,8.2,.42,paint,.035);
  for(let i=0;i<8;i++) {
    const x=entryX+(i-3.5)*1.99,bottom=4.47,top=i>=2&&i<6?11.15:11.63;
    box(x,(top+bottom)/2,-37.4,1.99,top-bottom,.15,frame);
    box(x,(top+bottom)/2,-37.285,1.84,top-bottom-.17,.085,i%4===1?glass:topGlass);
    for(const y of [6.31,8.85,10.4])box(x,y,-37.21,1.98,.088,.12,frame);
    if([1,3,6].includes(i)) {
      // The top of each open awning remains against the curtain wall.
      for(const [w,h,d,y,z,m] of [[1.67,2.13,.10,7.59,-37.04,frame],[1.49,1.94,.066,7.59,-36.97,glassAlt]] as const) {
        const g=new THREE.BoxGeometry(w,h,d).rotateX(-.16).translate(x,y,z),geometry=g.toNonIndexed();
        g.dispose();if(!batches.has(m))batches.set(m,[]);batches.get(m)!.push(geometry);
      }
    }
  }
  for(let i=0;i<=6;i++) {
    const x=-.6+i*6.2,inEntry=Math.abs(x-entryX)<8.5;
    if(inEntry)box(x,15.04,-37.1,.8,5.12,1.1,paint,.045);
    else box(x,8.8,-37.1,.8,17.6,1.1,paint,.045);
  }
  box(18,13.25,-36.84,17.6,2.7,.4,paint,.035);
  label(tr('NHÀ HIỆU BỘ'),'HEADQUARTER',18,13.25,-36.5,15.8);
  // Unobstructed entrance reference: a narrow black-stone flight and solid cheeks
  // below a thick projecting white slab; teal sidelights flank the dim vestibule.
  const entryStone=material('headquarters-dark-entry-stone',0x30383a,.85);
  entryStone.bumpMap=bump;entryStone.bumpScale=.022;
  const nosing=material('headquarters-step-edge',0x525b5c,.83);
  const soffit=material('headquarters-canopy-soffit',0x798580,.92);
  const vestibule=material('headquarters-vestibule-shadow',0x293633,.92);
  const portalX=entryX,roofZ=-36.8;
  box(portalX,4.16,roofZ,12.6,.69,5.1,paint,.035);
  box(portalX,3.793,roofZ-.04,12.25,.075,4.98,soffit,.012);
  const stairFront=-34.3,stairBack=-39.25,landing=1.22,stairW=8.15;
  for(let step=0;step<7;step++) {
    const top=.17+(step+1)*(landing-.17)/7,front=stairFront-step*.43,d=front-stairBack;
    box(portalX,(top+.17)/2,(front+stairBack)/2,stairW,top-.17,d,entryStone,.012);
    box(portalX,top-.015,front-.018,stairW-.06,.025,.044,nosing,.004);
  }
  for(const side of [-1,1]) {
    const cheekX=portalX+side*(stairW/2+.53),pierX=portalX+side*4.73;
    box(cheekX,.77,-36.75,1.12,1.2,4.78,entryStone,.028);
    box(cheekX,1.39,-36.75,1.16,.08,4.8,nosing,.018);
    box(pierX,2.5,-37.92,.85,2.65,.97,paint,.04);
    box(pierX+side*.61,2.075,-38.83,.54,3.47,1.34,paint,.025);
    frontWindow(portalX+side*8.72,2.18,-37.63,5.03,3.67,side+1);
  }
  // Exterior depth only: the closed inner glass and surrounding shadow are not playable.
  box(portalX,2.48,-39.34,8.94,2.67,.16,vestibule);
  for(const dx of [-2.24,0,2.24]) {
    box(portalX+dx,2.46,-39.23,2.16,2.4,.1,frame);
    box(portalX+dx,2.47,-39.15,2.005,2.24,.06,topGlass);
    box(portalX+dx,3.28,-39.1,2.03,.075,.07,frame);
  }

  // Photo-derived facade rhythm, rebuilt for the owner's equal-frontage review.
  // Hall x=39..77; front/back remain -40/-68. Deeper porch is carved inward.
  const hallX=58,hallW=38;
  const hallPier=material('auditorium-warm-piers',0xb6aaa1,.86);
  const hallShade=material('auditorium-porch-shadow',0x778581,.94);
  const hallStone=material('auditorium-wide-stair-stone',0x505957,.88);
  hallStone.bumpMap=bump;hallStone.bumpScale=.025;
  const canopyGlass=new THREE.MeshPhysicalMaterial({color:0x247c87,roughness:.3,metalness:.15,transparent:true,opacity:.78,side:THREE.DoubleSide});
  canopyGlass.name='auditorium-teal-canopy-glass';
  box(hallX,5.25,-56.8,hallW,10.5,22.4,paint);
  box(hallX,10.8,-54,hallW,.6,28,roof,.04);
  box(hallX,10.55,-40.2,hallW,.5,.4,paint,.025);
  box(hallX,9.95,-41,37.2,.65,.15,glass);
  box(hallX,7.7,-45.45,37.2,5.5,.2,glass);
  // Nine bays at their own pitch and fixed-thickness slats, instead of stretched five bays.
  for(let bay=0;bay<9;bay++){
    const x=41.6+bay*4.1;
    box(x,7.3,-41.1,3.68,4.35,.1,frame);
    for(let row=0;row<21;row++)box(x,5.2+row*.205,-40.78,3.72,.065,.23,paint,.008);
  }
  for(let bay=0;bay<=9;bay++)box(39.55+bay*4.1,7.5,-40.6,.35,5.5,.5,hallPier,.015);
  box(hallX,4.55,-42.85,37.4,.16,5.3,frame);
  box(hallX,4.65,-42.85,37.4,.09,5.3,canopyGlass,.008);
  for(let i=0;i<=24;i++)box(39.4+i*1.55,4.57,-42.85,.055,.1,5.3,metal);
  box(hallX,4.25,-43,37.2,.14,4.8,hallShade);
  for(const x of [39.5,48.75,58,67.25,76.5])box(x,2.7,-43.8,.55,3.15,.8,hallPier,.018);
  for(const x of [42.5,50.25,58,65.75,73.5])frontWindow(x,2.5,-45.51,3.4,2.7);
  for(let step=0;step<7;step++){
    const top=.23+(step+1)*.13,front=-40.02-step*.46,back=-45.6;
    box(hallX,(top+.17)/2,(front+back)/2,37.2,top-.17,front-back,hallStone,.008);
    box(hallX,top-.012,front-.014,37.16,.024,.034,metal,.003);
  }
  const hallCanvas=document.createElement('canvas');hallCanvas.width=1536;hallCanvas.height=192;
  const hg=hallCanvas.getContext('2d')!;hg.font='bold 138px Arial';hg.textAlign='center';hg.textBaseline='middle';hg.fillStyle='#bd2538';hg.fillText(tr('HỘI TRƯỜNG'),768,98);
  const hallMap=new THREE.CanvasTexture(hallCanvas);hallMap.colorSpace=THREE.SRGBColorSpace;
  const hallTitle=new THREE.Mesh(new THREE.PlaneGeometry(15,1.875),new THREE.MeshStandardMaterial({map:hallMap,transparent:true,alphaTest:.3,roughness:.65}));
  hallTitle.name='auditorium-raised-red-title';hallTitle.position.set(hallX,5.7,-40.12);group.add(hallTitle);
  for(const dx of [-5,0,5])box(hallX+dx,5.1,-40.35,.04,1,.06,metal);
  for(const [m,geometries] of batches) {
    const geometry=mergeGeometries(geometries,false)!;const mesh=new THREE.Mesh(geometry,m);
    mesh.name=m.name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    for(const g of geometries)g.dispose();
  }
  group.userData.sources=['02-mat-dung-hieu-bo.jpg','pictures/8ff9c631-ebf3-4a46-a4b0-13e680433b02.png','01-flycam-quang-truong.jpg'];
  group.userData.sources.push('pictures/hoitruong.jpeg','pictures/hoitruong2.jpeg');
  group.userData.simplified=['rear elevations','inaccessible interiors','equal frontages are an owner review ratio, not surveyed dimensions'];
  return group;
}
