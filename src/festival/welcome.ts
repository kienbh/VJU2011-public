import {tr} from '../i18n/index.ts';
import {welcomeMap} from './welcomeMap';
import './welcome.css';
export function showWelcome(onWalk:()=>void,onGreeting:()=>void,note=''){
 const welcome=document.createElement('section');welcome.className='festival-welcome';welcome.setAttribute('aria-label',tr('Chào mừng đến lễ hội tri ân VJU'));
 welcome.innerHTML=`<div class="welcome-card welcome-journey">
 <div class="welcome-picture">${welcomeMap()}<button class="welcome-map-expand" type="button">${tr('Phóng to sơ đồ')}</button></div>
 <div class="welcome-copy"><p class="welcome-kicker">${tr('VJU · NGÀY NHÀ GIÁO VIỆT NAM')}</p><h2>${tr('Một lời cảm ơn,')} <br>${tr('một mùa hoa')}</h2><p>${tr('Qua cổng, rẽ trái vào sân. Ghé Bảng Tri Ân, gửi lời chúc, chọn hoa và để lại dấu ấn của bạn.')}</p>
 <ol class="welcome-stops"><li><b>${tr('Đọc & gửi lời tri ân')}</b><span>${tr('Thiệp, hoa và những suy ngẫm về nghề thầy.')}</span></li><li><b>${tr('Dạo chơi bên hồ')}</b><span>${tr('Góc anh đào, ao sen và sân bóng.')}</span></li><li><b>${tr('Ngắm pháo hoa')}</b><span>${tr('Kết lễ 20.11 khi bạn sẵn sàng.')}</span></li></ol>
 <div class="welcome-actions"><button id="welcome-walk">${tr('Vào sân trường')}</button><button id="welcome-greeting" type="button">${tr('Gửi lời chúc ngay')}</button></div><p class="welcome-direct-note">${tr('Chỉ muốn gửi lời cảm ơn? Chọn bó hoa hoặc cuốn sách tượng trưng, không cần đi chơi.')}</p><button type="button" class="welcome-map-mobile">${tr('Xem sơ đồ sân lễ hội')}</button><p class="welcome-note">${tr('Bản dùng thử · Thiệp và chậu hoa dùng chung 3 lượt gửi. Lời cảm ơn công khai sau khi duyệt.')}</p></div></div>`;
 const map=document.createElement('dialog');map.className='welcome-map-dialog';map.setAttribute('aria-labelledby','welcome-map-heading');
 map.innerHTML=`<header><h2 id="welcome-map-heading">${tr('Sơ đồ sân lễ hội')}</h2><button type="button" aria-label="${tr('Đóng sơ đồ')}">×</button></header><p>${tr('Kéo để xem toàn bộ sơ đồ.')}</p><div class="welcome-map-scroll" tabindex="0" aria-label="${tr('Sơ đồ có thể cuộn')}"></div>`;
 document.body.append(map);let mapTrigger:HTMLElement|null=null;
 welcome.querySelectorAll<HTMLButtonElement>('.welcome-map-expand,.welcome-map-mobile').forEach(button=>button.onclick=()=>{
  mapTrigger=button;map.querySelector('.welcome-map-scroll')!.append(welcome.querySelector('svg')!);map.showModal();map.querySelector<HTMLButtonElement>('header button')!.focus();
 });
 let zoom=1;const tools=document.createElement('div');tools.className='welcome-zoom-tools';tools.innerHTML=`<button type="button" data-zoom="-1" aria-label="${tr('Thu nhỏ bản đồ')}">−</button><output aria-live="polite">100%</output><button type="button" data-zoom="1" aria-label="${tr('Phóng to bản đồ')}">＋</button><button type="button" data-zoom="0">${tr('Vừa khung')}</button>`;
 map.querySelector('header')!.after(tools);
 const resetZoom=()=>{const svg=map.querySelector<SVGElement>('svg')||welcome.querySelector<SVGElement>('svg');if(svg){svg.style.width=zoom===1?'100%':(zoom*100)+'%';svg.style.minWidth=760*zoom+'px';}tools.querySelector('output')!.textContent=Math.round(zoom*100)+'%';};
 tools.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.zoom);zoom=n===0?1:Math.max(1,Math.min(3,zoom+n*.5));resetZoom();});
 map.querySelector('header button')!.addEventListener('click',()=>map.close());
 map.addEventListener('close',()=>{const svg=map.querySelector<SVGElement>('svg')!;svg.style.width='';svg.style.minWidth='';zoom=1;tools.querySelector('output')!.textContent='100%';welcome.querySelector('.welcome-picture')!.prepend(svg);mapTrigger?.focus();});
 const viewport=document.querySelector('#viewport')!;viewport.append(welcome);document.body.classList.add('welcome-open');
 if(note){const message=document.createElement('p');message.setAttribute('role','status');message.textContent=note;welcome.querySelector('.welcome-actions')!.before(message);welcome.querySelector('#welcome-walk')!.textContent=tr('Vào lại campus');}
 const background=Array.from(viewport.children).filter(e=>e!==welcome) as HTMLElement[];background.forEach(e=>e.inert=true);
 welcome.querySelector('#welcome-walk')!.addEventListener('click',()=>{background.forEach(e=>e.inert=false);map.remove();welcome.remove();document.body.classList.remove('welcome-open');onWalk();});
 welcome.querySelector('#welcome-greeting')!.addEventListener('click',onGreeting);
 welcome.querySelector<HTMLButtonElement>('#welcome-walk')!.focus({preventScroll:true});
}
