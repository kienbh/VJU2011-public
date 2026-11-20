import {nearPoetryBank,LAKE_POEM} from './lakePoem';
import {mountPoemReading} from './poemReading';
import {requestTimeout} from '../browserCompat';
import {onSceneTap} from '../player/sceneTap';
import {tr,trServer} from '../i18n/index.ts';
import {routeDistance,shortcutIndex} from './routeProgress';
import {createRoutePlanner} from './routePlanner';
import {routeSurfaces} from './routeSurfaces';
import {mountFishFeeding} from './fishFeeding';
import {mountCourier,COURIER} from './courier';
import {createCampusLife,type PetKind} from './campusLife';
import {mountNpcGreetings,type NpcTarget} from './npcGreetings';
import './npc.css';
import {createMailbox,MAILBOX} from './mailbox';
import {mountFeedback} from './feedback';
import * as T from 'three';
import {createPlayScenery} from './scenery';
import {greenConfig,greenItems,greenUnlockSeconds,RUBBISH} from '../../server/greenRules.mjs';
import {greenPanel} from './greenUi';
import {createRouteGuide} from './routeGuide';
import {PLACES,findRoute,clearSegment,PLACE_GROUPS,placeGroup,type Place} from './navigation';
import type {Collider} from '../types';
import type {WalkBounds} from '../player/collision';
import type {WalkController} from '../player/WalkController';
import type {StageSeat} from '../festival/stageLayout';
import './play.css';
import {currentParticipant} from '../greetings/participation';
import {mountTeaCorner} from './tea';
import {CAMPFIRE_CORNER} from './campfire';
import {createSeatedOrbit} from './seatedOrbit';
import {mountLibrary} from './library';
import {LAB_ENTRY,LAB_ROOMS,nearLabEntry} from './labEntry';
import {buildingMessages} from './buildingMessages';
import {createJournal,journalArea} from './journal';
import {journalPanel} from './journalUi';
import {journalDate} from './journalModel';
type Run={id:string;kind:string;state:any;elapsedMs?:number};
type Progress={collection:{item:string;created:number}[];profile:{favorites:string[];decor:string};runs:Run[];content:{id:string;text:string;meaning:string;type:string;source:string;example:string;action:string}[];community:number};
type Options={heightAt(x:number,z:number):number;scene:T.Scene;camera:T.PerspectiveCamera;walk:WalkController;colliders:Collider[];bounds:WalkBounds;canUse():boolean;journalActive():boolean;pause(v:boolean):void;photo():void;announce(s:string):void;petSound(kind:PetKind):void;isMuted?():boolean;sfx?(name:string,at?:{x:number;z:number}):void};
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function mountCampusPlay(o:Options){
 const restOrbit=createSeatedOrbit(o.camera);
 const storageKey='vju-play-pending-'+(currentParticipant()?.id||'none');
 const participant=currentParticipant();
 const journal=createJournal((participant?.id||'none')+':'+(participant?.mode||'anonymous'),o.journalActive,()=>journalArea(o.walk.position));
 let journalDay=journalDate(Date.now()),wasTea=false,wasCampfire=false,wasLibrary=false;
 const scenery=createPlayScenery(o.colliders,o.camera);o.scene.add(scenery.group);
 const labEntry=o.scene.getObjectByName(LAB_ENTRY.name);
 const domMessages=buildingMessages(o.scene);
 const life=createCampusLife(o.colliders,o.bounds);o.scene.add(life.root);
 const root=document.querySelector('#viewport')!,button=document.createElement('button');button.className='campus-play-button';button.textContent=tr('Khám phá');button.id='campus-explore';
 const finale=document.createElement('button');finale.type='button';finale.className='finale-shortcut';finale.textContent=tr('Xem kết lễ');finale.id='campus-finale';
 finale.onclick=()=>document.querySelector<HTMLButtonElement>('#festival-finale')?.click();
 document.querySelector('.global-greeting-actions')!.prepend(finale,button);
 const context=document.createElement('button');context.className='campus-play-button play-context';context.hidden=true;root.append(context);
 const routeHint=document.createElement('div');routeHint.className='play-route';routeHint.hidden=true;root.append(routeHint);
 const routeLabel=document.createElement('span');routeLabel.setAttribute('role','status');
 const routeCancel=document.createElement('button');routeCancel.type='button';routeCancel.textContent=tr('Tắt dẫn đường');routeCancel.onclick=()=>{clearRoute();o.announce(tr('Đã tắt dẫn đường.'));};routeHint.append(routeLabel,routeCancel);
 const dialog=document.createElement('dialog');dialog.className='play-dialog';dialog.setAttribute('aria-labelledby','play-title');document.body.append(dialog);
 let poemReading:ReturnType<typeof mountPoemReading>|null=null;
 const stopPoem=()=>{poemReading?.dispose();poemReading=null;};
 dialog.addEventListener('close',stopPoem);
 const rest=document.createElement('div');rest.className='play-rest';rest.hidden=true;rest.setAttribute('role','group');rest.setAttribute('aria-label',tr('Ngắm cảnh'));root.append(rest);
 let disabled=false,mapZone='all',mapZoom=1;
 let progress:Progress|null=null,run:Run|null=null,green:Run|null=null,panel='map',busy=false,error='',feedback='',clock=0,greenElapsed=0,active=false,seated:StageSeat|null=null,restoreFocus:HTMLElement|null=null,route:T.Vector3[]=[],destination:Place|null=null,nearAction:(()=>void)|null=null,routeLine:ReturnType<typeof createRouteGuide>|null=null,lastRender=0,pending:{path:string;body:unknown;key:string}|null=null;
 let routeClock=0,offRoute=0,contextFocus:{x:number;z:number}|null=null;
 const mailbox=createMailbox(o.colliders);o.scene.add(mailbox);
 const feedbackBox=mountFeedback({...o,canUse:():boolean=>o.canUse()&&!dialog.open&&!seated&&!tea.isBusy()&&!campfire.isBusy()&&!library.isBusy()&&!courier.isOpen()});
 const library=mountLibrary(o);
 const tea=mountTeaCorner({...o,remoteAvatars:false,canUse:()=>o.canUse()&&!dialog.open&&!seated&&!campfire.isBusy()&&!library.isBusy()&&!feedbackBox.isOpen()&&!courier.isOpen()});
 const campfire=mountTeaCorner({...o,remoteAvatars:false,canUse:()=>o.canUse()&&!dialog.open&&!seated&&!tea.isBusy()&&!library.isBusy()&&!feedbackBox.isOpen()&&!courier.isOpen()},CAMPFIRE_CORNER);
 const courier=mountCourier({...o,canUse:()=>o.canUse()&&!dialog.open&&!seated&&!tea.isBusy()&&!campfire.isBusy()&&!library.isBusy()&&!feedbackBox.isOpen()});
 const items=()=>progress?.collection.map(c=>c.item)||[];
 async function request(path:string,body?:unknown,key?:string){const r=await fetch('/api/play/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','Idempotency-Key':key||crypto.randomUUID()}:{},body:body?JSON.stringify(body):undefined,signal:requestTimeout(15000)});const d=await r.json();if(d.code==='PLAY_DISABLED')disabled=true;if(!r.ok)throw Object.assign(new Error(d.error||tr('Chưa kết nối được.')),{definite:r.status<500});return d;}
 async function load(){progress=await request('progress');const next=progress!.runs.find(r=>r.kind==='green'&&!r.state.done)||progress!.runs.find(r=>r.kind==='green')||null;if(next?.id!==green?.id)greenElapsed=0;green=next;if(green){greenElapsed=Math.max(greenElapsed,(green.elapsedMs||0)/1000);scenery.configureGreen(green.id,green.state);}scenery.decor(progress!.profile.decor);}
 function savePending(){try{pending?sessionStorage.setItem(storageKey,JSON.stringify(pending)):sessionStorage.removeItem(storageKey);}catch{}}
 async function mutate(path:string,body:unknown){
  if(busy)return;busy=true;error='';pending=pending||{path,body,key:crypto.randomUUID()};savePending();render();
  try{const result=await request(pending.path,pending.body,pending.key);pending=null;savePending();
   if(result.kind==='green'&&path==='event'){
    const action=(body as {action?:string;item?:number});
    if(action.action==='pick')journal.record('pick');
    if(action.action==='sort'&&result.state.sorted.includes(action.item))journal.record('sort');
    if(result.state.done&&!green?.state.done&&result.state.sorted.length===greenConfig(result.state).total)journal.record('green');
   }
if(result.kind){run=result;if(run!.kind==='green'){green=run;greenElapsed=Math.max(greenElapsed,...run!.state.picked.map((n:number)=>greenUnlockSeconds(run!.state,n)));}}await load();feedback=run?.state.feedback||'';}
  catch(e){error=trServer((e as Error).message);if((e as any).definite){pending=null;savePending();}else error+=tr(' Thao tác được giữ để thử lại, không nhận trùng phần thưởng.');}
  finally{busy=false;render();}
 }
 const localInfo=(which:string)=>which==='lake-poem'||which.startsWith('lab')||domMessages.some(m=>m.id===which);
 function show(which:string){if(!o.canUse()||busy||seated||feedbackBox.isOpen()||courier.isOpen())return;panel=which;restoreFocus=document.activeElement as HTMLElement;error='';o.pause(true);if(!dialog.open)dialog.showModal();render();if(!localInfo(which))void load().then(render).catch(e=>{error=e.message;render();});}
 function close(){if(busy)return;stopPoem();dialog.close();o.pause(false);restoreFocus?.focus();}
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});button.onclick=()=>show('map');
 function clearRoute(){
  if(routeLine){routeLine.dispose();routeLine=null;}routeClock=0;offRoute=0;
  destination=null;route=[];routeHint.hidden=true;routeLabel.textContent='';
 }
 let planner:ReturnType<typeof createRoutePlanner>|undefined;
 function planRoute(start:{x:number;z:number},end:{x:number;z:number}){
  if(!planner){const surfaces=routeSurfaces(o.scene);planner=createRoutePlanner(o.colliders,o.bounds,surfaces.lanes,surfaces.areas);}
  return findRoute(start,end,o.colliders,o.bounds,planner);
 }
 function navigate(place:Place){
  const result=planRoute(o.walk.position,place);if(!result.length){clearRoute();error=tr('Chưa tìm được tuyến an toàn. Hãy lùi khỏi vật cản rồi thử lại.');render();o.announce(error);return;}
  clearRoute();destination=place;route=result.map(p=>new T.Vector3(p.x,.22,p.z));routeLabel.textContent=tr('{0} · Theo vệt vàng',{0:place.name});
  routeLine=createRouteGuide(o.heightAt);routeLine.set(route);o.scene.add(routeLine.root);close();
 }
 function roadLines(){const lines:string[]=[];o.scene.traverse(m=>{if(m.userData.road&&Array.isArray(m.userData.centerline)){lines.push(m.userData.centerline.map(([x,z]:number[])=>{const p=m.localToWorld(new T.Vector3(x,0,z));return p.x+','+p.z;}).join(' '));}});return lines;}
 function mapSvg(){
  return `<div class="play-map-tools" aria-label="${tr('Phóng bản đồ')}">${[['all',tr('Toàn campus')],['court',tr('Sân lễ hội')],['lake',tr('Hồ & nhà khách')]].map(([id,label])=>`<button data-map-zone="${id}" aria-pressed="${mapZone===id}">${label}</button>`).join('')}</div><div class="play-map-scroll"><svg class="play-map" style="width:${mapZoom*100}%;min-width:${560*mapZoom}px;height:${360*mapZoom}px" viewBox="${mapZone==='court'?'-82 -28 190 100':mapZone==='lake'?'72 -202 132 115':'-110 -205 430 290'}" role="img" aria-label="${tr('Bản đồ campus, cổng ở phía dưới')}">${o.colliders.filter(c=>c.polygon).map(c=>`<polygon points="${c.polygon!.map(p=>p.join(',')).join(' ')}" fill="#8eafb1"/>`).join('')}${o.colliders.filter(c=>!c.polygon&&!c.segment&&c.maxX-c.minX>8&&c.maxZ-c.minZ>7).map(c=>`<rect x="${c.minX}" y="${c.minZ}" width="${c.maxX-c.minX}" height="${c.maxZ-c.minZ}" fill="#c4b69a"/>`).join('')}${roadLines().map(points=>`<polyline points="${points}" fill="none" stroke="#f8f1db" stroke-width="3"/>`).join('')}<rect x="-72" y="-20" width="144" height="56" fill="#d8cfbb" opacity=".7"/><rect x="145" y="-12" width="44" height="40" fill="#7a9b65"/><ellipse cx="34" cy="-2" rx="12" ry="9" fill="#89986a"/><rect x="-70" y="12" width="28" height="22" fill="#89986a"/>${[[tr('Nhà hiệu bộ'),18,-48],[tr('Hội trường'),58,-54],[tr('Giảng đường 1'),-27,-59],[tr('Giảng đường 2'),-62,-59],[tr('Nhà đa năng'),112,8],['RMIT · VNU',170,-66],['Club House',170,-111],[tr('Nhà khách'),147,-191],[tr('Hồ'),-5,-128]].map(([name,x,z])=>`<text x="${x}" y="${z}" text-anchor="middle" font-size="${mapZone==='all'?4.5:3.5}" fill="#35483f">${name}</text>`).join('')}${route.length?`<polyline points="${route.map(p=>p.x+','+p.z).join(' ')}" fill="none" stroke="#b07a27" stroke-width="1.6"/>`:''}${PLACES.map((p,i)=>`<g><circle cx="${p.x}" cy="${p.z}" r="5" fill="#325d50"/><text x="${p.x}" y="${p.z+2}" text-anchor="middle" font-size="7" fill="white">${i+1}</text></g>`).join('')}<path d="M 0,-9 L -4,3 L 0,0 L 4,3 Z" transform="translate(${o.walk.position.x} ${o.walk.position.z}) rotate(${-o.walk.heading*180/Math.PI})" fill="#b25939" stroke="white" stroke-width="1"/></svg></div><div class="play-map-zoom"><button data-map-zoom="-1" aria-label="${tr('Thu nhỏ bản đồ')}">−</button><output>${Math.round(mapZoom*100)}%</output><button data-map-zoom="1" aria-label="${tr('Phóng to bản đồ')}">＋</button><button data-map-zoom="0">${tr('Vừa khung')}</button><button data-map-full>${tr('Phóng to toàn màn hình')}</button></div><p class="play-map-legend"><span>${tr('● Bạn ở đây')}</span> ${tr('· Số trên bản đồ tương ứng địa điểm bên dưới. Chọn khu để phóng lớn; tuyến vàng là đường đi đã kiểm tra vật cản.')}</p>`;
 }
 function render(){
  if(!dialog.open)return;
  stopPoem();
  const has=items();
  const infoPanel=localInfo(panel);
  let title=tr('Sân trường của bạn'),body='';
  if(panel==='map')body=`<p>${tr('Chọn một nơi để chơi, khám phá hoặc nghỉ. Bạn có thể đi theo vệt vàng và tự dừng bất cứ lúc nào.')}</p>${mapSvg()}${PLACE_GROUPS.map(group=>`<section aria-label="${group.name}"><h3>${group.name}</h3>${PLACES.filter(p=>placeGroup(p)===group.id).map(p=>`<div class="play-place"><span>${PLACES.indexOf(p)+1}. ${p.name}</span><button data-route="${p.id}">${tr('Dẫn đường')}</button><button data-favorite="${p.id}" aria-label="${tr('Lưu {0}',{0:p.name})}">${progress?.profile.favorites.includes(p.id)?'★':'☆'}</button></div>`).join('')}</section>`).join('')}<div class="play-actions"><button data-panel="journal">${tr('Nhật ký trải nghiệm')}</button><button data-panel="photos">${tr('Bưu thiếp')}</button></div><p><small>${tr('Khách lưu theo lượt trình duyệt; SSO giữ tiến độ trên thiết bị khác. Không cần hoàn thành nhiệm vụ để ngắm cảnh.')}</small></p>`;
  if(panel==='journal'){
   title=tr('Nhật ký trải nghiệm');const saved=`<p>${has.includes('green-first')?tr('Đã hoàn thành một vòng sân xanh'):tr('Chưa hoàn thành vòng sân xanh')}</p><p>${tr('{0} lượt tài khoản đã hoàn thành vòng xanh đầu tiên. Đây là đóng góp trong trò chơi.',{0:progress?.community||0})}</p><h3>${tr('Góc trang trí riêng')}</h3><p>${tr('Đồ trang trí đặt cạnh góc anh đào, chỉ thay góc của bạn.')}</p><div class="play-actions">${[['none',tr('Cất đồ')],['label',tr('Nhãn chậu')],['pot',tr('Chậu trang trí')],...(has.includes('fish-3')?[['model',tr('Mô hình đã nhận')]]:[])].map(([id,n])=>`<button data-decor="${id}" ${id==='label'&&!has.includes('green-first')||id==='pot'&&!has.includes('green-perfect')||id==='model'&&!has.includes('fish-3')?'disabled':''}>${n}${progress?.profile.decor===id?' ✓':''}</button>`).join('')}</div><small>${tr('Vòng xanh đầu tiên → nhãn chậu; 6 món đúng không sai → chậu.')}</small>${has.some(id=>id.startsWith('thought-'))?`<h3>${tr('Điều hay đã lưu')}</h3>`:''}${progress?.content.filter(c=>has.includes('thought-'+c.id)).map(c=>`<details><summary>${esc(c.text)}</summary><p>${esc(c.meaning)}</p><p>${esc(c.example)}</p><p>${esc(c.action)}</p><small>${esc(c.type)} · ${esc(c.source)}</small></details>`).join('')||''}<h3>${tr('Chỗ yêu thích')}</h3>${PLACES.filter(p=>progress?.profile.favorites.includes(p.id)).map(p=>`<button data-route="${p.id}">${p.name}</button>`).join('')||`<p>${tr('Lưu một địa điểm từ bản đồ.')}</p>`}<h3>${tr('Bóng đá')}</h3><p>${tr('Đứng phía sau bóng để chọn hướng, rồi bấm Sút bóng. Mũi tên chỉ hướng bóng sẽ bay.')}</p>`;
   const snapshot=journal.snapshot();body=journalPanel(snapshot.data,journalDay,snapshot.durable)+`<details><summary>${tr('Phần thưởng & chỗ yêu thích')}</summary>${saved}</details>`;
  }
  if(panel==='photos'){title=tr('Năm bưu thiếp campus');body=`<p>${tr('Chọn góc, đi tới nơi rồi dùng Chụp ảnh. Ảnh tải về thiết bị, không tự công khai.')}</p><ol class="play-photo-list">${[tr('Cổng vào VJU'),tr('Vườn Hoa Tri Ân'),tr('Dưới tán anh đào'),tr('Mặt hồ buổi chiều'),tr('Ao sen và sân nhà khách')].map(t=>`<li>${t}</li>`).join('')}</ol><button data-panel="map">${tr('Chọn nơi trên bản đồ')}</button>`;}
  if(panel==='green'){title=tr('Sân trường xanh');body=greenPanel(green,feedback);}
  if(panel==='labs'){
   title=tr('Phòng thí nghiệm');body=`<p>${tr('Chọn phòng bạn muốn ghé.')}</p><div class="lab-room-list">${LAB_ROOMS.map(l=>`<button data-panel="${l.id}">${l.name}<span>${tr('Đang phát triển')}</span></button>`).join('')}</div>`;
  }
  const lab=LAB_ROOMS.find(l=>l.id===panel);
  if(lab){title=lab.name;body=`<p class="lab-coming-soon" role="status">${tr('Tính năng đang phát triển')}</p><div class="play-actions"><button data-panel="labs">${tr('← Chọn phòng khác')}</button><button data-close>${tr('Về sân trường')}</button></div>`;}
  const dom=domMessages.find(m=>m.id===panel);
  if(dom){title=dom.title;body=`<p class="building-message">${esc(dom.text)}</p>${dom.lines.length?`<ol class="building-lessons">${dom.lines.map(line=>`<li>${esc(line)}</li>`).join('')}</ol>`:''}<button data-close>${tr('Về sân trường')}</button>`;}
  if(panel==='lake-poem'){title=tr('Đọc thơ bên hồ');body=`<article class="lake-poem" lang="vi"><h3>Bên hồ</h3><p class="lake-poem-author">VJU2011</p><div>${LAKE_POEM.map(line=>`<p>${esc(line)}</p>`).join('')}</div></article>`;}
  dialog.classList.toggle('green-dialog',panel==='green');
  dialog.classList.toggle('lab-dialog',infoPanel&&panel!=='lake-poem');
  dialog.innerHTML=`<header><h2 id="play-title">${title}</h2><button data-close aria-label="${tr('Đóng trải nghiệm')}">×</button></header><div class="play-body"><p class="play-error" role="status">${esc(error)}</p>${!infoPanel&&pending&&!busy?`<button data-retry>${tr('Thử lại thao tác đang chờ')}</button>`:''}${body}${panel!=='map'?`<div class="play-actions"><button data-panel="map">${tr('Bản đồ')}</button></div>`:''}</div>`;
  if(panel==='lake-poem')poemReading=mountPoemReading(dialog.querySelector<HTMLElement>('.lake-poem')!,['Bên hồ. VJU2011.',...LAKE_POEM.map(line=>line+'.')].join('\n'),()=>o.isMuted?.()??false);
  dialog.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{b.disabled ||= !infoPanel&&(busy||!!pending&&!b.hasAttribute('data-retry')&&!b.hasAttribute('data-close')); });
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',close));
  dialog.querySelector<HTMLSelectElement>('[data-journal-day]')?.addEventListener('change',e=>{journalDay=(e.target as HTMLSelectElement).value;render();dialog.querySelector<HTMLSelectElement>('[data-journal-day]')?.focus();});
  dialog.querySelector('[data-journal-refresh]')?.addEventListener('click',()=>{render();dialog.querySelector<HTMLButtonElement>('[data-journal-refresh]')?.focus();});
  dialog.querySelectorAll<HTMLElement>('[data-panel]').forEach(b=>b.onclick=()=>{panel=b.dataset.panel!;render();if(panel.startsWith('lab'))dialog.querySelector<HTMLButtonElement>('[data-panel], [data-close]')?.focus();});
  dialog.querySelectorAll<HTMLElement>('[data-map-zone]').forEach(b=>b.onclick=()=>{mapZone=b.dataset.mapZone!;render();dialog.querySelector<HTMLElement>(`[data-map-zone="${mapZone}"]`)?.focus();});
  dialog.querySelectorAll<HTMLElement>('[data-map-zoom]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.mapZoom);mapZoom=n===0?1:Math.min(3,Math.max(1,mapZoom+n*.5));render();dialog.querySelector<HTMLElement>(`[data-map-zoom="${n}"]`)?.focus();});
  dialog.querySelector<HTMLElement>('[data-map-full]')?.addEventListener('click',()=>{dialog.classList.toggle('play-map-full');dialog.querySelector('[data-map-full]')!.textContent=dialog.classList.contains('play-map-full')?tr('Thu gọn cửa sổ'):tr('Phóng to toàn màn hình');});
  dialog.querySelectorAll<HTMLElement>('[data-route]').forEach(b=>b.onclick=()=>navigate(PLACES.find(p=>p.id===b.dataset.route)!));
  dialog.querySelectorAll<HTMLElement>('[data-favorite]').forEach(b=>b.onclick=()=>{const id=b.dataset.favorite!,favorites=progress?.profile.favorites||[];void mutate('profile',{favorites:favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id],decor:progress?.profile.decor||'none'});});
  dialog.querySelectorAll<HTMLElement>('[data-decor]').forEach(b=>b.onclick=()=>void mutate('profile',{favorites:progress?.profile.favorites||[],decor:b.dataset.decor}));
  dialog.querySelectorAll<HTMLElement>('[data-start]').forEach(b=>b.onclick=()=>{if(b.dataset.start==='green')greenElapsed=0;void mutate('start',{kind:b.dataset.start,version:2});});
  dialog.querySelectorAll<HTMLElement>('[data-sort]').forEach(b=>b.onclick=()=>{const [item,bin]=b.dataset.sort!.split(':');void mutate('event',{run:green!.id,action:'sort',item:Number(item),bin});});
  dialog.querySelector<HTMLElement>('[data-finish]')?.addEventListener('click',()=>void mutate('event',{run:green!.id,action:'finish'}));
  dialog.querySelector<HTMLElement>('[data-retry]')?.addEventListener('click',()=>void mutate(pending!.path,pending!.body));
 }
 function sit(seat:StageSeat){if(!o.walk.sitDown(seat))return;journal.record(seat.id.startsWith('lotus')?'lotus':'sakura');seated=seat;restOrbit.set(seat);o.pause(true);document.body.classList.add('play-resting');rest.hidden=false;rest.innerHTML=`<span>${seat.id.startsWith('lotus')?tr('Bạn có thể để việc đang nghĩ sang một bên trong chốc lát.'):tr('Kéo chuột hoặc vuốt trên cảnh để ngắm hoa và mặt hồ.')}</span><button data-angle="-1">${tr('← Góc trước')}</button><button data-angle="1">${tr('Góc sau →')}</button><button data-photo>${tr('Chụp ảnh')}</button><button data-stand>${tr('Đứng dậy')}</button>`;rest.querySelectorAll<HTMLElement>('[data-angle]').forEach(b=>b.onclick=()=>restOrbit.step(Number(b.dataset.angle)));rest.querySelector('[data-photo]')!.addEventListener('click',o.photo);rest.querySelector('[data-stand]')!.addEventListener('click',stand);rest.querySelector<HTMLButtonElement>('button')!.focus();}
 function stand(){if(!seated)return;o.walk.standUp();seated=null;restOrbit.set(null);rest.hidden=true;document.body.classList.remove('play-resting');o.pause(false);button.focus();}
 function greetPet(id:number){const kind=life.interact(id);if(kind){o.petSound(kind);journal.record('pet');}}
 // Walking NPCs plus the six festival visitors (merged static meshes, picked by position; visible only with the festival layer).
 const walkerTargets:NpcTarget[]=life.npcTargets().map(n=>({id:'walker-'+n.index,lang:n.lang,label:n.lang==='ja'?tr('Khách Nhật · NPC'):tr('Khách Việt · NPC'),position:n.position,height:1.8,visible:false,seed:n.index*3+1,onGreet:(at:T.Vector3)=>life.greetNpc(n.index,o.walk.position)}));
 let festivalTargets:NpcTarget[]|null=null,festivalRoot:T.Object3D|null=null;
 const shown=(node:T.Object3D|null)=>{for(let n=node;n;n=n.parent)if(!n.visible)return false;return !!node;};
 function npcTargets(){
  const live=life.npcTargets();walkerTargets.forEach((t,i)=>{t.visible=live[i].visible;});
  if(!festivalTargets){festivalRoot=o.scene.getObjectByName('festival-atmosphere')??null;const spots=(festivalRoot?.userData.decorativeNPCs??[]) as {x:number;z:number}[];
   if(festivalRoot)festivalTargets=spots.map((p,i)=>({id:'festival-'+i,lang:i%2?'vi':'ja',label:i%2?tr('Khách Việt · NPC'):tr('Khách Nhật · NPC'),position:new T.Vector3(p.x,.25,p.z),height:1.75,visible:false,seed:i*5+2}));}
  const festivalShown=shown(festivalRoot);festivalTargets?.forEach(t=>{t.visible=festivalShown;});
  return festivalTargets?[...walkerTargets,...festivalTargets]:walkerTargets;
 }
 const npcs=mountNpcGreetings({camera:o.camera,host:root as HTMLElement,targets:npcTargets,isMuted:()=>o.isMuted?.()??false,announce:o.announce});
 const fishFeeding=mountFishFeeding({poem:{near:nearPoetryBank,open:()=>show('lake-poem')},onFeed:()=>journal.record('feed'),koi:scenery.koi,scene:o.scene,camera:o.camera,at:()=>o.walk.position,announce:o.announce,splash:at=>o.sfx?.('splash',at),canUse:()=>active&&!dialog.open&&!seated&&!tea.isBusy()&&!campfire.isBusy()&&!library.isBusy()&&!feedbackBox.isOpen()&&!courier.isOpen()});
 const ray=new T.Raycaster(),pointer=new T.Vector2();
 const canvas=root.querySelector('canvas');
 if(canvas)onSceneTap(canvas,e=>{
  if(!active||dialog.open||seated||tea.isBusy()||campfire.isBusy()||library.isBusy()||feedbackBox.isOpen()||courier.isOpen())return;
  const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,o.camera);
  if(labEntry&&nearLabEntry(o.walk.position)&&ray.intersectObject(labEntry,true).length){show('labs');return;}
  const dom=domMessages.find(m=>m.near(o.walk.position)&&ray.intersectObject(m.node,true).length);
  if(dom){show(dom.id);return;}
  if(Math.hypot(o.walk.position.x-COURIER.x,o.walk.position.z-COURIER.z)<5.5&&ray.intersectObject(courier.root,true).length){courier.open();return;}
  const npc=npcs.hit(ray,o.walk.position);if(npc){npcs.greet(npc);return;}
  const pet=life.hit(ray,o.walk.position);if(pet!==null){greetPet(pet);return;}
  if(Math.hypot(o.walk.position.x-MAILBOX.x,o.walk.position.z-MAILBOX.z)<4.5&&ray.intersectObject(mailbox,true).length)feedbackBox.open();
 });
 context.onclick=()=>nearAction?.();
 window.addEventListener('keydown',e=>{if((e.target as HTMLElement)?.closest('input,textarea,select'))return;if(e.code==='Escape'&&seated){e.preventDefault();e.stopImmediatePropagation();stand();}if(e.code==='KeyE'&&!e.repeat&&nearAction&&!dialog.open&&active){e.preventDefault();e.stopImmediatePropagation();nearAction();}},true);
 try{const raw=sessionStorage.getItem(storageKey);if(raw)pending=JSON.parse(raw);}catch{}
 void load().catch(()=>{});
 return {suspend(){tea.leave();campfire.leave();void library.close();stand();close();},recordActivity:journal.record,focus:()=>tea.focus()||campfire.focus()||(!context.hidden?contextFocus:null),navigateTo(id:string){const p=PLACES.find(p=>p.id===id);if(p)navigate(p);},cancelRoute:clearRoute,isBusy:()=>dialog.open||!!seated||tea.isBusy()||campfire.isBusy()||library.isBusy()||feedbackBox.isOpen()||courier.isOpen(),open:()=>show('map'),scenery,
  update(dt:number){
   poemReading?.checkMute();
   tea.update(dt);campfire.update(dt);
   journal.tick();
   const teaNow=tea.state().seat!==null,campfireNow=campfire.state().seat!==null,libraryNow=library.isBusy();
   if(teaNow&&!wasTea)journal.record('tea');if(campfireNow&&!wasCampfire)journal.record('campfire');if(libraryNow&&!wasLibrary)journal.record('library');
   wasTea=teaNow;wasCampfire=campfireNow;wasLibrary=libraryNow;
   clock+=dt;active=o.canUse()&&!document.hidden&&!disabled;const at=o.walk.position,reduced=document.body.classList.contains('reduced-motion');scenery.update(clock,reduced,at);life.update(dt,at,reduced,active&&!dialog.open&&!seated);
   fishFeeding.update();npcs.update(active&&!dialog.open&&!seated,at);
   // Finish the route permanently, including when arriving beside a seat or library.
   if(destination&&Math.hypot(destination.x-at.x,destination.z-at.z)<4&&clearSegment(at,destination,o.colliders,o.bounds)){const name=destination.name;clearRoute();o.announce(tr('Đã tới · {0}',{0:name}));}
   const showRoute=active&&!dialog.open&&!seated&&!tea.isBusy()&&!campfire.isBusy()&&!library.isBusy();
   routeHint.hidden=!destination||!showRoute;if(routeLine){routeLine.root.visible=showRoute;routeLine.update(dt,reduced);}
   if(destination&&showRoute){routeClock+=dt;if(routeClock>=.4){routeClock=0;const deviation=routeDistance(at,route);const next=shortcutIndex(at,route,(a,b)=>planner!.clearSegment(a,b));if(next>=1&&deviation<=6)route=[at.clone(),...route.slice(next)];routeLine?.set(route);routeLabel.textContent=`${destination.name} · ${Math.round(routeLine?.distance()||0)} m`;if(deviation>6||next<0)offRoute+=.4;else offRoute=0;if(offRoute>=1.2){const replacement=planRoute(at,destination);if(replacement.length){route=replacement.map(p=>new T.Vector3(p.x,0,p.z));routeLine?.set(route);}else{clearRoute();o.announce(tr('Chưa tìm được lối đi thông thoáng. Hãy lùi khỏi vật cản và chọn lại điểm đến.'));}offRoute=0;}}}
   if(tea.isBusy()||campfire.isBusy()||library.isBusy()||feedbackBox.isOpen()||courier.isOpen()){context.hidden=true;nearAction=null;return;}
   button.hidden=!active;context.hidden=true;nearAction=null;document.body.classList.toggle('play-away',active&&(at.z<-85||at.x>118));
   if(seated){restOrbit.update();return;}
   if(green&&!dialog.open&&active&&Math.hypot(at.x-135,at.z+36)<30)greenElapsed+=dt;
   scenery.litter.forEach((m,i)=>m.visible=!!green&&!green.state.done&&!green.state.picked.includes(i)&&i<greenConfig(green.state).total&&greenElapsed>=greenUnlockSeconds(green.state,i));
   if(!active||dialog.open||busy)return;
   contextFocus=null;let label='';const seat=scenery.seats.find(s=>Math.hypot(s.x-at.x,s.z-at.z)<2);
   const litter=scenery.litter.findIndex(m=>m.visible&&Math.hypot(m.position.x-at.x,m.position.z-at.z)<2.1);
   const dom=domMessages.find(m=>m.near(at));
   if(Math.hypot(at.x-MAILBOX.x,at.z-MAILBOX.z)<4.5){label=tr('Góp ý cho campus');nearAction=()=>feedbackBox.open();}
   else if(Math.hypot(at.x-COURIER.x,at.z-COURIER.z)<5.5){label=tr('Nhận hàng với anh Shopee');nearAction=()=>courier.open();}
   else if(litter>=0&&green){label=tr('Nhặt {0} · {1}/6',{0:RUBBISH[greenItems(green.state)[litter]].name,1:green.state.picked.length-green.state.sorted.length});nearAction=()=>{void mutate('event',{run:green!.id,action:'pick',item:litter}).then(()=>{o.announce(error||tr('Đã cho vào túi phân loại.'));});};}
   else if(Math.hypot(at.x-135,at.z+34)<4){label=tr('Trạm phân loại');nearAction=()=>show('green');}
   else if(Math.hypot(at.x-170,at.z+39)<5){label=tr('Vào thư viện VJU');nearAction=()=>void library.open();}
   else if(labEntry&&nearLabEntry(at)){label=tr('Phòng thí nghiệm');nearAction=()=>show('labs');}
   else if(dom){label=dom.building==='DOM-C'?tr('Đọc 5 điều Bác Hồ dạy'):tr('Lời nhắc DOM-E');nearAction=()=>show(dom.id);}
   else if(seat){label=seat.id.startsWith('lotus')?tr('Ngồi bên ao sen'):tr('Ngồi ngắm hoa');nearAction=()=>sit(seat);}
   const pet=life.nearest(at);if(!nearAction&&pet!==null){label=tr('Chào bạn nhỏ 🐾');nearAction=()=>greetPet(pet);}
   const npc=nearAction?null:npcs.nearest(at);if(npc){label=npc.lang==='ja'?tr('Chào hỏi · tiếng Nhật'):tr('Chào hỏi · tiếng Việt');nearAction=()=>npcs.greet(npc.id);}
   if(nearAction)contextFocus=Math.hypot(at.x-MAILBOX.x,at.z-MAILBOX.z)<4.5?MAILBOX:litter>=0?scenery.litter[litter].position:Math.hypot(at.x-135,at.z+34)<4?{x:135,z:-34}:Math.hypot(at.x-170,at.z+39)<5?{x:170,z:-39}:labEntry&&nearLabEntry(at)?LAB_ENTRY:dom?dom.position:npc?npc.position:seat||at;
   context.hidden=!nearAction;context.textContent=(matchMedia('(pointer:coarse)').matches?'':'E · ')+label;
   if(nearAction){const old=document.querySelector<HTMLElement>('#rpg-interact');if(old)old.hidden=true;}
   if(clock-lastRender>1){lastRender=clock;}
  },state:()=>({journal:journal.snapshot(),litter:scenery.litter.map(m=>({position:m.position.toArray(),visible:m.visible,kind:m.userData.kind})),courier:courier.state(),life:life.state(),npc:npcs.state(),panel,green,run,progress,tea:tea.state(),campfire:campfire.state(),seated:seated?.id,route:route.map(v=>[v.x,v.z]),destination:destination?.id,pending:!!pending,feedbackOpen:feedbackBox.isOpen()})};
}
