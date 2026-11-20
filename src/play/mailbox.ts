import {tr} from '../i18n/index.ts';
import * as T from 'three';
import type {Collider} from '../types';
export const MAILBOX={x:-56,z:-22};
/** Local procedural prop; does not replace or modify any Asset Lab delivery. Faces the square (+X). */
/** Local procedural prop; does not replace or modify any Asset Lab delivery. Faces the square (+X). */
export function createMailbox(colliders:Collider[]){
 const root=new T.Group();root.name='campus-feedback-mailbox';root.position.set(MAILBOX.x,0,MAILBOX.z);root.rotation.y=Math.PI/2;
 const green=new T.MeshStandardMaterial({color:0x294f45,roughness:.72}),gold=new T.MeshStandardMaterial({color:0xc5a365,metalness:.35,roughness:.65}),dark=new T.MeshStandardMaterial({color:0x152d28}),stone=new T.MeshStandardMaterial({color:0xbab8ad});
 function box(w:number,h:number,d:number,x:number,y:number,z:number,m:T.Material){const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;root.add(mesh);return mesh;}
 box(1.8,.18,1.2,0,.09,0,stone);box(.22,1.2,.22,0,.75,0,gold);box(1.65,1.65,.7,0,2,0,green);
 box(1.9,.12,.9,0,2.88,0,gold);box(1.12,.12,.025,0,2.56,.365,dark);box(1.2,.025,.1,0,2.49,.39,gold);
 const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d')!;
 ctx.fillStyle='#fff5dc';ctx.fillRect(0,0,1024,512);ctx.strokeStyle='#b48c48';ctx.lineWidth=14;ctx.strokeRect(10,10,1004,492);
 ctx.fillStyle='#25483f';ctx.textAlign='center';ctx.font='700 72px "Segoe UI",sans-serif';ctx.fillText(tr('HỘP THƯ'),512,115);ctx.font='700 112px "Segoe UI",sans-serif';ctx.fillText(tr('GÓP Ý'),512,250);ctx.font='500 44px "Segoe UI",sans-serif';ctx.fillText(tr('Cùng làm campus tốt hơn'),512,345);ctx.font='600 42px "Segoe UI",sans-serif';ctx.fillText(tr('Chạm để viết'),512,425);
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
 const face=new T.Mesh(new T.PlaneGeometry(2.5,1.25),new T.MeshBasicMaterial({map:texture,toneMapped:false}));face.position.set(0,3.58,0);root.add(face);box(.1,.8,.1,0,3.1,-.08,gold);
 // Envelope on the door, legible without introducing an extra texture or asset.
 const line=new T.LineSegments(new T.BufferGeometry().setFromPoints([[-.5,2.2,.36],[0,1.85,.36],[0,1.85,.36],[.5,2.2,.36],[-.5,2.2,.36],[.5,2.2,.36],[-.5,2.2,.36],[-.5,1.6,.36],[-.5,1.6,.36],[.5,1.6,.36],[.5,1.6,.36],[.5,2.2,.36]].map(v=>new T.Vector3(v[0],v[1],v[2]))),new T.LineBasicMaterial({color:0xf5dfaa}));root.add(line);
 colliders.push({minX:MAILBOX.x-.65,maxX:MAILBOX.x+.65,minZ:MAILBOX.z-.95,maxZ:MAILBOX.z+.95,maxY:3,label:tr('Hộp thư góp ý')});
 return root;
}
