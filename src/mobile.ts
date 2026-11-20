import {tr} from './i18n/index.ts';
import './mobile.css';
export const phoneScreen=matchMedia('(pointer: coarse) and (max-width: 1000px), (max-width: 600px)');
let menu:HTMLDialogElement|undefined;
export const mobileMenuOpen=()=>!!menu?.open;
export function mountMobileNavigation(pause:(value:boolean)=>void){
 const header=document.querySelector('.masthead')!;
 const bar=document.createElement('div');bar.className='phone-navigation';
 bar.innerHTML=`<button type="button" data-finale class="finale-shortcut" aria-label="${tr('Xem kết lễ')}">${tr('Kết lễ')}</button><button type="button" data-map>${tr('Bản đồ')}</button><button type="button" data-menu aria-haspopup="dialog">Menu</button>`;header.append(bar);
 menu=document.createElement('dialog');menu.className='phone-menu';menu.setAttribute('aria-labelledby','phone-menu-title');
 menu.innerHTML=`<header><h2 id="phone-menu-title">${tr('Dạo campus')}</h2><button data-close aria-label="${tr('Đóng menu')}">×</button></header><nav aria-label="${tr('Công cụ người chơi')}"></nav>`;
 document.body.append(menu);
 const actions=[['#campus-exit',tr('Rời campus'),tr('Cá nhân')],['#send-greeting',tr('Viết thiệp'),tr('Tri ân')],['#open-reflections',tr('Góc suy ngẫm'),tr('Tri ân')],['.rpg-dock [data-panel="bag"]',tr('Túi hoa'),tr('Tri ân')],['.rpg-dock [data-panel="quests"]',tr('Hành trình'),tr('Tri ân')],['#campus-chat',tr('Trò chuyện gần'),tr('Trong campus')],['#rpg-photo',tr('Chụp ảnh'),tr('Trong campus')],['.rpg-dock [data-panel="avatar"]',tr('Nhân vật'),tr('Cá nhân')],['.rpg-dock [data-panel="camera"]',tr('Góc nhìn & kết lễ'),tr('Cá nhân')],['#open-admin',tr('Duyệt lời chúc'),tr('Cá nhân')],['.participant-menu',tr('Tài khoản'),tr('Cá nhân')],['#lang-switch',document.querySelector('#lang-switch')?.textContent||'日本語',tr('Cá nhân')]];
 const close=()=>menu!.close();
 menu.querySelector('[data-close]')!.addEventListener('click',close);
 menu.addEventListener('close',()=>{pause(!!document.querySelector('dialog[open]'));if(!document.querySelector('dialog[open]'))bar.querySelector<HTMLButtonElement>('[data-menu]')!.focus();});
 const sync=()=>{document.body.classList.toggle('phone-ui',phoneScreen.matches);if(!phoneScreen.matches&&menu!.open)close();};sync();phoneScreen.addEventListener('change',sync);
 bar.querySelector('[data-finale]')!.addEventListener('click',()=>document.querySelector<HTMLButtonElement>('#festival-finale')?.click());
 bar.querySelector('[data-map]')!.addEventListener('click',()=>document.querySelector<HTMLButtonElement>('#campus-explore')?.click());
 bar.querySelector('[data-menu]')!.addEventListener('click',()=>{
  const nav=menu!.querySelector('nav')!;nav.replaceChildren();
  let group='';
  for(const [selector,label,section] of actions){const target=document.querySelector<HTMLButtonElement>(selector);if(!target||(['#open-admin','#campus-exit'].includes(selector)&&target.hidden))continue;if(section!==group){const heading=document.createElement('h3');heading.className='menu-group';heading.textContent=section;nav.append(heading);group=section;}const b=document.createElement('button');b.textContent=selector==='#lang-switch'?target.textContent||label:label;b.disabled=target.disabled;b.onclick=()=>{close();setTimeout(()=>target.click(),0);};nav.append(b);}
  pause(true);menu!.showModal();menu!.querySelector<HTMLButtonElement>('[data-close]')!.focus();
 });
}
