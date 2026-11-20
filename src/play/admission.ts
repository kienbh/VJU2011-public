import {tr} from '../i18n/index.ts';
import {requestTimeout} from '../browserCompat';
import './admission.css';
type Status={state:'admitted'|'queued'|'offered'|'outside';reason?:string;position:number;online:number;capacity:number;idleSeconds:number|null};
export function mountAdmission(o:{onAdmit(first:boolean):void;onWait():void;onExit(reason:string):void;moving():boolean}){
 const tab=crypto.randomUUID();let wanted=false,admitted=false,first=true,needEnter=false,busy=false,seq=0,activity=0,lastInput=0,lastSync=0,lastSuccess=0,epoch=0,reply:Status|null=null;
 const queue=document.createElement('dialog');queue.className='campus-queue';queue.setAttribute('aria-labelledby','campus-queue-title');
 queue.innerHTML=`<h2 id="campus-queue-title">${tr('Đang vào sân trường')}</h2><p role="status" aria-live="polite"></p><p>${tr('Bạn vẫn giữ danh tính và bản nháp. Khi có chỗ và tab này đang mở, bạn sẽ tự vào.')}</p><button type="button">${tr('Về màn chào')}</button>`;document.body.append(queue);
 const warning=document.createElement('div');warning.className='campus-idle-warning';const nativePopover=typeof warning.showPopover==='function'&&typeof warning.hidePopover==='function';if(nativePopover)warning.setAttribute('popover','manual');warning.setAttribute('role','status');warning.innerHTML=`<span></span><button type="button">${tr('Tôi vẫn ở đây')}</button>`;warning.hidden=true;document.body.append(warning);
 const exit=document.createElement('button');exit.id='campus-exit';exit.textContent=tr('Rời campus');exit.hidden=true;document.querySelector('.global-greeting-actions')?.append(exit);
 function hideWarning(){if(nativePopover&&warning.matches(':popover-open'))warning.hidePopover();warning.hidden=true;}
 function input(e:Event){if(!wanted||!e.isTrusted)return;if(e instanceof KeyboardEvent&&e.repeat&&!o.moving())return;if(e.type==='pointermove'&&!(e as PointerEvent).buttons&&!document.pointerLockElement)return;const now=Date.now();if(now-lastInput<200)return;lastInput=now;activity++;hideWarning();}
 for(const type of ['pointerdown','pointermove','keydown','input','wheel'])window.addEventListener(type,input,{capture:true,passive:true});
 warning.querySelector('button')!.onclick=e=>{if(!e.isTrusted)return;lastInput=Date.now();activity++;hideWarning();lastSync=0;void sync();};
 function beacon(){navigator.sendBeacon('/api/campus',new Blob([JSON.stringify({action:'leave',tab,seq:++seq,activity})],{type:'application/json'}));}
 function leave(reason='left'){epoch++;wanted=false;admitted=false;exit.hidden=true;beacon();queue.close();hideWarning();o.onExit(reason);}
 exit.onclick=()=>leave();queue.querySelector('button')!.onclick=()=>leave();queue.oncancel=e=>{e.preventDefault();leave();};
 function waiting(message:string){exit.hidden=true;o.onWait();queue.querySelector('[role=status]')!.textContent=message;if(!queue.open)queue.showModal();}
 function apply(d:Status){
  reply=d;lastSuccess=Date.now();
  if(d.state==='admitted'){
   const was=admitted;admitted=true;queue.close();exit.hidden=false;
   if(!was){lastInput=Date.now();o.onAdmit(first);first=false;}
   if(d.idleSeconds!==null&&d.idleSeconds<=60){
    const parent=document.querySelector('dialog[open]')||document.body;if(warning.parentElement!==parent)parent.append(warning);
    warning.hidden=false;warning.querySelector('span')!.textContent=tr('Campus sẽ trả chỗ sau {0} giây nếu bạn không thao tác.',{0:d.idleSeconds});if(nativePopover&&!warning.matches(':popover-open'))warning.showPopover();
   }else hideWarning();
  }else if(d.state==='queued'||d.state==='offered'){
   admitted=false;waiting(d.state==='queued'?tr('Campus có {0}/{1} người. Vị trí chờ của bạn: {2}.',{0:d.online,1:d.capacity,2:d.position}):tr('Đã có chỗ, đang đưa bạn vào…'));
  }else if(['idle','missed','full','tabs'].includes(d.reason||''))leave(d.reason);
  else{admitted=false;waiting(tr('Đang kết nối lại campus…'));}
 }
 async function send(action?:'enter'|'pulse'){
  const r=await fetch('/api/campus'+(action?'':'?tab='+tab),{method:action?'POST':'GET',headers:action?{'Content-Type':'application/json'}:{},body:action?JSON.stringify({action,tab,seq:++seq,activity}):undefined,signal:requestTimeout(6000)});
  if(r.status===401){
   // Confirm expiry through the session endpoint. A single failed campus request must
   // not discard a valid place or draft; retries still require a server-verified identity.
   const session=await fetch('/api/auth/session',{cache:'no-store',signal:requestTimeout(6000)});
   if(!session.ok)throw Error('Session check unavailable');
   if(!(await session.json()).account){leave('identity');return null;}
   throw Error('Retry campus with verified session');
  }
  if(!r.ok)throw Error();return await r.json() as Status;
 }
 async function sync(){
  if(!wanted||busy||document.hidden||Date.now()-lastSync<5000)return;busy=true;lastSync=Date.now();const current=epoch;
  try{
   if(admitted&&Date.now()-lastInput>=300000){leave('idle');return;}
   const action=needEnter?'enter':admitted?'pulse':undefined;needEnter=false;
   let d=await send(action);
   if(!d||current!==epoch)return;
   if(d.state==='outside'&&['missing','disconnected','left'].includes(d.reason||'')){d=await send('enter');if(!d||current!==epoch)return;}
   if(d.state==='offered'&&!document.hidden){d=await send('enter');if(!d||current!==epoch)return;}
   apply(d);
  }catch{if(current===epoch&&Date.now()-lastSuccess>15000){admitted=false;hideWarning();waiting(tr('Mất kết nối. Đang thử lại; bạn không mất bản nháp.'));}}
  finally{busy=false;}
 }
 // Do not increment activity for timers, network replies or synthetic DOM events.
 setInterval(()=>void sync(),500);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){lastSync=0;void sync();}});
 window.addEventListener('pagehide',()=>{if(wanted)beacon();});
 window.addEventListener('vju-campus-exit',()=>{if(wanted)leave();});
 return {tab,active:()=>admitted,state:()=>({admitted,wanted,...reply}),enter(){wanted=true;first=true;needEnter=true;reply=null;lastInput=Date.now();activity++;lastSuccess=Date.now();lastSync=0;waiting(tr('Đang kiểm tra chỗ trong campus…'));void sync();},leave};
}
