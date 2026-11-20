import {tr,trServer} from '../i18n/index.ts';
import * as T from 'three';
import {phoneScreen} from '../mobile';
import './nearbyChat.css';
export type Speech={id:string;text:string;remainingMs:number};
type Message={id:string;name:string;speech:Speech|null};
type Anchor={id:string;position:T.Vector3;visible:boolean};
type Options={camera:T.Camera;active():boolean;canOpen():boolean;pause(value:boolean):void;send(text:string,id:string):Promise<Speech|null>};

/** Ephemeral public speech, anchored to the same interpolated avatars as presence. */
/** Ephemeral public speech, anchored to the same interpolated avatars as presence. */
export function mountNearbyChat(o:Options){
 const viewport=document.querySelector<HTMLElement>('#viewport')!;
 const button=document.createElement('button');button.id='campus-chat';button.className='campus-play-button';button.textContent=tr('Trò chuyện gần');button.hidden=true;document.querySelector('.global-greeting-actions')?.append(button);
 const dialog=document.createElement('dialog');dialog.className='nearby-chat';dialog.setAttribute('aria-labelledby','nearby-chat-title');
 dialog.innerHTML=`<header><strong id="nearby-chat-title">${tr('Trò chuyện gần')}</strong><button type="button" data-close aria-label="${tr('Đóng trò chuyện')}">×</button></header><p id="nearby-chat-help">${tr('Người đứng gần sẽ thấy chữ trên đầu bạn. Tin tự ẩn sau 10 giây, không lưu lịch sử.')}</p><form><label for="nearby-message">${tr('Lời nhắn · tối đa 160 ký tự')}</label><div class="nearby-chat-compose"><input id="nearby-message" maxlength="160" autocomplete="off" aria-describedby="nearby-chat-help" required><button type="submit">${tr('Gửi')}</button></div><details class="nearby-emoji"><summary>${tr('😊 Biểu cảm')}</summary><div class="nearby-emoji-grid" role="group" aria-label="${tr('Chèn biểu cảm vào lời nhắn')}"></div></details></form><label class="nearby-chat-mute"><input type="checkbox">${tr('Ẩn bong bóng chat')}</label><p class="nearby-chat-status" role="status"></p>`;
 document.body.append(dialog);
 const fitViewport=()=>{const v=window.visualViewport;dialog.style.setProperty('--chat-bottom',`${v?Math.max(0,innerHeight-v.height-v.offsetTop):0}px`);dialog.style.setProperty('--chat-height',`${v?.height??innerHeight}px`);};
 fitViewport();window.visualViewport?.addEventListener('resize',fitViewport);window.visualViewport?.addEventListener('scroll',fitViewport);window.addEventListener('resize',fitViewport);
 const input=dialog.querySelector<HTMLInputElement>('#nearby-message')!,submit=dialog.querySelector<HTMLButtonElement>('[type=submit]')!,mute=dialog.querySelector<HTMLInputElement>('[type=checkbox]')!,status=dialog.querySelector<HTMLElement>('[role=status]')!;
 const emojis=[['👋',tr('Chào bạn')],['😊',tr('Mỉm cười')],['😂',tr('Cười vui')],['❤️',tr('Trái tim')],['🎉',tr('Chúc mừng')],['👏',tr('Vỗ tay')],['🙌',tr('Hoan hô')],['👍',tr('Đồng ý')],['🌸',tr('Hoa anh đào')],['🌼',tr('Bông hoa')],['📚',tr('Sách')],['☕',tr('Cà phê')],['🍵',tr('Trà')],['⚽',tr('Bóng đá')],['✨',tr('Lấp lánh')],['🙏',tr('Cảm ơn')]];
 for(const [emoji,label] of emojis){
  const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label',label);b.title=label;
  b.addEventListener('pointerdown',e=>e.preventDefault());
  b.onclick=()=>{const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
   if(input.value.length-(end-start)+emoji.length>input.maxLength){status.textContent=tr('Lời nhắn đã đủ 160 ký tự.');return;}
   input.setRangeText(emoji,start,end,'end');input.dispatchEvent(new Event('input',{bubbles:true}));status.textContent=tr('Đã chèn ')+label.toLowerCase()+tr('. Bấm Gửi khi sẵn sàng.');
  };dialog.querySelector('.nearby-emoji-grid')!.append(b);
 }
 const bubbles=new Map<string,{el:HTMLElement;messageId:string;until:number}>();
 let muted=false,sending=false,restore:HTMLElement|null=null,pending:{text:string;id:string}|null=null,epoch=0;
 try{muted=localStorage.getItem('vju2011-nearby-chat-hidden')==='1';}catch{}mute.checked=muted;
 mute.onchange=()=>{muted=mute.checked;try{localStorage.setItem('vju2011-nearby-chat-hidden',muted?'1':'0');}catch{}if(muted)for(const b of bubbles.values())b.el.hidden=true;};
 function close(){if(!dialog.open)return;dialog.close();o.pause(!!document.querySelector('dialog[open]'));restore?.focus();}
 function clear(){epoch++;button.hidden=true;for(const b of bubbles.values())b.el.remove();bubbles.clear();close();}
 button.onclick=()=>{if(!o.active()||!o.canOpen()||dialog.open)return;restore=document.activeElement as HTMLElement;o.pause(true);dialog.showModal();input.focus();};
 dialog.querySelector('[data-close]')!.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector('form')!.onsubmit=async e=>{
  e.preventDefault();if(sending)return;const text=input.value.trim();if(!text)return;
  if(!pending||pending.text!==text)pending={text,id:crypto.randomUUID()};sending=true;submit.disabled=true;status.textContent=tr('Đang gửi…');const generation=epoch;
  try{const speech=await o.send(text,pending.id);if(generation!==epoch)return;pending=null;if(input.value.trim()===text)input.value='';status.textContent=tr('Đã gửi cho người đứng gần.');adoptOne({id:'self',name:tr('Bạn'),speech});}
  catch(error){if(generation===epoch)status.textContent=trServer((error as Error).message);}
  finally{sending=false;submit.disabled=false;}
 };
 function adoptOne(m:Message){
  const s=m.speech;let b=bubbles.get(m.id);if(!s||s.remainingMs<=0){b?.el.remove();bubbles.delete(m.id);return;}
  if(!b){const el=document.createElement('div');el.className='nearby-bubble';el.hidden=true;el.dataset.speaker=m.id;viewport.append(el);b={el,messageId:s.id,until:0};bubbles.set(m.id,b);}
  const until=performance.now()+Math.min(10000,s.remainingMs);
  b.until=b.messageId===s.id&&b.until?Math.min(b.until,until):until;b.messageId=s.id;
  b.el.textContent=s.text;b.el.setAttribute('aria-label',`${m.name}: ${s.text}`);
 }
 const point=new T.Vector3();
 return {isOpen:()=>dialog.open,clear,adopt(messages:Message[]){const ids=new Set(messages.map(m=>m.id));for(const [id,b] of bubbles)if(!ids.has(id)){b.el.remove();bubbles.delete(id);}messages.forEach(adoptOne);},
 update(anchors:Anchor[]){
  const active=o.active()&&!document.hidden;button.hidden=!active;button.disabled=!o.canOpen();if(!active){clear();return;}
  const visible=dialog.open||!document.querySelector('dialog[open]'),boxes:DOMRect[]=[];let count=0;
  for(const [id,b] of bubbles){
   if(performance.now()>=b.until){b.el.remove();bubbles.delete(id);continue;}
   const a=anchors.find(a=>a.id===id);b.el.hidden=true;if(!a?.visible||muted||!visible||count>=(phoneScreen.matches?3:6))continue;
   point.copy(a.position);point.y+=1.25;point.project(o.camera);
   if(point.z< -1||point.z>1||Math.abs(point.x)>.96||Math.abs(point.y)>.94)continue;
   b.el.hidden=false;const width=b.el.offsetWidth,height=b.el.offsetHeight,x=(point.x*.5+.5)*viewport.clientWidth,y=(-point.y*.5+.5)*viewport.clientHeight;
   if(y-height<8){b.el.hidden=true;continue;}
   const left=T.MathUtils.clamp(x,width/2+8,viewport.clientWidth-width/2-8);
   b.el.style.left=`${left}px`;b.el.style.top=`${y}px`;b.el.style.setProperty('--tail-x',`${T.MathUtils.clamp(x-left+width/2,14,width-14)}px`);
   const box=b.el.getBoundingClientRect();if(boxes.some(r=>r.left<box.right&&r.right>box.left&&r.top<box.bottom&&r.bottom>box.top)){b.el.hidden=true;continue;}boxes.push(box);count++;
  }
 },dispose(){clear();window.visualViewport?.removeEventListener('resize',fitViewport);window.visualViewport?.removeEventListener('scroll',fitViewport);window.removeEventListener('resize',fitViewport);button.remove();dialog.remove();}};
}
