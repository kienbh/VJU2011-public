import {requestTimeout} from '../browserCompat';
import {tr} from '../i18n/index.ts';
import type {BallFrame} from '../../server/footballWorld.mjs';
import * as T from 'three';
import type {Appearance} from '../player/appearance';
import {createRemoteAvatar} from '../player/remoteAvatar';
import {phoneScreen} from '../mobile';
import './presence.css';
import {mountNearbyChat,type Speech} from './nearbyChat';
type Pose={x:number;y:number;z:number;heading:number;state:'idle'|'walking'|'seated';groundSeat:boolean;appearance:Appearance};
type Peer=Pose&{id:string;name:string;speech:Speech|null};
type Options={tab:string;onFootball?(frame:BallFrame,self:string):void;scene:T.Scene;camera:T.Camera;pose():Pose;active():boolean;canChat():boolean;pause(value:boolean):void};
export function mountPresence(o:Options){
 const badge=document.createElement('span');badge.className='campus-presence';badge.textContent=tr('● Đang kết nối');badge.title=tr('Người đang ở campus; một tài khoản chỉ có một nhân vật. Chỉ hiện người ở gần để giữ cảnh mượt.');badge.setAttribute('aria-label',tr('Số người đang ở campus'));document.querySelector('.masthead')?.append(badge);
 const actors=new Map<string,{avatar:ReturnType<typeof createRemoteAvatar>;peer:Peer;position:T.Vector3;heading:number;style:string}>();
 const tab=o.tab;let present=false,busy=false,last=0,seq=0,generation=0,lastSuccess=0,failed=0,request:AbortController|undefined;
 let lastRttMs:number|null=null,lastStatus:number|null=null;
 const chat=mountNearbyChat({camera:o.camera,active:o.active,canOpen:o.canChat,pause:o.pause,async send(text,id){
  if(!present||!o.active()||document.hidden)throw Error('Hãy vào campus để trò chuyện.');
  const r=await fetch('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'say',tab,text,id}),signal:requestTimeout(5000)}).catch(()=>{throw Error('Chưa gửi được. Lời nhắn vẫn còn để thử lại.');});
  const d=await r.json();if(!r.ok)throw Error(d.error||tr('Chưa gửi được. Vui lòng thử lại.'));return d.speech;
 }});
 const remove=(id:string)=>{actors.get(id)?.avatar.dispose();actors.delete(id);};
 const clear=()=>{for(const id of actors.keys())remove(id);};
 function leave(){generation++;request?.abort();clear();chat.clear();if(!present)return;present=false;navigator.sendBeacon('/api/presence',new Blob([JSON.stringify({action:'leave',tab,seq:++seq})],{type:'application/json'}));}
 function adopt(peers:Peer[],selfSpeech:Speech|null){
  const selected=peers.slice(0,phoneScreen.matches?6:16),ids=new Set(selected.map(p=>p.id));for(const id of actors.keys())if(!ids.has(id))remove(id);
  for(const peer of selected){const style=JSON.stringify(peer.appearance)+peer.name;let a=actors.get(peer.id);
   if(a&&a.style!==style){remove(peer.id);a=undefined;}
   if(!a){const avatar=createRemoteAvatar(peer.name,peer.appearance);avatar.root.userData.peer=peer.id;o.scene.add(avatar.root);a={avatar,peer,position:new T.Vector3(peer.x,peer.y,peer.z),heading:peer.heading,style};actors.set(peer.id,a);}
   a.peer=peer;
  }
  chat.adopt([{id:'self',name:tr('Bạn'),speech:selfSpeech},...selected]);
 }
 async function sync(){
  const active=!document.hidden&&document.body.dataset.ready==='true'&&o.active();badge.hidden=!active;
  if(!active){leave();last=0;return;}
  const pose=o.pose(),interval=failed?Math.min(8000,1000*2**failed):Math.hypot(pose.x-167,pose.z-8)<45||pose.state==='walking'||actors.size?250:750;
  if(busy||Date.now()-last<interval)return;busy=true;last=Date.now();present=true;const epoch=generation;
  request=new AbortController();const timeout=setTimeout(()=>request?.abort(),4000);
  const requestStart=performance.now();
  lastStatus=null;
  try{
   const r=await fetch('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'pulse',tab,seq:++seq,pose,limit:phoneScreen.matches?6:16}),signal:request.signal});
   lastStatus=r.status;if(!r.ok)throw Error();const d=await r.json();lastRttMs=Math.round(performance.now()-requestStart);if(epoch!==generation)return;
   if(!Array.isArray(d.peers)||!Number.isInteger(d.online))throw Error();
   lastSuccess=Date.now();failed=0;if(d.football&&d.self)o.onFootball?.(d.football,d.self);adopt(d.peers,d.selfSpeech);badge.textContent=tr('● {0} đang ở campus',{0:d.online});badge.setAttribute('aria-label',tr('{0} người ở campus, hiển thị {1} người ở gần',{0:d.online,1:actors.size}));
  }catch{if(epoch===generation){lastRttMs=null;failed++;badge.textContent=tr('● Đang kết nối lại');}}
  finally{clearTimeout(timeout);busy=false;}
 }
 const timer=setInterval(()=>void sync(),100),visibility=()=>{if(document.hidden)leave();else{last=0;failed=0;}void sync();};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);
 async function kickFootball(id:string,heading:number):Promise<{football:BallFrame;self:string}>{
  if(!present||!o.active()||document.hidden)throw Error('Hãy vào campus để sút bóng.');
  const epoch=generation,body=JSON.stringify({action:'footballKick',tab,id,seq:++seq,pose:{...o.pose(),heading:Math.atan2(Math.sin(heading),Math.cos(heading))}});
  // Retry only transport failures with the same ID and sequence; never create a second shot.
  for(let attempt=0;attempt<2;attempt++){
   let r:Response;
   try{r=await fetch('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},body,signal:requestTimeout(2500)});}
   catch{if(attempt===0)continue;throw Error('Chưa xác nhận được cú sút. Đang kết nối lại.');}
   const d=await r.json();if(!r.ok)throw Error(d.error||tr('Chưa thể sút. Hãy thử lại.'));
   if(epoch!==generation)throw Error('Bạn đã rời sân bóng.');last=0;return d;
  }
  throw Error('Chưa kết nối được sân bóng.');
 }
 return {diagnostics:()=>({lastRttMs,lastStatus,failures:failed,inFlight:busy,lastSuccessAgeMs:lastSuccess?Date.now()-lastSuccess:null,visiblePeers:actors.size}),kickFootball,isChatOpen:chat.isOpen,update(dt:number,reduced:boolean){
  if(!o.active()||document.hidden){clear();chat.clear();return;}
  if(Date.now()-lastSuccess>6000){clear();chat.adopt([]);}
  const max=phoneScreen.matches?6:16;while(actors.size>max)remove([...actors.keys()].at(-1)!);
  const self=o.pose();
  for(const a of actors.values()){
   const p=a.peer,target=new T.Vector3(p.x,p.y,p.z),distance=a.position.distanceTo(target),before=a.position.clone();
   if(distance>12)a.position.copy(target);else a.position.lerp(target,1-Math.exp(-dt*12));
   a.heading+=Math.atan2(Math.sin(p.heading-a.heading),Math.cos(p.heading-a.heading))*(1-Math.exp(-dt*15));
   a.avatar.update(a.position,a.heading,p.state==='walking'&&distance<12?a.position.distanceTo(before):0,dt,p.state==='seated',p.groundSeat,reduced);
   a.avatar.root.visible=Math.hypot(self.x-a.position.x,self.z-a.position.z)>.65;
  }
  chat.update([{id:'self',position:new T.Vector3(self.x,self.y,self.z),visible:true},...[...actors].map(([id,a])=>({id,position:a.position,visible:a.avatar.root.visible&&Math.hypot(self.x-a.position.x,self.z-a.position.z)<=12}))]);
 },state:()=>({visible:actors.size,limit:phoneScreen.matches?6:16,connected:Date.now()-lastSuccess<6000,peers:[...actors.values()].map(a=>({name:a.peer.name,state:a.peer.state,position:a.position.toArray()}))}),dispose(){clearInterval(timer);leave();chat.dispose();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);badge.remove();}};
}
