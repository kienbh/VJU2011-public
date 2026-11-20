import * as THREE from 'three';
import {FontLoader} from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js';
import domFontData from './domSignFont';
const signFont=new FontLoader().parse(domFontData);
import { detailBatch, districtPlaster } from './districtFinishes';

/** Photo-based massing, not surveyed dimensions. Local front is +Z. */
export function createDomBlock(length: number, depth: number, towerSide: -1 | 1 = 1, displayName='DOM', entrySide: -1 | 1 = towerSide) {
  const group = new THREE.Group();
  const balconyGreen=new THREE.MeshStandardMaterial({color:0x628b5e,roughness:1});
  const height = 10.6, floors = 3;
  const white = districtPlaster(0xe4e7e1);
  const roof = new THREE.MeshStandardMaterial({ color: 0x397e7c, roughness: .48, metalness:.28 });
  const blue = districtPlaster(0x16829e);
  const ochre = districtPlaster(0xc39b64);
  const glass = new THREE.MeshStandardMaterial({ color: 0x42656c, roughness: .26, metalness:.18 });glass.name='dom-window-glass';
  const recess = new THREE.MeshStandardMaterial({ color: 0x667b7e, roughness: .9 });
  const box = (name: string, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
    mesh.name=name; mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  };
  // Recess room wall to create a real open gallery inside the approved footprint.
  box('dom-room-body',0,height/2,-.675,length,height,depth-1.35,white);
  const bayCount=Math.max(7,Math.round(length/4.2)),bay=length/bayCount,front=depth/2,wall=front-1.33,storey=height/floors;
  const entryIndex=entrySide===1?bayCount-3:2,entryX=-length/2+(entryIndex+.5)*bay,entryW=bay-.42;
  const details=detailBatch('dom-photo-corridors-and-portal');
  const frame=new THREE.MeshStandardMaterial({color:0xcbd4cf,roughness:.4,metalness:.5});
  const roofEdge=new THREE.MeshStandardMaterial({color:0x6c9690,roughness:.45,metalness:.32});
  const dark=new THREE.MeshStandardMaterial({color:0x34474a,roughness:.87});
  const stone=new THREE.MeshStandardMaterial({color:0x919b97,roughness:.9});
  for(let floor=0;floor<floors;floor++){
    const base=floor*storey;
    details.add(white,0,base+.14,front-.42,length,.22,1.85);
    for(let i=0;i<bayCount;i++){
      const x=-length/2+(i+.5)*bay,y=base+1.9;
      details.add(glass,x,y,-depth/2-.05,bay*.55,1.65,.1);
      for(const side of [-1,1])details.add(frame,x+side*bay*.275,y,-depth/2-.13,.07,1.75,.09);
      if(floor===0&&i===entryIndex)continue;
      for(const offset of [-bay*.22,bay*.22]){
        const dx=x+offset;
        details.add(frame,dx,base+1.45,wall+.08,.93,2.35,.13);
        details.add(glass,dx,base+1.45,wall+.16,.77,2.18,.04);
        details.add(frame,dx,base+1.45,wall+.2,.055,2.18,.07);
        details.add(frame,dx+.22,base+1.25,wall+.24,.035,.28,.05);
      }
    }
    if(floor>0)for(let i=floor;i<bayCount;i+=3){const x=-length/2+(i+.5)*bay;details.add(ochre,x,base+1.08,front+.3,1,.24,.38);for(let j=0;j<4;j++)details.add(balconyGreen,x-.35+j*.23,base+1.35,front+.3,.25,.32+(j%2)*.1,.3);}
    const segments=floor===0?[[-length/2,entryX-entryW/2],[entryX+entryW/2,length/2]]:[[-length/2,length/2]];
    for(const [a,b] of segments){
      details.add(floor===0?ochre:white,(a+b)/2,base+.64,front+.16,b-a,.72,.22);
      details.add(frame,(a+b)/2,base+1.15,front+.17,b-a,.055,.055);
      for(let x=a+.3;x<b;x+=1.3)details.add(frame,x,base+1.01,front+.17,.045,.25,.045);
    }
    for(let i=0;i<bayCount;i++)details.add(white,-length/2+(i+.5)*bay,base+storey-.16,front-.45,.18,.05,.18);
  }
  for(let i=0;i<=bayCount;i++)details.add(blue,-length/2+i*bay,height/2,front+.17,.32,height,.38);
  // Photo: deep dark entry, yellow canopy, shallow stone stairs, raised red name.
  details.add(dark,entryX,1.58,wall+.08,entryW,3.1,.13);
  for(const side of [-1,1])details.add(white,entryX+side*(entryW/2-.09),1.55,wall+.16,.13,3,.16);
  details.add(ochre,entryX,3.43,front+.12,entryW+1.05,.46,1.65);
  details.add(white,entryX,3.18,front+.12,entryW+.9,.06,1.6);
  for(let i=0;i<3;i++)details.add(stone,entryX,.06+i*.09,front+.79-i*.27,entryW+.65,.12,.32);
  details.add(frame,entryX,3.75,front+.35,entryW+.5,.045,.055);
  const letters=new TextGeometry(displayName,{font:signFont,size:.78,depth:.10,curveSegments:4,bevelEnabled:true,bevelThickness:.009,bevelSize:.008,bevelSegments:1});
  letters.computeBoundingBox();const width=letters.boundingBox!.max.x-letters.boundingBox!.min.x,fit=Math.min(1,(entryW+.8)/width);
  letters.scale(fit,fit,1);letters.translate(-width*fit/2,0,0);
  const sign=new THREE.Mesh(letters,new THREE.MeshStandardMaterial({color:0xbd1739,roughness:.46,metalness:.08}));
  sign.name='dom-raised-name-'+displayName;sign.position.set(entryX,3.76,front+.4);sign.castShadow=true;group.add(sign);
  // A shallow pitched roof gives the long teal roof its silhouette without decorative assets.
  const halfSpan=depth/2+.5, rise=1.25, slope=Math.atan2(rise,halfSpan);
  for(const side of [-1,1]) {
    const panel=box('dom-pitched-roof',0,height+.25+rise/2,side*halfSpan/2,length+1,.18,Math.hypot(halfSpan,rise),roof);
    panel.rotation.x=side*slope;
  }
  // Open stair tower with ochre landings and a thin blue vertical fin, kept within the footprint.
  const towerX=towerSide*(length/2-1.55);
  box('dom-stair-recess',towerX,height/2,depth/2+.22,3.1,height,.42,recess);
  for(let floor=0;floor<=floors;floor++) {
    box('dom-stair-landing',towerX,.24+floor*height/floors,depth/2+.49,3.35,.35,.98,ochre);
  }
  box('dom-stair-blue-fin',towerX-towerSide*1.25,(height+1.5)/2,depth/2+.55,.65,height+1.5,.33,blue);
  box('dom-stair-white-fin',towerX+towerSide*1.4,height/2,depth/2+.5,.28,height,.8,white);
  box('dom-stair-roof',towerX,height+1.05,depth/2-.3,3.9,.45,3.2,ochre);
  for(let floor=0;floor<floors;floor++){
    const fy=.24+floor*height/floors;
    details.add(frame,towerX,fy+1.08,depth/2+.9,2.65,.06,.055);
    for(let k=0;k<7;k++)details.add(frame,towerX-1.2+k*.4,fy+.68,depth/2+.9,.045,.8,.045);
  }
  // Thin seams and ridge keep long metal roofs legible without adding per-seam draw calls.
  details.add(roofEdge,0,height+1.54,0,length+1,.095,.13);
  for(const side of [-1,1])details.add(white,0,height+.23,side*(depth/2+.48),length+.9,.23,.13);
  group.add(details.finish());
  group.userData={floors,height,length,depth,towerSide,displayName,entryX,provisionalDimensions:true};
  // Include the projecting landings; roof overhangs are above player head height.
  return {group,footprint:{minX:-length/2,maxX:length/2,minZ:-depth/2,maxZ:depth/2+.98}};
}
