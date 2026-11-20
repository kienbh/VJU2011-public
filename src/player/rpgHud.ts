import {tr} from '../i18n/index.ts';
import {bagContent,cameraContent,journeyContent} from './panelContent';
import {currentParticipant} from '../greetings/participation';
import {createJourney} from './journey';
import {nearestStageSeat} from '../festival/stageLayout';
import {BOARD,GARDEN,GARDEN_PLOTS,PLANT_GARDEN,nearFlowerGarden,nearPlantGarden,nearestEmptyPlot,plotAt} from '../festival/festivalLayout';
import type {FlowerLoopState} from '../festival/flowerLoop';
import * as THREE from 'three';
import type {FlowerKind} from '../greetings/flowers';
import {VISITOR_STYLES} from './visitorAvatar';
import {readAppearance,type Appearance} from './appearance';
import {mountAvatarPreview} from './avatarPreview';
import type {WalkController} from './WalkController';
import type {CampusFootball as Football} from './campusFootball';
import './rpg.css';

type Options={accepting():boolean;navigate(id:string):void;walk:WalkController;getFlowerState():FlowerLoopState;setAppearance(appearance:Appearance):void;getBasket():FlowerKind[];pick(kind:FlowerKind):string;
  openGarden():void;setName(name:string):void;takePhoto():void;openPlot(slot:number):void; ownPots():number;openBoard():void;pause(value:boolean):void;isWriting():boolean;football:Football;shoot():boolean;mountGraphics?(root:HTMLElement):void;};
