import {requestTimeout} from '../browserCompat';
import {tr,trServer} from '../i18n/index.ts';
import * as T from 'three';
import type {WalkController} from '../player/WalkController';
import type {Collider} from '../types';
import {createVisitorAvatar} from '../player/visitorAvatar';
import {createTeaScenery,TEA,TEA_SEATS} from './teaScenery';
import './tea.css';
import type {StageSeat} from '../festival/stageLayout';
import {createSeatedOrbit} from './seatedOrbit';
type Member={id:string;name:string;seat:number;message:string;messageId:string|null};
type Snapshot={self:string|null;members:Member[]};
type Options={scene:T.Scene;camera:T.PerspectiveCamera;walk:WalkController;colliders:Collider[];remoteAvatars?:boolean;canUse():boolean;pause(v:boolean):void;announce(s:string):void;sfx?(name:string,at?:{x:number;z:number}):void};
export type SocialCorner={id:string;title:string;action:string;centre:{x:number;z:number};seats:StageSeat[];create(colliders:Collider[]):T.Group;extras:[string,string][]};
export function mountTeaCorner(o:Options,config?:SocialCorner){
 const id=config?.id||'tea',endpoint='/api/'+id,centre=config?.centre||TEA,seats=config?.seats||TEA_SEATS,title=config?.title||tr('Trà đá dưới tán bàng');
 const orbit=createSeatedOrbit(o.camera);
 const scenery=(config?.create||createTeaScenery)(o.colliders);o.scene.add(scenery);
 const viewport=document.querySelector<HTMLElement>('#viewport')!,button=document.createElement('button');button.className='tea-sit';button.dataset.corner=id;button.hidden=true;viewport.append(button);
 const panel=document.createElement('section');panel.className='tea-panel';panel.dataset.corner=id;panel.hidden=true;panel.setAttribute('aria-label',title);
 panel.innerHTML=`<header><strong>${tr('Trà đá dưới tán bàng')}</strong><button type="button" data-leave>${tr('Đứng dậy')}</button></header><form><label class="tea-input-label" for="tea-message">${tr('Trò chuyện với người cùng bàn')}</label><div class="tea-compose"><input id="tea-message" maxlength="160" autocomplete="off" placeholder="${tr('Nói gì với mọi người…')}" required><button type="submit">${tr('Gửi')}</button></div></form><div class="tea-extras"><button type="button" data-say="${tr('Nhấp một ngụm trà đá 🍵')}">${tr('Uống trà')}</button><button type="button" data-say="${tr('Tách một hạt hướng dương 🌻')}">${tr('Cắn hạt')}</button><label><input type="checkbox" data-mute> ${tr('Ẩn chat')}</label></div><p class="tea-status" role="status"></p>`;
 panel.querySelector('header strong')!.textContent=title;
 panel.querySelector('input')!.id=id+'-message';panel.querySelector('label')!.htmlFor=id+'-message';
 if(config){const extras=panel.querySelector('.tea-extras')!;extras.querySelectorAll('[data-say]').forEach(b=>b.remove());for(const [label,text] of config.extras){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.say=text;extras.insertBefore(b,extras.querySelector('label'));}}
 const input=panel.querySelector<HTMLInputElement>('.tea-compose input')!;
 {
  const details=document.createElement('div');details.className='corner-chat-details';
  while(panel.children.length>1)details.append(panel.children[1]);panel.append(details);
  const fold=document.createElement('button');fold.type='button';fold.dataset.fold='';details.id=id+'-chat-details';fold.setAttribute('aria-controls',details.id);
  const setFold=(hidden:boolean)=>{details.hidden=hidden;fold.textContent=hidden?tr('Mở chat'):tr('Thu gọn');fold.setAttribute('aria-expanded',String(!hidden));};
  fold.onclick=()=>{setFold(!details.hidden);if(!details.hidden)input.focus();};setFold(matchMedia('(max-width:600px)').matches);panel.querySelector('header')!.insertBefore(fold,panel.querySelector('[data-leave]'));
 }
 const fit=()=>{const v=window.visualViewport;panel.style.setProperty('--corner-keyboard',`${v?Math.max(0,innerHeight-v.height-v.offsetTop):0}px`);panel.style.setProperty('--corner-height',`${v?.height??innerHeight}px`);};
 fit();window.visualViewport?.addEventListener('resize',fit);window.visualViewport?.addEventListener('scroll',fit);
 viewport.append(panel);
 const announcements=document.createElement('div');announcements.className='tea-announcements';announcements.setAttribute('role','log');announcements.setAttribute('aria-live','polite');viewport.append(announcements);
 const actors=new Map<string,{avatar:ReturnType<typeof createVisitorAvatar>;member:Member}>(),bubbles=new Map<string,HTMLElement>(),seen=new Set<string>();
 let snapshot:Snapshot={self:null,members:[]},lease:string|null=null,seat:number|null=null,joining=false,sending=false,polling=false,nextPoll=0,lastSuccess=0,near=false,muted=false,generation=0,nearest=-1;
 const status=(s:string)=>{panel.querySelector('.tea-status')!.textContent=s;};
 async function request(body?:unknown){
  const r=await fetch(endpoint,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:requestTimeout(6000)});
  const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||tr('Chưa kết nối được góc trà đá.')),{code:data.code});return data as Snapshot;
 }
 function dispose(id:string){const actor=actors.get(id);if(actor){o.scene.remove(actor.avatar.root);actor.avatar.root.traverse(obj=>{const m=obj as T.Mesh;if(m.geometry)m.geometry.dispose();for(const material of m.material?Array.isArray(m.material)?m.material:[m.material]:[]){for(const value of Object.values(material))if(value instanceof T.Texture)value.dispose();material.dispose();}});actors.delete(id);}bubbles.get(id)?.remove();bubbles.delete(id);}
 function clear(){for(const id of new Set([...actors.keys(),...bubbles.keys()]))dispose(id);}
 function adopt(data:Snapshot){
  snapshot=data;lastSuccess=Date.now();
  const ids=new Set(data.members.map(p=>p.id));for(const id of new Set([...actors.keys(),...bubbles.keys()]))if(!ids.has(id))dispose(id);
  for(const m of data.members){
   if(!seats[m.seat])continue;
   if(m.id!==data.self&&o.remoteAvatars!==false){
    if(!actors.has(m.id)){const avatar=createVisitorAvatar();avatar.setName(m.name);avatar.setStyle(m.seat%3);o.scene.add(avatar.root);actors.set(m.id,{avatar,member:m});}
    actors.get(m.id)!.member=m;
   }else if(actors.has(m.id))dispose(m.id);
   if(!bubbles.has(m.id)){const bubble=document.createElement('div');bubble.className='tea-bubble';viewport.append(bubble);bubbles.set(m.id,bubble);}
   const bubble=bubbles.get(m.id)!;bubble.textContent=m.message;bubble.hidden=!m.message||muted;
   if(m.messageId&&!seen.has(m.messageId)){seen.add(m.messageId);if(!muted)announcements.textContent=`${m.name}: ${m.message}`;if(seen.size>100)seen.delete(seen.values().next().value!);}
  }
 }
 function leave(message=''){
  const old=lease;generation++;lease=null;seat=null;orbit.set(null);panel.hidden=true;document.body.classList.remove('tea-seated');o.walk.standUp();o.pause(false);nextPoll=0;
  if(old)void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',lease:old}),keepalive:true}).catch(()=>{});
  clear();if(message)o.announce(message);button.focus({preventScroll:true});
 }
 async function join(){
  if(joining||nearest<0||!o.canUse())return;joining=true;button.disabled=true;const selected=nearest,current=++generation;
  try{
   const data=await request({action:'join',seat:selected});
   if(current!==generation)return;
   lease=data.self;
   if(!lease||!o.walk.sitDown(seats[selected])){leave(tr('Hãy tới gần phía trước ghế rồi thử lại.'));return;}
   seat=selected;orbit.set(seats[selected]);if(!config)o.sfx?.('tea');if(config)orbit.step(-1);o.pause(true);panel.hidden=false;document.body.classList.add('tea-seated');status(tr('Lời chat tự ẩn sau 12 giây, không lưu lịch sử.'));adopt(data);nextPoll=Date.now()+3000;
  }catch(e){o.announce(trServer((e as Error).message));}finally{joining=false;button.disabled=false;}
 }
 async function say(text:string){
  if(!lease||sending)return;sending=true;const current=generation;panel.querySelectorAll<HTMLButtonElement>('form button,[data-say]').forEach(b=>b.disabled=true);
  try{const data=await request({action:'say',lease,text,id:crypto.randomUUID()});if(current!==generation)return;adopt(data);input.value='';status(tr('Đã gửi · Lời chat tự ẩn sau 12 giây.'));}
  catch(e){if(current===generation){status(trServer((e as Error).message));if((e as {code?:string}).code==='LEFT_ROOM')leave(trServer((e as Error).message));}}
  finally{sending=false;panel.querySelectorAll<HTMLButtonElement>('form button,[data-say]').forEach(b=>b.disabled=false);}
 }
 button.onclick=()=>void join();panel.querySelector('[data-leave]')!.addEventListener('click',()=>leave());
 panel.querySelector('form')!.onsubmit=e=>{e.preventDefault();void say(input.value.trim());};
 panel.querySelectorAll<HTMLElement>('[data-say]').forEach(b=>b.onclick=()=>void say(b.dataset.say!));
 panel.querySelector<HTMLInputElement>('[data-mute]')!.onchange=e=>{muted=(e.target as HTMLInputElement).checked;announcements.textContent='';if(muted)bubbles.forEach(b=>b.hidden=true);};
 window.addEventListener('keydown',e=>{if(e.code==='Escape'&&seat!==null){e.preventDefault();e.stopImmediatePropagation();leave();}else if(e.code==='KeyE'&&!e.repeat&&nearest>=0&&seat===null&&!(e.target as HTMLElement)?.closest('input,textarea,select')){e.preventDefault();e.stopImmediatePropagation();void join();}},true);
 window.addEventListener('pagehide',()=>{if(lease)void fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',lease}),keepalive:true});});
 const project=new T.Vector3(),zero=new T.Vector3();
 return {leave,focus:()=>!button.hidden&&nearest>=0?seats[nearest]:null,isBusy:()=>seat!==null||joining,state:()=>({seat,members:snapshot.members.length,lease:!!lease}),update(dt:number){
  scenery.userData.animate?.(dt,o.walk.position,document.hidden||document.body.classList.contains('reduced-motion'));
  near=Math.hypot(o.walk.position.x-centre.x,o.walk.position.z-centre.z)<24;button.hidden=true;nearest=-1;
  const active=o.canUse(),now=Date.now();
  if(!near){if(seat!==null)leave();clear();return;}
  if(seat!==null){
   orbit.update();
    if(now-lastSuccess>16000){leave(tr('Mất kết nối khu ngồi. Bạn có thể chọn ghế lại.'));return;}
  }else if(active&&!joining){
   const available=seats.map((s,i)=>({i,d:Math.hypot(s.x-o.walk.position.x,s.z-o.walk.position.z)})).filter(s=>s.d<2.05&&!snapshot.members.some(m=>m.seat===s.i)).sort((a,b)=>a.d-b.d);
   nearest=available[0]?.i??-1;button.hidden=nearest<0;button.textContent=(matchMedia('(pointer:coarse)').matches?'':'E · ')+tr('{0} · Chỗ {1}',{0:config?.action||tr('Ngồi uống trà'),1:nearest+1});
  }
  if((active||seat!==null)&&now>=nextPoll&&!polling){
   polling=true;nextPoll=now+3000;const current=generation;
   void request(lease?{action:'pulse',lease}:undefined).then(data=>{if(current===generation)adopt(data);}).catch(e=>{if(current!==generation)return;if(seat!==null){status(trServer((e as Error).message));if(e.code==='LEFT_ROOM')leave(e.message);}else clear();}).finally(()=>polling=false);
  }
  for(const {avatar,member} of actors.values()){
   const s=seats[member.seat];avatar.root.visible=active||seat!==null;avatar.update(new T.Vector3(s.x,s.eyeY,s.z),zero,s.heading,dt,true,true);
  }
  for(const m of snapshot.members){const bubble=bubbles.get(m.id);if(!bubble)continue;const s=seats[m.seat];if(!s)continue;
   project.set(s.x,s.eyeY+1.15,s.z).project(o.camera);bubble.hidden=muted||!m.message||(!active&&seat===null)||now-lastSuccess>12000||project.z< -1||project.z>1||Math.abs(project.x)>1||Math.abs(project.y)>1;
   const half=(bubble.offsetWidth||Math.min(270,viewport.clientWidth*.75))/2;
   bubble.style.left=`${T.MathUtils.clamp((project.x*.5+.5)*viewport.clientWidth,half+8,viewport.clientWidth-half-8)}px`;bubble.style.top=`${(-project.y*.5+.5)*viewport.clientHeight}px`;
  }
 }};
}
