import {requestTimeout} from '../browserCompat';
import {tr,tName,trServer} from '../i18n/index.ts';
import type {FlowerLoopState,PlantedBouquet} from '../festival/flowerLoop';
import type {FlowerKind} from './flowers';
import {bouquetMarkup} from './flowers';
import './sharedGarden.css';

type Pot=PlantedBouquet&{id:string;sequence:number;page:number;slot:number;status:string;mine?:boolean};
type Garden={page:number;pages:number;total:number;published:number;slots:(Pot|{reserved:true}|null)[];mine:Pot[];account:{id:string;name:string;mode:string;used:number;limit:number}|null;ssoConfigured:boolean;acceptingSubmissions:boolean;autoApprove?:boolean};
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const status=(s:string)=>({pending:tr('Đang chờ duyệt'),approved:tr('Đã công khai'),rejected:tr('Không được duyệt')}[s]||s);
export function mountSharedGarden(options:{local():FlowerLoopState;consume(flowers:FlowerKind[]):void;pause(open:boolean):void;view(slot:number):void}){
 let data:Garden|null=null,problem='',loading=false,selected=-1,mineIndex=-1,visible=false,focus=-1,epoch=0;
 let screen:'plant'|'browse'='browse',filter:'mine'|'all'='mine';
 let autoRotate=true,rotationActive=false,rotationPaused=true,rotateAt=0,automaticRequest=false;
 const resetRotation=()=>{rotationPaused=true;rotateAt=performance.now()+10_000;};
 const canRotate=()=>autoRotate&&rotationActive&&visible&&!document.hidden&&!dialog.open;
 let draft={signature:'',recipient:'',message:''};
 // An ambiguous retry retains its exact payload and key; changing the draft starts a new intent only after resolution.
 let intent:{account:string;key:string;body:typeof draft&{flowers:FlowerKind[]}}|null=null;
 const intentStorage='vju2011-pending-garden-v1';
 try{const saved=JSON.parse(sessionStorage.getItem(intentStorage)||'null');if(saved&&typeof saved.key==='string'&&saved.body&&Array.isArray(saved.body.flowers)){intent=saved;draft={signature:saved.body.signature,recipient:saved.body.recipient,message:saved.body.message};}}catch{/* optional storage */}
 const saveIntent=()=>{try{if(intent)sessionStorage.setItem(intentStorage,JSON.stringify(intent));else sessionStorage.removeItem(intentStorage);}catch{/* retry remains available in this tab */}};
 const root=document.createElement('section');root.className='shared-garden-controls';root.hidden=true;root.setAttribute('aria-label',tr('Điều hướng vườn hoa'));document.body.append(root);
 const dialog=document.createElement('dialog');dialog.className='shared-garden-dialog';dialog.setAttribute('aria-labelledby','shared-garden-title');document.body.append(dialog);
 async function request(path:string,init:RequestInit={}){const r=await fetch(path,{credentials:'same-origin',...init,signal:requestTimeout(15000)});const body=await r.json();if(!r.ok)throw Object.assign(new Error(body.error||tr('Chưa kết nối được vườn hoa.')),{code:body.code});return body;}
 function close(){dialog.close();options.pause(false);resetRotation();controls();}
 document.addEventListener('visibilitychange',resetRotation);
 root.addEventListener('pointerdown',resetRotation);
 root.addEventListener('keydown',resetRotation);
 dialog.addEventListener('cancel',e=>{e.preventDefault();if(!loading)close();});
 for(const event of ['keydown','keyup','pointerdown','pointerup'])dialog.addEventListener(event,e=>e.stopPropagation());
 for(const event of ['pointerdown','pointerup','keydown','keyup'])root.addEventListener(event,e=>e.stopPropagation());
 function controls(){
  root.hidden=!visible;
  root.innerHTML=`<strong>${tr('Vườn Hoa Tri Ân')} <span>${data?data.total.toLocaleString('vi-VN')+tr(' chậu'):tr('— chậu')}</span></strong><div><button data-step="-1" ${!data||loading||data.page===0?'disabled':''} aria-label="${tr('Trang vườn trước')}">${tr('← Trước')}</button><span>Trang ${data?data.page+1:1} / ${data?.pages||1}</span><button data-step="1" ${!data||loading||data.page>=data.pages-1?'disabled':''} aria-label="${tr('Trang vườn sau')}">${tr('Sau →')}</button>${mineIndex>=0&&data?.mine.length?`<button data-my-step="-1" ${loading?'disabled':''}>${tr('← Chậu trước')}</button><span>${tr('Chậu {0}/{1}',{0:mineIndex+1,1:data.mine.length})}</span><button data-my-step="1" ${loading?'disabled':''}>${tr('Chậu sau →')}</button>`:''}<button data-open>${tr('Hoa của tôi{0}',{0:data?.account?' · '+data.account.used+'/3':''})}</button></div>${problem?'<small role="status">'+esc(problem)+'</small>':''}`;
  root.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b=>b.onclick=()=>void refresh((data?.page||0)+Number(b.dataset.step)));
  if(data&&data.pages>1){
   const toggle=document.createElement('button');toggle.dataset.autoRotate='';toggle.setAttribute('aria-pressed',String(autoRotate));
   toggle.textContent=autoRotate?tr('Tự đổi: Bật · 10 giây'):tr('Tự đổi: Tắt');
   toggle.onclick=()=>{autoRotate=!autoRotate;resetRotation();controls();root.querySelector<HTMLButtonElement>('[data-auto-rotate]')?.focus();};
   root.querySelector('div')!.append(toggle);
  }
  root.querySelector<HTMLButtonElement>('[data-open]')!.onclick=()=>{filter='mine';open(-1,'browse');};
  root.querySelectorAll<HTMLButtonElement>('[data-my-step]').forEach(b=>b.onclick=async()=>{if(!data?.mine.length)return;await showMine((mineIndex+Number(b.dataset.myStep)+data.mine.length)%data.mine.length);if(data?.mine[mineIndex]?.status==='approved')options.view(selected);});
 }
 async function refresh(page=data?.page||0,automatic=false){
  if(loading)return;const revision=++epoch;loading=true;automaticRequest=automatic;controls();if(dialog.open&&!automatic)render();
  try{const next=await request('/api/garden?page='+page) as Garden;if(revision!==epoch||automatic&&!canRotate())return;if(data?.page!==next.page){focus=-1;selected=-1;mineIndex=-1;}data=next;problem='';if(intent&&next.account&&intent.account!==next.account.id){intent=null;saveIntent();}}
  catch{if(revision===epoch)problem=data?tr('Mất kết nối · đang hiển thị số liệu lần tải trước.'):tr('Chưa kết nối được vườn hoa. Thử lại.');}
  finally{if(revision===epoch){loading=false;automaticRequest=false;resetRotation();controls();if(dialog.open&&!automatic)render();}}
 }
 function render(){
  const p=mineIndex>=0?data?.mine[mineIndex]:selected>=0?data?.slots[selected]:null,local=options.local(),canPlant=!!data?.account&&data.account.used<3&&data.acceptingSubmissions;
  const flowers=intent?.body.flowers||local.basket,planting=screen==='plant'&&!p;
  const signature=data?.account?.mode==='anonymous'?tr('Khách ẩn danh'):draft.signature||data?.account?.name||'';
  let body='',footer='',title=planting?tr('Cắm hoa tri ân'):tr('Vườn Hoa Tri Ân');
  if(p&&'reserved'in p)body=`<p>${tr('Ô này đã có chậu đang xét duyệt. Nội dung chưa công khai.')}</p>`;
  else if(p)body=`<div class="sg-pot">${bouquetMarkup(p.flowers,true)}<p class="sg-position">${tr('{0} · Trang {1}, ô {2}',{0:status(p.status),1:p.page+1,2:p.slot+1})}</p><h3>${tr('Dành tặng {0}',{0:esc(tName(p.recipient))})}</h3><blockquote>${esc(p.message)}</blockquote><p>— ${esc(tName(p.signature))}</p></div>${p.status==='approved'?`<button class="sg-primary" data-view="${p.slot}">${tr('Ngắm chậu trong vườn')}</button>`:''}`;
  else if(planting){
   if(!data)body=problem?`<p>${tr('Tải lại để tiếp tục cắm hoa.')}</p>`:`<p>${tr('Đang kết nối vườn hoa…')}</p>`;
   else if(!data.account)body=`<p>${tr('Chọn cách tham gia để gửi chậu hoa của bạn.')}</p><a class="sg-login" href="/?account=1&garden=1">${tr('Chọn Khách hoặc SSO VJU')}</a>`;
   else if(!canPlant&&!intent)body=`<h3>${data.account.used>=3?tr('Bạn đã dùng đủ 3 lượt gửi'):tr('Vườn đang tạm ngừng nhận hoa')}</h3><p>${tr('Bạn vẫn có thể xem và ngắm những chậu đã gửi.')}</p>`;
   else if(!flowers.length)body=`<div class="sg-empty"><h3>${tr('Hái một bông để bắt đầu')}</h3><p>${tr('Có thể cắm từ 1 bông, không cần hái đầy túi.')}</p><button class="sg-primary" data-pick>${tr('Đi hái hoa')}</button></div>`;
   else{
    body=`<div class="sg-bouquet">${bouquetMarkup(flowers,true)}<div><strong>${tr('Bó hoa của bạn')}</strong><span>${tr('{0} bông · Sẵn sàng cắm',{0:flowers.length})}</span></div></div><form id="shared-garden-plant"><label>${tr('Dành tặng ai?')}<input name="recipient" required maxlength="60" autocomplete="off" placeholder="${tr('Tên thầy cô hoặc tập thể')}" ${intent?'readonly':''} value="${esc(draft.recipient)}"></label><label>${tr('Lời cảm ơn')}<textarea name="message" required minlength="10" maxlength="240" rows="3" placeholder="${tr('Một điều bạn muốn gửi gắm…')}" ${intent?'readonly':''}>${esc(draft.message)}</textarea><span class="sg-field-hint">${tr('10–240 ký tự')}</span></label><details class="sg-signature" ${!signature?'open':''}><summary>${tr('Tên trên chậu: {0}',{0:esc(signature||tr('Thêm tên'))})}</summary><label>${tr('Tên hiển thị')}<input name="signature" required maxlength="60" ${intent||data.account.mode==='anonymous'?'readonly':''} value="${esc(signature)}"></label></details></form>`;
    footer=`<div class="sg-submit"><p>${intent?tr('Lần gửi đang chờ xác nhận. Thử lại sẽ không tạo chậu trùng.'):tr('Dùng 1 lượt · Còn {0}/3 lượt chung với thiệp.',{0:Math.max(0,3-data.account.used)})} ${data.autoApprove===true?tr('Công khai ngay sau khi gửi.'):tr('Công khai sau khi duyệt.')}</p><button class="sg-primary" type="submit" form="shared-garden-plant" ${loading?'disabled':''}>${loading?tr('Đang gửi…'):intent?tr('Thử gửi lại'):tr('Cắm hoa & gửi lời cảm ơn')}</button></div>`;
   }
  }else{
   body=`<div class="sg-browse-head"><p>${data?tr('{0} chậu đã công khai',{0:data.published.toLocaleString('vi-VN')}):tr('Đang tải vườn hoa…')}</p><button data-plant ${loading?'disabled':''}>${tr('Cắm hoa')}</button></div><div class="sg-filters" role="group" aria-label="${tr('Chọn chậu hoa')}"><button data-filter="mine" aria-pressed="${filter==='mine'}" ${loading?'disabled':''}>${tr('Hoa của tôi')}</button><button data-filter="all" aria-pressed="${filter==='all'}" ${loading?'disabled':''}>${tr('Vườn chung')}</button></div>`;
   if(filter==='mine')body+=data?.mine.length?`<div class="sg-mine">${data.mine.map((pot,i)=>`<button data-mine="${i}"><strong>${tr('Chậu {0}',{0:i+1})}</strong><span>${status(pot.status)}</span><small>${tr('Dành tặng {0}',{0:esc(tName(pot.recipient))})}</small></button>`).join('')}</div>`:`<p class="sg-empty">${tr('Bạn chưa gửi chậu hoa nào.')}</p>`;
   else{
    const pots=(data?.slots||[]).flatMap((pot,i)=>pot&&!('reserved'in pot)&&pot.status==='approved'?[{pot,i}]:[]);
    body+=pots.length?`<div class="sg-mine">${pots.map(({pot,i})=>`<button data-slot="${i}"><strong>${esc(tName(pot.signature))}</strong><span>${tr('Dành tặng {0}',{0:esc(tName(pot.recipient))})}</span><small>${status(pot.status)}</small></button>`).join('')}</div>`:`<p class="sg-empty">${tr('Chưa có chậu hiển thị ở trang này.')}</p>`;
    body+=`<nav class="sg-pages" aria-label="${tr('Trang vườn')}"><button data-page="-1" ${loading||!data||data.page===0?'disabled':''}>${tr('← Trước')}</button><span>${data?data.page+1:1} / ${data?.pages||1}</span><button data-page="1" ${loading||!data||data.page>=data.pages-1?'disabled':''}>${tr('Sau →')}</button></nav>`;
   }
   if(local.planted.some(Boolean))body+=`<p class="sg-note">${tr('Hoa thử trên thiết bị chưa gửi lên vườn chung.')}</p>`;
  }
  dialog.dataset.screen=planting?'plant':p?'pot':'browse';
  dialog.innerHTML=`<header><h2 id="shared-garden-title">${title}</h2><button data-close aria-label="${tr('Đóng vườn hoa')}" ${loading?'disabled':''}>×</button></header><div class="sg-body">${problem?`<p class="sg-notice" role="status">${esc(problem)}</p>`:''}${body}${planting||p?`<button class="sg-back" data-overview ${loading?'disabled':''}>${tr('← Xem vườn hoa')}</button>`:''}${!planting||problem&&!intent?`<button class="sg-reload" data-reload ${loading?'disabled':''}>${tr('Tải lại')}</button>`:''}</div>${footer}`;
  dialog.querySelector('[data-close]')!.addEventListener('click',close);
  dialog.querySelector('[data-overview]')?.addEventListener('click',()=>{selected=-1;mineIndex=-1;screen='browse';render();});
  dialog.querySelector('[data-plant]')?.addEventListener('click',()=>{selected=-1;screen='plant';render();});
  dialog.querySelector('[data-pick]')?.addEventListener('click',()=>{close();document.querySelector<HTMLButtonElement>('.rpg-dock [data-panel="bag"]')?.click();});
  dialog.querySelector('[data-reload]')?.addEventListener('click',()=>void refresh());
  dialog.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter as 'mine'|'all';render();dialog.querySelector<HTMLButtonElement>(`[data-filter="${filter}"]`)?.focus();});
  dialog.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.slot);render();});
  dialog.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b=>b.onclick=()=>void refresh((data?.page||0)+Number(b.dataset.page)));
  dialog.querySelectorAll<HTMLButtonElement>('[data-mine]').forEach(b=>b.onclick=()=>void showMine(Number(b.dataset.mine)));
  dialog.querySelector<HTMLButtonElement>('[data-view]')?.addEventListener('click',()=>{focus=selected;close();if(data?.mine[mineIndex]?.status==='approved')options.view(selected);});
  const form=dialog.querySelector<HTMLFormElement>('form');
  form?.addEventListener('invalid',e=>{const details=(e.target as HTMLElement).closest('details');if(details)details.open=true;},true);
  form?.addEventListener('input',()=>{const f=new FormData(form);draft={signature:String(f.get('signature')||''),recipient:String(f.get('recipient')||''),message:String(f.get('message')||'')};const summary=form.querySelector('summary');if(summary)summary.textContent=tr('Tên trên chậu: ')+(draft.signature||tr('Thêm tên'));});
  form?.addEventListener('submit',async e=>{
   e.preventDefault();if(loading)return;
   const f=new FormData(form);draft={signature:String(f.get('signature')||''),recipient:String(f.get('recipient')||''),message:String(f.get('message')||'')};
   intent??={account:data!.account!.id,key:crypto.randomUUID(),body:{...draft,flowers:[...options.local().basket]}};
   saveIntent();
   loading=true;problem=tr('Đang gửi…');render();
   try{const response=await request('/api/garden/pots',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':intent.key},body:JSON.stringify(intent.body)});options.consume(intent.body.flowers);window.dispatchEvent(new Event('vju-flower-success'));intent=null;saveIntent();selected=response.pot.slot;loading=false;await refresh(response.pot.page);mineIndex=data?.mine.findIndex(p=>p.id===response.pot.id)??-1;problem=response.pot.status==='approved'?tr('Đã cắm hoa và công khai lời cảm ơn.'):response.pot.status==='pending'?tr('Đã nhận chậu hoa. Lời cảm ơn đang chờ duyệt.'):tr('Đã nhận chậu hoa. Nội dung không được duyệt.');}
   catch(e){problem=trServer((e as Error).message);const code=(e as {code?:string}).code;if(code&&code!=='INTERNAL_ERROR'){intent=null;saveIntent();}}
   finally{loading=false;render();controls();}
  });
 }
 async function showMine(index:number){if(loading)return;const p=data?.mine[index];if(!p)return;await refresh(p.page);mineIndex=index;selected=p.slot;focus=p.status==='approved'?p.slot:-1;render();controls();}
 function open(slot=-1,mode?:'plant'|'browse'){
  // A late background page must not replace the pot or draft the visitor just opened.
  const superseded=automaticRequest;if(superseded){epoch++;loading=false;automaticRequest=false;resetRotation();controls();}
  selected=slot;mineIndex=-1;screen=mode||(intent||options.local().basket.length||slot>=0?'plant':'browse');render();
  if(!dialog.open){dialog.showModal();options.pause(true);}if(!superseded)void refresh();
 }
 void refresh();setInterval(()=>{if(!document.hidden&&!loading&&!dialog.open)void refresh();},45000);
 if(new URLSearchParams(location.search).has('sso'))problem=tr('Đăng nhập chưa hoàn tất. Vui lòng thử lại.');
 return {open,isOpen:()=>dialog.open,total:()=>problem?null:data?.total??null,focus:()=>focus,used:()=>data?.account?.used||0,ownedPots:()=>data?.mine.length||0,
  setVisible(value:boolean){if(visible===value)return;visible=value;resetRotation();controls();},
  tick(now:number,active:boolean){
   rotationActive=active;
   if(!canRotate()||loading||!data||data.pages<2){resetRotation();return;}
   if(rotationPaused){rotationPaused=false;rotateAt=now+10_000;return;}
   if(now>=rotateAt)void refresh((data.page+1)%data.pages,true);
  },
  state(local:FlowerLoopState):FlowerLoopState{return {...local,planted:(data?.slots||Array(24).fill(null)).map(p=>p&&!('reserved'in p)&&p.status==='approved'?p:null)};},
  refresh};
}