export function mountRpgHud(options:Options){
  let store:Storage|null=null;try{store=localStorage;}catch{}
  const journey=createJourney(currentParticipant()?.id||'local',store);
  const root=document.createElement('section');root.className='rpg-hud';root.setAttribute('aria-label',tr('Hành trình lễ hội'));
  root.innerHTML=`<div class="rpg-objective"><span class="rpg-chapter">${tr('HÀNH TRÌNH 20.11')}</span><strong id="rpg-goal">${tr('Ghé Bảng Tri Ân')}</strong><span id="rpg-bearing"></span><button id="journey-route">${tr('Chỉ đường')}</button><button id="journey-collapse" aria-expanded="true">${tr('Thu gọn')}</button><progress max="5" value="0" aria-label="${tr('Tiến độ hành trình')}"></progress></div>
    <div class="rpg-dock" aria-label="${tr('Công cụ người chơi')}"><button data-panel="quests"><span>◈</span>${tr('Nhiệm vụ')}<kbd>Q</kbd></button><button data-panel="bag"><span>❀</span>${tr('Túi hoa')} <b id="rpg-count">0/5</b><kbd>I</kbd></button><button data-panel="avatar"><span>♙</span>${tr('Nhân vật')}<kbd>C</kbd></button><button data-panel="camera"><span>⌖</span>${tr('Góc nhìn')}<kbd>V</kbd></button><button id="rpg-photo"><span>◉</span>${tr('Chụp ảnh')}<kbd>P</kbd></button></div>
    <button id="rpg-interact" hidden></button><p id="rpg-notice" role="status" hidden></p>`;
  document.querySelector('#viewport')!.append(root);
  const dialog=document.createElement('dialog');dialog.className='rpg-dialog';dialog.setAttribute('aria-labelledby','rpg-dialog-title');document.body.append(dialog);
  let plantSlot=-1;const esc=(v:string)=>v.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]!));
  let style=0,board=false,bouquet=false,sent=false,celebrated=false,activePanel='',lastKey='',noticeUntil=0,panelNotice='';
  let appearance=readAppearance(null),preview:ReturnType<typeof mountAvatarPreview>|undefined;
  try{style=Math.min(2,Math.max(0,Number(localStorage.getItem('vju2011-avatar-style'))||0));}catch{/* optional */}
  try{appearance=readAppearance(JSON.parse(localStorage.getItem('vju2011-avatar-v2')||'null'));}catch{/* optional */}
  style=appearance.palette;options.setAppearance(appearance);
  board=journey.has('board');bouquet=journey.has('flowers');sent=journey.has('greeting');celebrated=journey.has('finale');
  let collapsed=false;try{collapsed=localStorage.getItem('vju2011-journey-collapsed')==='1';}catch{}
  const objective=root.querySelector<HTMLElement>('.rpg-objective')!,collapse=root.querySelector<HTMLButtonElement>('#journey-collapse')!;function fold(){objective.classList.toggle('collapsed',collapsed);collapse.setAttribute('aria-expanded',String(!collapsed));collapse.textContent=collapsed?tr('Mở hành trình'):tr('Thu gọn');}fold();collapse.onclick=()=>{collapsed=!collapsed;fold();try{localStorage.setItem('vju2011-journey-collapsed',collapsed?'1':'0');}catch{}};
  root.querySelector<HTMLButtonElement>('#journey-route')!.onclick=()=>options.navigate(!board?'board':!bouquet?'flowers':!journey.has('plant')?'plant':'stage');
  let playerName='';try{playerName=localStorage.getItem('vju2011-player-name')??localStorage.getItem('vju2011-flower-name')??'';}catch{/* optional */}
  options.setName(playerName);
  const boardPoint=new THREE.Vector3(BOARD.x,1.7,BOARD.z),gardenPoint=new THREE.Vector3(GARDEN.x,1.7,GARDEN.z),plantPoint=new THREE.Vector3(PLANT_GARDEN.x+PLANT_GARDEN.w/2,1.7,PLANT_GARDEN.z);
  const goal=root.querySelector('#rpg-goal')!,bearing=root.querySelector('#rpg-bearing')!,count=root.querySelector('#rpg-count')!,progress=root.querySelector('progress')!,action=root.querySelector<HTMLButtonElement>('#rpg-interact')!,notice=root.querySelector<HTMLElement>('#rpg-notice')!;
  function close(){preview?.dispose();preview=undefined;dialog.close();activePanel='';options.pause(options.isWriting());}
  function announce(text:string){notice.textContent=text;notice.hidden=false;noticeUntil=performance.now()+4000;}
  function open(panel:string){
    if(options.isWriting())return;
    activePanel=panel;panelNotice='';render();options.pause(true);if(!dialog.open)dialog.showModal();
  }
  function render(){
    preview?.dispose();preview=undefined;
    const basket=options.getBasket(),near=nearFlowerGarden(options.walk.position),planted=options.getFlowerState().planted;
    const title=activePanel==='quests'?tr('Một bó hoa, một lời cảm ơn'):activePanel==='bag'?tr('Túi hoa của bạn'):activePanel==='plant'?tr('Cắm bó hoa vào ô {0}',{0:plantSlot+1}):activePanel==='flower'?tr('Bó hoa ở ô {0}',{0:plantSlot+1}):activePanel==='avatar'?tr('Người bạn trong sân trường'):tr('Góc nhìn & chuyển động');
    let body='';
    if(activePanel==='quests')body=journeyContent({board,flowers:bouquet||basket.length>0||options.ownPots()>0,planted:options.ownPots()>0,sent,celebrated,accepting:options.accepting()});
    if(activePanel==='bag')body=(panelNotice?`<p class="panel-notice" role="status">${esc(panelNotice)}</p>`:'')+bagContent(basket,near,options.ownPots());
    if(activePanel==='avatar')body=`<p class="rpg-help">${tr('Bộ nhân vật mẫu · Đổi từng lựa chọn và xem trực tiếp. Không cần tên thật hay tuổi.')}</p><div class="avatar-studio"><div class="avatar-stage"><div id="avatar-preview"></div><div class="avatar-turn"><button data-turn="-.45" aria-label="${tr('Xoay nhân vật sang trái')}">↶</button><span>${tr('XEM TOÀN THÂN')}</span><button data-turn=".45" aria-label="${tr('Xoay nhân vật sang phải')}">↷</button></div></div><div class="avatar-options"><fieldset><legend>${tr('Nhân vật')}</legend>${[['male',tr('Sinh viên nam')],['female',tr('Sinh viên nữ')]].map(([v,t])=>`<button data-body="${v}" aria-pressed="${appearance.body===v}">${t}</button>`).join('')}</fieldset><label>${tr('Kiểu tóc')}<select id="avatar-hair">${[['short',tr('Tóc ngắn')],['bob',tr('Tóc ngang vai')],['ponytail',tr('Tóc buộc')]].map(([v,t])=>`<option value="${v}" ${appearance.hair===v?'selected':''}>${t}</option>`).join('')}</select></label><label>${tr('Trang phục')}<select id="avatar-outfit">${[['casual',tr('Áo dài tay · quần dài')],['polo',tr('Áo polo · quần dài')],['vju',tr('Đồng phục VJU · mẫu đề xuất')]].map(([v,t])=>`<option value="${v}" ${appearance.outfit===v?'selected':''}>${t}</option>`).join('')}</select></label><fieldset><legend>${tr('Phối màu')}</legend><div class="avatar-swatches">${VISITOR_STYLES.map((s,i)=>`<button data-style="${i}" aria-pressed="${i===style}" aria-label="${s.name}"><span style="background:${s.coat}"></span>${i+1}</button>`).join('')}</div></fieldset><label>${tr('Tên hiện trên đầu nhân vật')} <small>${tr('không bắt buộc · tối đa 24 ký tự')}</small><input id="avatar-name" maxlength="24" placeholder="${tr('Tên hoặc bút danh')}" autocomplete="off" value="${esc(playerName)}"></label></div></div><p class="rpg-help" id="avatar-note">${appearance.outfit==='vju'?tr('Đồng phục là bản mẫu áo polo trắng, cổ xanh và chữ VJU. Chưa coi là mẫu chính thức khi chưa đối chiếu ảnh chuẩn.'):tr('Nhân vật có khớp tay/chân, chuyển động đi bộ và ba lô. Lựa chọn được lưu trên trình duyệt này.')}</p>`;
    if(activePanel==='camera')body=cameraContent(options.walk.view);
    dialog.dataset.panel=activePanel;
    const avatarAction=activePanel==='avatar'?`<div class="avatar-apply" role="group" aria-label="${tr('Áp dụng nhân vật')}"><button data-do="return">${tr('Dùng nhân vật · vào sân')}</button><span>${tr('Có thể đổi lại trong mục Nhân vật.')}</span></div>`:'';
    dialog.innerHTML=`<header><div><h2 id="rpg-dialog-title">${title}</h2></div><button class="rpg-close" aria-label="${tr('Đóng cửa sổ')}">×</button></header><div class="rpg-dialog-body">${body}</div>${avatarAction}`;
    dialog.querySelector('.rpg-close')!.addEventListener('click',close);
    if(activePanel==='camera')options.mountGraphics?.(dialog.querySelector<HTMLElement>('.camera-graphics')!);
    function change(next:Partial<Appearance>){
      appearance=readAppearance({...appearance,...next});style=appearance.palette;options.setAppearance(appearance);
      try{localStorage.setItem('vju2011-avatar-v2',JSON.stringify(appearance));localStorage.setItem('vju2011-avatar-style',String(style));}catch{/* optional */}
      preview?.setAppearance(appearance);
      dialog.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.style)===style)));
      dialog.querySelectorAll<HTMLButtonElement>('[data-body]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.body===appearance.body)));
      const note=dialog.querySelector('#avatar-note');
      if(note)note.textContent=appearance.outfit==='vju'?tr('Đồng phục là bản mẫu áo polo trắng, cổ xanh và chữ VJU. Chưa coi là mẫu chính thức khi chưa đối chiếu ảnh chuẩn.'):tr('Nhân vật có khớp tay/chân, chuyển động đi bộ và ba lô. Lựa chọn được lưu trên trình duyệt này.');
    }
    dialog.querySelectorAll<HTMLButtonElement>('[data-style]').forEach(b=>b.onclick=()=>change({palette:Number(b.dataset.style)}));
    dialog.querySelectorAll<HTMLButtonElement>('[data-body]').forEach(b=>b.onclick=()=>change({body:b.dataset.body as Appearance['body']}));
    dialog.querySelector<HTMLInputElement>('#avatar-name')?.addEventListener('input',e=>{playerName=(e.target as HTMLInputElement).value.trim().slice(0,24);options.setName(playerName);try{localStorage.setItem('vju2011-player-name',playerName);}catch{/* optional */}});
    dialog.querySelector<HTMLSelectElement>('#avatar-hair')?.addEventListener('change',e=>change({hair:(e.target as HTMLSelectElement).value as Appearance['hair']}));
    dialog.querySelector<HTMLSelectElement>('#avatar-outfit')?.addEventListener('change',e=>change({outfit:(e.target as HTMLSelectElement).value as Appearance['outfit']}));
    const studio=dialog.querySelector<HTMLElement>('#avatar-preview');if(studio){try{preview=mountAvatarPreview(studio,appearance);}catch{studio.textContent=tr('Thiết bị chưa mở được khung 3D; các lựa chọn vẫn được lưu.');}}
    dialog.querySelectorAll<HTMLButtonElement>('[data-turn]').forEach(b=>b.onclick=()=>preview?.turn(Number(b.dataset.turn)));
    dialog.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b=>b.onclick=()=>{options.walk.setView(b.dataset.view as 'first'|'third'|'overview');close();});
    dialog.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b=>b.onclick=()=>{const kind=b.dataset.pick!;panelNotice=options.pick(kind as FlowerKind);render();(dialog.querySelector<HTMLButtonElement>(`[data-pick="${kind}"]`)||dialog.querySelector<HTMLButtonElement>('.rpg-primary'))?.focus();});
    dialog.querySelectorAll<HTMLButtonElement>('[data-do]').forEach(b=>b.onclick=()=>{const doWhat=b.dataset.do;close();if(doWhat==='find-flowers')options.navigate('flowers');if(doWhat==='write')document.querySelector<HTMLButtonElement>('#send-greeting')?.click();if(doWhat==='board'){board=true;options.openBoard();}if(doWhat==='garden'){const slot=nearPlantGarden(options.walk.position)&&options.getBasket().length?nearestEmptyPlot(options.walk.position,options.getFlowerState().planted):-1;if(slot>=0)plantAt(slot);else options.openGarden();}if(doWhat==='stage-mode')window.dispatchEvent(new Event('vju-stage-mode'));if(doWhat==='return')options.walk.setView('third');if(doWhat==='finale')document.querySelector<HTMLButtonElement>('#festival-finale')?.click();});
    dialog.querySelector<HTMLInputElement>('#rpg-ambience')?.addEventListener('change',e=>{const checkbox=document.querySelector<HTMLInputElement>('#festival-ambience')!;checkbox.checked=(e.target as HTMLInputElement).checked;checkbox.dispatchEvent(new Event('change'));});
    dialog.querySelector<HTMLInputElement>('#rpg-motion')?.addEventListener('change',e=>{const checkbox=document.querySelector<HTMLInputElement>('#festival-reduced')!;checkbox.checked=(e.target as HTMLInputElement).checked;checkbox.dispatchEvent(new Event('change'));});
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(b=>b.onclick=()=>open(b.dataset.panel!));
  root.querySelector<HTMLButtonElement>('#rpg-photo')!.onclick=()=>{if(!dialog.open&&!options.isWriting())options.takePhoto();};
  /** Called from a tap on a bed in the scene, the action button, or the bag. */
  /** Called from a tap on a bed in the scene, the action button, or the bag. */
  function plantAt(slot:number){if(!options.isWriting()&&!dialog.open)options.openPlot(slot);}
  function seatAction(){
    if(options.walk.seated){if(!options.walk.standUp())announce(tr('Lối đứng dậy đang bị chắn.'));return true;}
    const seat=nearestStageSeat(options.walk.position);if(!seat)return false;
    if(options.walk.sitDown(seat))announce(tr('Đã ngồi · kéo để nhìn, chọn Đứng dậy để đi tiếp.'));return true;
  }
  action.onclick=()=>{if(options.football.near(options.walk.position)){options.shoot();return;}if(seatAction())return;const here=plotAt(options.walk.position),plots=options.getFlowerState().planted;if(nearPlantGarden(options.walk.position)&&((here>=0&&plots[here])||options.getBasket().length)){plantAt(here>=0&&plots[here]?here:nearestEmptyPlot(options.walk.position,plots));return;}if(nearFlowerGarden(options.walk.position))open('bag');else{board=true;options.openBoard();}};
  window.addEventListener('keydown',e=>{if(e.code!=='KeyE'||e.repeat||root.hidden||dialog.open||options.isWriting()||(e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]'))return;if(options.football.near(options.walk.position)&&options.shoot())e.preventDefault();});
  window.addEventListener('keydown',e=>{if(e.repeat||root.hidden||options.isWriting()||document.body.classList.contains('cinematic-active')||(e.target as HTMLElement)?.matches('input,textarea,select,[contenteditable="true"]'))return;if(e.code==='KeyE'&&!dialog.open&&options.walk.view!=='overview'&&seatAction()){e.preventDefault();return;}if(e.code==='KeyP'&&!dialog.open){e.preventDefault();options.takePhoto();return;}const panel:Record<string,string>={KeyQ:'quests',KeyI:'bag',KeyC:'avatar',KeyV:'camera'};if(panel[e.code]){e.preventDefault();dialog.open?close():open(panel[e.code]);}});
  return {focus:()=>{if(action.hidden||action.disabled)return null;const p=options.walk.position;if(action.dataset.football)return {x:options.football.state().position[0],z:options.football.state().position[2]};const seat=nearestStageSeat(p);if(seat)return seat;if(nearPlantGarden(p))return {x:p.x,z:p.z};return nearFlowerGarden(p)?{x:p.x,z:p.z}:BOARD;},journey:journey.state,root,announce,plantAt,openAvatar:()=>open('avatar'),isOpen:()=>dialog.open,markBoard(){board=true;},confirm(){sent=true;},
    update(visible:boolean,finale:boolean){
      root.hidden=!visible;document.body.classList.toggle('rpg-active',visible);if(finale)celebrated=true;
      const basket=options.getBasket();if(basket.length>0)bouquet=true;
      const plots=options.getFlowerState().planted,planted=options.ownPots()>0;
      // Track the newest bouquet: the objective keeps pointing at its bed.
      const mine=plots.reduce((best,p,i)=>p&&(best<0||p.plantedAt>=plots[best]!.plantedAt)?i:best,-1);
      if(board)journey.mark('board');if(bouquet||planted)journey.mark('flowers');if(planted)journey.mark('plant');if(sent)journey.mark('greeting');if(celebrated)journey.mark('finale');
      const done=journey.state().length;progress.value=done;
      const key=basket.join(',')+board+sent+celebrated+planted;if(key!==lastKey){lastKey=key;count.textContent=`${basket.length}/5`;goal.textContent=!board?tr('Ghé Bảng Tri Ân'):!bouquet&&!planted?tr('Hái hoa ở vườn'):!planted?tr('Cắm bó hoa ở Vườn cắm hoa'):tr('Dạo sân & ngắm kết lễ');}
      const at=options.walk.position;
      const approach=!board&&at.z>35;
      const target=approach?new THREE.Vector3(84,1.7,33):!board&&at.x>60?new THREE.Vector3(15,1.7,29):!board&&at.z>18?new THREE.Vector3(0,1.7,18):board&&!planted?(basket.length?plantPoint:gardenPoint):board&&mine>=0?new THREE.Vector3(GARDEN_PLOTS[mine][0],1.7,GARDEN_PLOTS[mine][1]):boardPoint,delta=target.clone().sub(at);
      const relative=Math.atan2(-delta.x,-delta.z)-options.walk.heading;
      const arrows=['↑','↖','←','↙','↓','↘','→','↗'];const index=(Math.round(relative/(Math.PI/4))+8)%8;
      bearing.textContent=tr('{0} {1} · {2} bước',{0:arrows[index],1:approach?tr('Đi thẳng qua nhà bảo vệ'):!board&&at.x>60?tr('Rẽ trái vào sân'):board&&!planted?(basket.length?tr('Vườn cắm hoa'):tr('Vườn hái hoa')):board&&mine>=0?tr('Hoa của bạn · ô {0}',{0:mine+1}):tr('Bảng Tri Ân'),2:Math.round(Math.hypot(delta.x,delta.z))});
      const nearGarden=nearFlowerGarden(options.walk.position),nearBoard=options.walk.position.distanceTo(boardPoint)<14;
      const seat=nearestStageSeat(at),seated=options.walk.seated,prefix=matchMedia('(pointer: coarse)').matches?'':'E · ';
      action.hidden=!(seated||seat||nearGarden||nearBoard)||options.walk.view==='overview'||dialog.open||options.isWriting();
      const nearPlant=nearPlantGarden(at),here=nearPlant?plotAt(at):-1,viewTarget=here>=0&&plots[here]?here:-1,plantTarget=nearPlant&&viewTarget<0&&basket.length?nearestEmptyPlot(at,plots):-1;
      if(viewTarget>=0||plantTarget>=0)action.hidden=options.walk.view==='overview'||dialog.open||options.isWriting();
      action.textContent=seated?tr('{0}Đứng dậy',{0:prefix}):seat?tr('{0}Ngồi ghế {1}',{0:prefix,1:seat.number}):viewTarget>=0?tr('❀ Xem bó hoa · ô {0}',{0:viewTarget+1}):plantTarget>=0?tr('❀ Cắm bó hoa · ô {0}',{0:plantTarget+1}):nearGarden?tr('❀ Hái hoa · mở túi'):tr('{0}Đọc Bảng Tri Ân',{0:prefix});
      action.disabled=false;delete action.dataset.football;
      if(options.football.near(at)&&!seated&&options.walk.view!=='overview'&&!dialog.open&&!options.isWriting()){
        const football=options.football.state();
        action.hidden=false;action.dataset.football='true';action.disabled=football.phase!=='ready'||!football.connected||football.pending;
        action.textContent=!football.connected?tr('⚽ Đang kết nối sân bóng…'):football.phase==='rebound'?tr('⚽ Bóng bị cản!'):football.phase==='ready'?tr('{0}⚽ Sút bóng',{0:prefix}):football.phase==='shooting'?tr('⚽ Bóng đang bay…'):football.scored?tr('⚽ Vào! Đang đặt lại bóng…'):tr('⚽ Đang đặt lại bóng…');
      }
      if(performance.now()>noticeUntil)notice.hidden=true;
    }};
}
