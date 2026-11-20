import {tr,tName} from '../i18n/index.ts';
import * as THREE from 'three';
import {cardTextLines} from './cardText';
import {createStickerBoardFrame} from './stickerBoardFrame';

export function createStickerBoard(){
  const board=new THREE.Group();board.name='festival-greetings-board';board.userData.interactable='greetings';board.userData.mockData=false;
  board.add(createStickerBoardFrame());
  const paper=['#f7e6ac','#efc9c3','#cfe0d6','#d9d1e8','#e3e7ba','#efcfad'];
  function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=w;c.height=h;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return {c,ctx:c.getContext('2d')!,t};}
  const backing=canvas(2800,1090),ctx=backing.ctx;
  const velvet=ctx.createLinearGradient(0,0,0,1090);velvet.addColorStop(0,'#641b31');velvet.addColorStop(.5,'#421625');velvet.addColorStop(1,'#641b31');
  ctx.fillStyle=velvet;ctx.fillRect(0,0,2800,1090);
  ctx.strokeStyle='#be9349';ctx.lineWidth=2;ctx.strokeRect(22,22,2756,1046);
  backing.t.needsUpdate=true;
  const title=canvas(2400,180);title.ctx.fillStyle='#641b31';title.ctx.fillRect(0,0,2400,180);
  title.ctx.textAlign='center';title.ctx.textBaseline='alphabetic';title.ctx.fillStyle='#fff0c2';title.ctx.font='700 112px "Segoe UI", sans-serif';
  // Center actual ink, including Vietnamese diacritics, within the taller header.
  const titleText=tr('BẢNG TRI ÂN · 20.11'),titleMetrics=title.ctx.measureText(titleText);
  title.ctx.fillText(titleText,1200,90+(titleMetrics.actualBoundingBoxAscent-titleMetrics.actualBoundingBoxDescent)/2);title.t.needsUpdate=true;
  const pinMat=new THREE.MeshStandardMaterial({color:0xe0ad42,roughness:.32,metalness:.45});
  const notes=Array.from({length:24},()=>({...canvas(1024,448),groups:[] as THREE.Group[]}));
  const caption=canvas(2600,62);
  // Keep writing independent of scene fog/exposure. High-resolution textures alone
  // cannot help small text: body glyphs also occupy more of each physical card.
  const ink=(map:THREE.Texture)=>new THREE.MeshBasicMaterial({map,toneMapped:false,fog:false});
  for(const side of [1,-1]){
    const face=new THREE.Group();face.rotation.y=side===1?0:Math.PI;board.add(face);
    const panel=new THREE.Mesh(new THREE.PlaneGeometry(28,10.9),ink(backing.t));panel.position.set(0,6.75,.23);face.add(panel);
    const heading=new THREE.Mesh(new THREE.PlaneGeometry(24,1.8),ink(title.t));heading.name='board-title';heading.position.set(0,11.35,.25);face.add(heading);
    const info=new THREE.Mesh(new THREE.PlaneGeometry(26,.62),ink(caption.t));info.position.set(0,1.68,.25);face.add(info);
    notes.forEach((note,i)=>{
      const holder=new THREE.Group();holder.name=`public-sticker-${i+1}`;holder.position.set((i%6-2.5)*4.58,8.9-Math.floor(i/6)*1.98,.29+i*.0002);holder.rotation.z=[-.018,.023,-.012,.018,-.023,.012][i%6];face.add(holder);note.groups.push(holder);
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(4.20,1.81),new THREE.MeshBasicMaterial({color:0x4b3829,transparent:true,opacity:.2,depthWrite:false}));shadow.position.set(.045,-.04,0);holder.add(shadow);
      const card=new THREE.Mesh(new THREE.PlaneGeometry(4.16,1.82),ink(note.t));card.position.z=.018;holder.add(card);
      const pin=new THREE.Mesh(new THREE.SphereGeometry(.05,8,6),pinMat);pin.position.set(0,.81,.07);holder.add(pin);
    });
  }
  function setPage(page:{greetings:{id:string;message:string;recipientName:string;signature:string;isSample?:boolean}[];page:number;pages:number;total:number}){
    const {ctx:c}=caption;c.fillStyle='#641b31';c.fillRect(0,0,2600,62);c.fillStyle='#fff0c2';c.textAlign='center';c.textBaseline='middle';c.font='600 40px "Segoe UI", sans-serif';
    c.fillText(page.total?tr('Lượt {0}/{1} · {2} lời chúc{3} · Tự đổi sau 10 giây · Chạm bảng để đọc đầy đủ',{0:page.page+1,1:page.pages,2:page.total,3:page.greetings.every(v=>v.isSample)?tr(' mẫu'):''}):tr('Chưa có lời chúc công khai · Mời bạn gửi một lời cảm ơn'),1300,32);caption.t.needsUpdate=true;
    board.userData.cardIds=page.greetings.map(c=>c.id);
    notes.forEach((note,i)=>{
      const card=page.greetings[i];for(const holder of note.groups){holder.visible=!!card;holder.userData.card=card;}
      if(!card)return;
      const c=note.ctx;c.fillStyle=paper[i%paper.length];c.fillRect(0,0,1024,448);c.fillStyle='rgba(255,255,255,.18)';c.fillRect(0,0,1024,5);
      c.textAlign='left';c.fillStyle='#50202c';c.font='700 52px "Segoe UI", sans-serif';cardTextLines(tName(card.recipientName||'')||tr('Gửi thầy cô VJU'),t=>c.measureText(t).width,940,1).forEach(t=>c.fillText(t,42,65));
      c.fillStyle='#181c20';c.font='700 78px "Segoe UI", sans-serif';cardTextLines(card.message,t=>c.measureText(t).width,940,3).forEach((t,j)=>c.fillText(t,42,164+j*86));
      c.fillStyle='#50202c';c.font='600 43px "Segoe UI", sans-serif';cardTextLines((tName(card.signature||'')||tr('Một người bạn VJU'))+(card.isSample?tr(' · mẫu'):''),t=>c.measureText(t).width,940,1).forEach(t=>c.fillText(t,42,422));
      note.t.needsUpdate=true;
    });
  }
  setPage({greetings:[],page:0,pages:1,total:0});
  return {group:board,setPage};
}
