import {requestTimeout} from '../browserCompat';
import {tr,trServer,LANG,setLang} from '../i18n/index.ts';
import {showStartup} from '../startup';
import './participation.css';
export type Participant={id:string;name:string;mode:'guest'|'anonymous'|'sso';used:number;limit:number};
let participant:Participant|null=null;
export const currentParticipant=()=>participant;
type ParticipationOptions={parent?:HTMLElement;manage?:boolean;onIdentityChange?():void};
export async function chooseParticipation(options:ParticipationOptions={}){
 const credit=()=>`<p class="participation-credit">${tr('Developed by Kiên, Đạt &amp; Quân')}</p>`;
 const brand=()=>`<header class="participation-intro"><img src="/assets/brand/project-mark.svg" width="168" height="68" alt="20.11"><p class="participation-eyebrow">${tr('20.11.2026 · Hòa Lạc')}</p><h1 id="participation-title"><span>${tr('Thêm một mùa')}</span> <span>${tr('tri ân.')}</span></h1><p class="participation-lead">${tr('Ghé sân trường, gửi lời cảm ơn thầy cô và cán bộ nhân viên VJU!')}</p></header>`;
 const root=document.createElement('section');root.className='participation';root.setAttribute('aria-labelledby','participation-title');root.innerHTML=`<div class="participation-card">${brand()}<div class="participation-choices"><p role="status">${tr('Đang kết nối…')}</p></div>${credit()}</div>`;(options.parent||document.body).append(root);
 // Language choice before joining: a Japanese lecturer can switch here. The visible label is written in the target language.
 const langToggle=document.createElement('button');langToggle.type='button';langToggle.className='participation-lang';langToggle.lang=LANG==='ja'?'vi':'ja';
 langToggle.setAttribute('aria-label',LANG==='ja'?'ベトナム語に切り替える':'Chuyển sang tiếng Nhật');langToggle.textContent=`🌐 ${LANG==='ja'?'Tiếng Việt':'日本語'}`;
 let repaint=()=>{};
 langToggle.addEventListener('click',()=>{
  const next=LANG==='ja'?'vi':'ja';
  // The full campus still remounts on a language change; the entry screen needs no reload.
  if(options.manage){setLang(next);return;}
  setLang(next,{reload:false});
  langToggle.lang=next==='ja'?'vi':'ja';
  langToggle.setAttribute('aria-label',next==='ja'?'ベトナム語に切り替える':'Chuyển sang tiếng Nhật');
  langToggle.textContent=`🌐 ${next==='ja'?'Tiếng Việt':'日本語'}`;
  repaint();langToggle.focus({preventScroll:true});
 });root.append(langToggle);
 repaint=()=>{
  root.querySelector('.participation-intro')!.outerHTML=brand();
  root.querySelector('.participation-credit')!.outerHTML=credit();
  root.querySelector('[role=status]')!.textContent=tr('Đang kết nối…');
 };
 let sso=false;
 const request=async(path:string,body?:unknown)=>{
  const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:requestTimeout(15000)});
  if(!r.headers.get('content-type')?.includes('application/json'))throw Error('Chưa kết nối được. Vui lòng thử lại.');
  const data=await r.json();if(!r.ok)throw Error(data.error||tr('Chưa thể tham gia. Vui lòng thử lại.'));return data;
 };
 const adopt=(account:Participant)=>{
  participant=account;
  try{
   const key=account.id+':'+account.mode;
   if(localStorage.getItem('vju2011-participant')!==key){
    localStorage.removeItem('vju2011-greeting-draft-v1');sessionStorage.removeItem('vju2011-receipt-v1');sessionStorage.removeItem('vju2011-pending-garden-v1');
   }
   localStorage.setItem('vju2011-participant',key);localStorage.setItem('vju2011-player-name',account.name);
  }catch{/* A session cookie, not local storage, controls identity. */}
 };
 let session;
 // A failed session request must not turn into a full-page asset reload loop.
 while(!session){try{
  const data=await request('/api/auth/session');
  if(!data||typeof data.enabled!=='boolean')throw Error(tr('Chưa kết nối được. Vui lòng thử lại.'));
  session=data;
 }catch(e){
  const message=(e as Error).message;
  root.querySelector('[role=status]')!.textContent=trServer(message);
  const retry=document.createElement('button');retry.type='button';retry.dataset.sessionRetry='';retry.textContent=tr('Thử lại');
  const cancel=document.createElement('button');cancel.type='button';cancel.dataset.return='';cancel.textContent=tr('Tiếp tục vào campus');
  const choices=root.querySelector('.participation-choices')!;choices.append(retry);if(options.manage)choices.append(cancel);
  const loadingRepaint=repaint;
  repaint=()=>{loadingRepaint();root.querySelector('[role=status]')!.textContent=trServer(message);retry.textContent=tr('Thử lại');cancel.textContent=tr('Tiếp tục vào campus');};
  const again=await new Promise<boolean>(resolve=>{retry.onclick=()=>resolve(true);cancel.onclick=()=>resolve(false);});retry.remove();cancel.remove();repaint=loadingRepaint;
  if(!again){root.remove();return;}root.querySelector('[role=status]')!.textContent=tr('Đang kết nối…');
 }}
 if(!session.enabled){root.remove();return;}
 sso=session.ssoConfigured;
 const params=new URLSearchParams(location.search);
 if(session.account&&!params.has('account')&&!options.manage){adopt(session.account);root.remove();return;}
 await new Promise<void>(resolve=>{
 const render=()=>{
  const name=root.querySelector<HTMLInputElement>('#guest-name')?.value||'';
  const expanded=root.querySelector<HTMLDetailsElement>('.participation-info')?.open||false;
  root.innerHTML=`<div class="participation-card">${brand()}<div class="participation-choices">
   ${session.account?`<section class="participation-current" aria-label="${tr('Phiên hiện tại')}"><p>${tr('Đang tham gia:')} <strong data-current-name></strong></p><button type="button" data-return>${tr('Tiếp tục vào campus')}</button><button type="button" data-logout>${tr('Đăng xuất')}</button></section>`:''}
   <section class="participation-vju" aria-labelledby="participation-vju-title"><h2 id="participation-vju-title">${tr('Tài khoản VJU')}</h2><p class="participation-hint">${tr('Xem lại lời chúc trên nhiều thiết bị.')}</p><a class="participation-sso" href="/api/auth/sso/authorize" ${sso?'':'hidden'}>${tr('Đăng nhập SSO VJU')} <span aria-hidden="true">→</span></a>${sso?'':`<p class="participation-unavailable">${tr('SSO tạm thời chưa khả dụng.')}</p>`}</section>
   <div class="participation-divider"><span>${tr('hoặc vào với tư cách khách')}</span></div>
   <form><label for="guest-name">${tr('Tên hiển thị')}</label><input id="guest-name" name="name" autocomplete="nickname" maxlength="60" required placeholder="${tr('Tên bạn muốn mọi người thấy')}"><button type="submit">${tr('Vào campus với tên này')} <span aria-hidden="true">→</span></button></form>
   <button type="button" data-anonymous>${tr('Vào ẩn danh')}</button>
   <p class="participation-status" role="status" aria-live="polite"></p>
   <details class="participation-info"><summary>${tr('Thông tin tham gia')}</summary><div><p>${tr('Người ở gần thấy tên và nhân vật của bạn. Chọn ẩn danh để không hiển thị tên của mình.')}</p><p>${tr('Mỗi tài khoản hoặc lượt khách trên trình duyệt có tối đa 3 lời cảm ơn, tính cả chậu hoa. Chế độ công khai được hiển thị trước khi gửi.')}</p><p>${tr('Khách không cần email. Dữ liệu khách gắn với trình duyệt này trong 30 ngày; dùng SSO để xem lại trên thiết bị khác.')}</p></div></details>
  </div>${credit()}</div>`;langToggle.disabled=false;root.append(langToggle);
  root.querySelector<HTMLInputElement>('#guest-name')!.value=name;
  root.querySelector<HTMLDetailsElement>('.participation-info')!.open=expanded;
  const currentName=root.querySelector('[data-current-name]');if(currentName)currentName.textContent=session.account.name;
  if(params.get('sso')==='failed')root.querySelector('[role=status]')!.textContent=tr('SSO chưa hoàn tất. Bạn có thể thử lại hoặc tham gia với tư cách khách.');
  const done=(account:Participant)=>{adopt(account);params.delete('account');params.delete('sso');const language=new URLSearchParams(location.search).get('lang');if(language)params.set('lang',language);history.replaceState(null,'',location.pathname+(params.size?'?'+params:'')+location.hash);root.remove();resolve();};
  const login=async(mode:'guest'|'anonymous')=>{
   const buttons=root.querySelectorAll<HTMLButtonElement>('button');buttons.forEach(b=>b.disabled=true);
   const ssoLink=root.querySelector<HTMLAnchorElement>('.participation-sso')!;
   ssoLink.setAttribute('aria-disabled','true');ssoLink.tabIndex=-1;
   root.querySelector('[role=status]')!.textContent=tr('Đang vào campus…');
   try{const response=await request('/api/auth/guest',{mode,name:(root.querySelector('input') as HTMLInputElement).value});options.onIdentityChange?.();done(response.account);}
   catch(e){root.querySelector('[role=status]')!.textContent=trServer((e as Error).message);buttons.forEach(b=>b.disabled=false);ssoLink.removeAttribute('aria-disabled');ssoLink.removeAttribute('tabindex');}
  };
  root.querySelector('.participation-sso')!.addEventListener('click',e=>{if((e.currentTarget as HTMLElement).getAttribute('aria-disabled')==='true')e.preventDefault();});
  root.querySelector('form')!.onsubmit=e=>{e.preventDefault();void login('guest');};
  root.querySelector<HTMLButtonElement>('[data-anonymous]')!.onclick=()=>void login('anonymous');
  root.querySelector<HTMLButtonElement>('[data-return]')?.addEventListener('click',()=>done(session.account));
  root.querySelector<HTMLButtonElement>('[data-logout]')?.addEventListener('click',async()=>{
   const buttons=root.querySelectorAll<HTMLButtonElement>('button');buttons.forEach(b=>b.disabled=true);
   const link=root.querySelector<HTMLAnchorElement>('.participation-sso')!;link.setAttribute('aria-disabled','true');link.tabIndex=-1;
   try{await request('/api/auth/logout',{});options.onIdentityChange?.();participant=null;session.account=null;
    try{sessionStorage.removeItem('vju2011-receipt-v1');}catch{/* A storage restriction must not undo a successful server logout. */}
    render();root.querySelector<HTMLInputElement>('#guest-name')?.focus();
   }catch(e){root.querySelector('[role=status]')!.textContent=trServer((e as Error).message);buttons.forEach(b=>b.disabled=false);link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');}
  });
 };repaint=render;render();
 });
}
export function mountParticipantMenu(onOpenChange:(open:boolean)=>void=()=>{}){
 if(!participant)return;
 const button=document.createElement('button');button.type='button';button.className='participant-menu';button.textContent=participant.mode==='sso'?tr('Tài khoản VJU'):participant.mode==='anonymous'?tr('Khách ẩn danh'):tr('Khách: ')+participant.name;
 button.setAttribute('aria-label',tr('Đổi cách tham gia hoặc đăng xuất'));
 let opening=false;
 button.onclick=async()=>{
  if(opening)return;opening=true;button.disabled=true;
  document.querySelector('.participant-menu-error')?.remove();
  const identityKey=()=>participant?JSON.stringify([participant.id,participant.mode,participant.name]):null,originalIdentity=identityKey();
  const previousUrl=location.href,app=document.querySelector<HTMLElement>('#app'),wasInert=app?.inert||false;
  const dialog=document.createElement('dialog');dialog.className='account-dialog';dialog.setAttribute('aria-label',tr('Đổi cách tham gia hoặc đăng xuất'));
  // Escape returns only while the original server identity is still valid; it cannot bypass logout.
  dialog.addEventListener('cancel',event=>{event.preventDefault();dialog.querySelector<HTMLButtonElement>('[data-return]:not(:disabled)')?.click();});
  let changed=false;
  try{
   document.body.append(dialog);dialog.showModal();if(app)app.inert=true;onOpenChange(true);
   const url=new URL(location.href);url.searchParams.set('account','1');history.replaceState(null,'',url);
   await chooseParticipation({parent:dialog,manage:true,onIdentityChange(){changed=true;}});
   changed=changed||identityKey()!==originalIdentity;
   if(changed){
    // Other campus services cache identity. Reinitialise only after a completed login,
    // on the normal campus URL; never reload just to open the account choices or log out.
    const next=new URL(location.href);next.searchParams.delete('account');next.searchParams.delete('sso');showStartup();location.replace(next);
   }
  }catch(error){
   console.error('[VJU ACCOUNT_FAILED]',error);
   if(changed){const next=new URL(location.href);next.searchParams.delete('account');next.searchParams.delete('sso');showStartup();location.replace(next);}
   else{const message=document.createElement('p');message.className='participant-menu-error';message.setAttribute('role','alert');message.textContent=tr('Chưa kết nối được. Vui lòng thử lại.');button.after(message);}
  }finally{
   dialog.close();dialog.remove();opening=false;button.disabled=false;
   if(!changed){history.replaceState(null,'',previousUrl);if(app)app.inert=wasInert;onOpenChange(false);button.focus();}
  }
 };
 document.querySelector('.masthead')?.append(button);
}
