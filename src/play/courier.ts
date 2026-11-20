import {tr} from '../i18n/index.ts';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {createRemoteAvatar} from '../player/remoteAvatar';
import {DEFAULT_APPEARANCE} from '../player/appearance';
import {currentParticipant} from '../greetings/participation';
import type {Collider} from '../types';
import './courier.css';

export const COURIER={x:207,z:81.5};
type Options={scene:T.Scene;colliders:Collider[];canUse():boolean;pause(v:boolean):void;sfx?(name:string,at?:{x:number;z:number}):void};
const GOODS=[['controller',tr('Tay cầm game')],['robot',tr('Robot đồ chơi')],['duck',tr('Vịt đồ chơi')],['headphones','Tai nghe'],['puzzle',tr('Khối xếp hình')],['book',tr('Sổ tay')]] as const;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Fictional, session-local parcel pickup. No shopping, order lookup or server writes. */
/** Fictional, session-local parcel pickup. No shopping, order lookup or server writes. */
export function mountCourier(o:Options){
 const root=new T.Group();root.name='secondary-gate-courier';root.position.set(COURIER.x,0,COURIER.z);o.scene.add(root);
 const parts=new Map<number,T.BufferGeometry[]>();
 function part(geo:T.BufferGeometry,c:number,x:number,y:number,z:number){geo.translate(x,y,z);const a=parts.get(c)||[];a.push(geo);parts.set(c,a);}
 const box=(c:number,x:number,y:number,z:number,w:number,h:number,d:number)=>part(new T.BoxGeometry(w,h,d),c,x,y,z);
 const ball=(c:number,x:number,y:number,z:number,w:number,h:number,d:number)=>{const g=new T.SphereGeometry(1,10,7);g.scale(w,h,d);part(g,c,x,y,z);};
 const orange=0xee4d2d,cream=0xf3e2bd,dark=0x31453f;
 box(0x547c81,0,.09,0,5.2,.09,3.2);
 for(const x of [-2.48,2.48])box(cream,x,.14,0,.1,.02,3.1);
 for(const z of [-1.48,1.48])box(cream,0,.14,z,5,.02,.1);
 for(let i=0;i<5;i++){
  const x=-1.95+(i%3)*1.45,z=i<3?.65:-.5,h=.35+(i%2)*.15;
  box(i%2?0xc4925f:0xd7ae7a,x,.18+h/2,z,.8,h,.6);box(cream,x,.185+h,z,.13,.014,.61);
  box(0xfff8e7,x+.2,.195+h,z+.08,.22,.016,.24);
 }
 // Familiar silhouettes: a controller, robot, rubber duck, headphones, puzzle and notebook.
 ball(dark,-1.8,.3,-.9,.48,.12,.22);for(const x of [-2.13,-1.47])ball(dark,x,.24,-.99,.17,.15,.2);
 box(cream,-2,.43,-.91,.18,.02,.05);box(cream,-2,.435,-.91,.05,.02,.18);
 for(const [x,z,c] of [[-1.65,-.88,0xd56a70],[-1.52,-.97,0x6998c1]] as const)ball(c,x,.43,z,.04,.02,.04);
 box(0x8faab7,-.65,.63,.65,.4,.48,.27);box(orange,-.65,1,.65,.42,.27,.29);
 for(const x of [-.76,-.54]){box(dark,x,1.03,.49,.055,.045,.025);box(dark,x,.29,.62,.13,.22,.16);}
 for(const x of [-.94,-.36])box(0x8faab7,x,.65,.65,.1,.38,.12);
 ball(0xf1ca55,.2,.33,-.85,.26,.2,.32);ball(0xf1ca55,.2,.58,-1,.17,.17,.18);ball(orange,.2,.54,-1.18,.13,.05,.1);for(const x of [.12,.28])ball(dark,x,.62,-1.13,.025,.025,.025);
 const arch=new T.TorusGeometry(.29,.045,6,16,Math.PI);arch.rotateX(-.2);part(arch,dark,1.3,.31,-.85);for(const x of [1.02,1.58])box(orange,x,.25,-.85,.14,.22,.19);
 for(let x=0;x<3;x++)for(let z=0;z<3;z++)box([0xd76f67,0xe1bd54,0x78a18a][(x+z)%3],1.55+x*.16,.3,.7+z*.16,.145,.3,.145);
 box(0xab686e,-.7,.23,-.9,.53,.12,.7);box(cream,-.7,.24,-1.26,.49,.075,.02);
 for(const [color,geometries] of parts){const normalized=geometries.map(g=>{const n=g.index?g.toNonIndexed():g;n.deleteAttribute('uv');return n;});const merged=mergeGeometries(normalized)!;const m=new T.Mesh(merged,new T.MeshLambertMaterial({color}));m.receiveShadow=true;root.add(m);for(const g of new Set([...geometries,...normalized]))g.dispose();}
 const npc=createRemoteAvatar(tr('Anh giao hàng · NPC'),{...DEFAULT_APPEARANCE,palette:2});npc.root.name='courier-npc';root.add(npc.root);
 const old=new T.Color('#cfaa58'),replacement=new T.Color(orange);
 npc.root.traverse(obj=>{if(obj instanceof T.Mesh){const colors=obj.geometry.getAttribute('color');if(colors){for(let i=0;i<colors.count;i++)if(Math.abs(colors.getX(i)-old.r)<.001&&Math.abs(colors.getY(i)-old.g)<.001&&Math.abs(colors.getZ(i)-old.b)<.001)colors.setXYZ(i,replacement.r,replacement.g,replacement.b);colors.needsUpdate=true;}}});
 const helmet=new T.Mesh(new T.SphereGeometry(.31,12,8,0,Math.PI*2,0,Math.PI/2),new T.MeshLambertMaterial({color:orange}));helmet.position.y=2.05;npc.root.add(helmet);
 npc.update(new T.Vector3(0,1.74,2.1),0,0,0,false,false,true);
 collidersPush();
 function collidersPush(){o.colliders.push({minX:COURIER.x-2.7,maxX:COURIER.x+2.7,minZ:COURIER.z-1.7,maxZ:COURIER.z+1.7,maxY:1.4,label:tr('Thảm hàng bên cổng phụ')},{minX:COURIER.x-.5,maxX:COURIER.x+.5,minZ:COURIER.z+1.6,maxZ:COURIER.z+2.6,maxY:2.5,label:tr('Anh giao hàng (NPC)')});}
 const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d')!;ctx.fillStyle='#fff3df';ctx.fillRect(0,0,1024,256);ctx.fillStyle='#c7472a';ctx.textAlign='center';ctx.font='700 66px "Segoe UI",sans-serif';ctx.fillText(tr('NHẬN HÀNG · SHOPEE'),512,98);ctx.fillStyle='#344f44';ctx.font='42px "Segoe UI",sans-serif';ctx.fillText(tr('Ghé anh lấy món đồ của em nhé!'),512,184);
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;const sign=new T.Mesh(new T.PlaneGeometry(3,.75),new T.MeshBasicMaterial({map:texture,toneMapped:false,side:T.DoubleSide}));sign.rotation.y=Math.PI;sign.position.set(0,.58,-1.6);root.add(sign);
 const dialog=document.createElement('dialog');dialog.className='play-dialog courier-dialog';dialog.setAttribute('aria-labelledby','courier-title');document.body.append(dialog);
 let step=0,name='',code='',gift:string=GOODS[0][0],restore:HTMLElement|null=null;
 const parcelCode=()=>`VJU-${String(crypto.getRandomValues(new Uint32Array(1))[0]%10000).padStart(4,'0')}`;
 function close(){dialog.close();o.pause(!!document.querySelector('dialog[open]'));restore?.focus();}
 function render(){
  const goods=GOODS.find(([id])=>id===gift)![1];
  dialog.innerHTML=`<header><h2 id="courier-title">${tr('Anh giao hàng')}</h2><button type="button" data-close aria-label="${tr('Đóng nhận hàng')}">×</button></header><div class="play-body"><p class="courier-note">${tr('Tiểu cảnh vui · Tên và mã đơn giả lập, không tra cứu đơn hàng thật.')}</p>${step===0?`<p class="courier-line"><b>${tr('Anh giao hàng')}</b>${tr('Chào em! Em tới lấy hàng à?')}</p><button data-start>${tr('Anh ơi, cho em lấy hàng.')}</button>`:step===1?`<p class="courier-line"><b>${tr('Anh giao hàng')}</b>${tr('Em tên gì, mã đơn bao nhiêu?')}</p><form><label>${tr('Tên trong trò chơi')}<input name="courier-name" maxlength="40" required value="${esc(name)}" autocomplete="off"></label><label>${tr('Mã đơn giả lập')}<input name="courier-code" maxlength="20" required value="${esc(code)}" autocomplete="off" spellcheck="false" minlength="3" pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*"></label><label>${tr('Món đồ trong gói hàng')}<select name="courier-gift">${GOODS.map(([id,label])=>`<option value="${id}" ${gift===id?'selected':''}>${label}</option>`).join('')}</select></label><button type="submit">${tr('Em gửi anh tên và mã đơn ạ.')}</button></form>`:step===2?`<p class="courier-line courier-self"><b>${tr('Bạn')}</b>${tr('Em là {0}, mã đơn {1} ạ.',{0:esc(name),1:esc(code)})}</p><p class="courier-line"><b>${tr('Anh giao hàng')}</b>${tr('Của em đây. {0} của em nhé!',{0:esc(goods)})}</p><button data-thanks>${tr('Dạ em cảm ơn anh.')}</button>`:`<p class="courier-line courier-self"><b>${tr('Bạn')}</b>${tr('Dạ em cảm ơn anh.')}</p><p class="courier-line"><b>${tr('Anh giao hàng')}</b>${tr('Không có gì, chúc em một ngày vui!')}</p><p class="courier-received">${tr('Đã nhận {0} trong tiểu cảnh.',{0:esc(goods.toLowerCase())})}</p><button data-close>${tr('Tiếp tục dạo campus')}</button>`}</div>`;
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
  dialog.querySelector('[data-start]')?.addEventListener('click',()=>{step=1;render();});
  dialog.querySelector('[data-thanks]')?.addEventListener('click',()=>{step=3;render();});
  const form=dialog.querySelector('form');form?.addEventListener('input',()=>{const data=new FormData(form);name=String(data.get('courier-name')||'');code=String(data.get('courier-code')||'');gift=String(data.get('courier-gift')||GOODS[0][0]);});
  form?.addEventListener('submit',e=>{e.preventDefault();if(!name.trim()){form.querySelector<HTMLInputElement>('input')!.focus();return;}name=name.trim();code=code.trim();step=2;o.sfx?.('bell',COURIER);render();});
  // Focus the dialogue, not an input, so phone keyboards open only when requested.
  const body=dialog.querySelector<HTMLElement>('.play-body')!;body.tabIndex=-1;body.focus();
 }
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 return {root,isOpen:()=>dialog.open,open(){if(dialog.open||!o.canUse())return;step=0;name=(currentParticipant()?.mode==='anonymous'?tr('Bạn sinh viên'):currentParticipant()?.name||tr('Bạn sinh viên')).slice(0,40);code=parcelCode();gift=GOODS[0][0];restore=document.activeElement as HTMLElement;o.pause(true);dialog.showModal();render();},state:()=>({open:dialog.open,step}),close};
}
