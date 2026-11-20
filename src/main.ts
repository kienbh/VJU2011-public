import {mountAdmission} from './play/admission';
import {tr,LANG,setLang,i18nState} from './i18n/index.ts';
import {mountPerformanceProbe} from './diagnostics/performance';
import {CAMPFIRE} from './play/campfireLayout';
import {FINALE_SECONDS} from './festival/finalePlan';
import {mountBatch03Preview} from './assets/batch03Preview';
import {createInteractionFeedback} from './player/interactionFeedback';
import {createRoadsideLandscape} from './scene/roadsideLandscape';
import {createGraphicsQuality} from './graphics/quality';
import {saveQuality} from './graphics/settings';
import {mountCampusPlay} from './play';
import {groundSurfaceAudit} from './scene/groundAudit';
import {mountPresence} from './play/presence';
import {mountMobileNavigation,mobileMenuOpen,phoneScreen} from './mobile';
import {STAGE,STAGE_SEATS} from './festival/stageLayout';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCampus } from './scene/campus';
import { DOM_LAYOUT_DRAFT } from './scene/rightDistrict';
import { WalkController } from './player/WalkController';
import { mountGreetings } from './greetings/index';
import { mountExperience } from './festival/experience';
import { ENTRANCE_VIEW } from './festival/entranceView';
import {showWelcome} from './festival/welcome';
import './style.css';
import {createVisitorAvatar} from './player/visitorAvatar';
import { savePhoto } from './player/photo';
import {mountRpgHud} from './player/rpgHud';
import {createCampusFootball} from './player/campusFootball';
import {createSoundscape} from './audio/sound';
import {createWindowLights} from './festival/windowLights';
import './ui/campus-ui.css';

type Mode = 'domplan' | 'dom' | 'gate' | 'plan' | 'flycam' | 'right' | 'courtyard' | 'walk';
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="masthead">
    <div class="brand"><img class="brand-logo" src="/assets/brand/project-mark.svg" alt="20.11" width="138" height="52"><div><span class="eyebrow">${tr('VJU - 20.11.2026 / Hòa Lạc')}</span><h1>${tr('Duyệt mặt bằng')}</h1></div></div>
    <span class="status"><i></i>${tr('Map duyệt · Bản local')}</span>
  </header>
  <main id="workspace">
    <section id="viewport" aria-label="${tr('Mô hình 3D khu quảng trường VJU')}">
      <div class="view-caption"><span class="eyebrow">${tr('GÓC QUAN SÁT')}</span><h2 id="view-title">${tr('Flycam chéo')}</h2><p id="view-description"></p></div>
      <div id="canvas-host"></div>
      <div id="touch-controls"></div>
      <div class="scene-note"><span class="note-dot"></span>${tr('Bố trí theo duyệt mới nhất · Kích thước ước lượng')}</div>
      <div id="error" role="alert" hidden></div>
    </section>
    <aside id="reference" hidden aria-label="${tr('Ảnh thực địa đối chiếu')}">
      <div class="reference-heading"><span class="eyebrow">${tr('ẢNH VJU THẬT')}</span><span>${tr('Đối chiếu local')}</span></div>
      <img id="reference-image" alt="" />
      <div class="reference-copy"><h2 id="reference-title"></h2><p id="reference-description"></p><p class="source-path" id="reference-path"></p></div>
    </aside>
  </main>
  <footer>
    <nav aria-label="${tr('Chọn góc nhìn')}">
      <button data-mode="plan" aria-pressed="false"><span>00</span> ${tr('Mặt bằng · cổng ở dưới')}</button>
      <button data-mode="flycam" aria-pressed="true"><span>01</span> ${tr('Flycam chéo')}</button>
      <button data-mode="courtyard" aria-pressed="false"><span>02</span> ${tr('Từ sân')}</button>
      <button data-mode="right" aria-pressed="false"><span>03</span> ${tr('Campus bên phải')}</button>
      <button data-mode="gate" aria-pressed="false"><span>04</span> ${tr('Cổng · góc nghiêng')}</button>
      <button data-mode="dom" aria-pressed="false"><span>05</span> ${tr('Dom · đối chiếu ảnh')}</button>
      <button data-mode="domplan" aria-pressed="false"><span>06</span> ${tr('Dom · mặt bằng')}</button>
      <button data-mode="walk" aria-pressed="false"><span>↗</span> ${tr('Đi lại')}</button>
    </nav>
    <div class="actions"><button id="reset" title="${tr('Đưa camera về góc ban đầu')}">${tr('Đặt lại góc')}</button><button id="compare" aria-pressed="false">${tr('So với ảnh thật')}</button></div>
    <p class="instructions" id="instructions"></p>
    <p class="scale-note">${tr('Y-up · Đơn vị quy ước · Kích thước & khoảng cách ước lượng từ ảnh')}</p>
  </footer>`;

const viewport = document.querySelector<HTMLElement>('#viewport')!;
const host = document.querySelector<HTMLElement>('#canvas-host')!;
const reference = document.querySelector<HTMLElement>('#reference')!;
const params = new URLSearchParams(location.search);
const sound = createSoundscape({showButton: params.get('clean')!=='1'});const soundLook=new THREE.Vector3();
// Old lightweight-view bookmarks now enter the same campus journey.
if(params.get('view')==='2d'){
  params.delete('view');const url=new URL(location.href);url.search=params.toString();history.replaceState(null,'',url);
}
const localReview = import.meta.env.DEV;
const reviewUi=localReview&&params.get('review')==='1';
// Visibility is not authorization: every admin API checks SSO grants or its bearer token.
const adminUi=reviewUi||location.hash==='#moderation';
document.body.classList.toggle('student-ui',!reviewUi);
let experience: ReturnType<typeof mountExperience> | undefined;
let rpg: ReturnType<typeof mountRpgHud> | undefined;
let campusPlay: ReturnType<typeof mountCampusPlay> | undefined;
let presence: ReturnType<typeof mountPresence> | undefined;
let admission: ReturnType<typeof mountAdmission> | undefined;
let accountOpen=false;
export function pauseForAccount(open:boolean){
  accountOpen=open;
  experience?.pause(open||greetings.isOpen()||!!rpg?.isOpen()||!!campusPlay?.isBusy()||!!experience?.reflectionReading()||!!presence?.isChatOpen()||mobileMenuOpen());
}
let feedbackFx:ReturnType<typeof createInteractionFeedback>|undefined;
let feedbackAt=()=>({x:0,z:0});
let latestCards: Parameters<ReturnType<typeof mountExperience>['setPublicCards']>[0] = [];
let latestConfig: Parameters<ReturnType<typeof mountExperience>['setConfig']>[0] | undefined;
const greetings = mountGreetings({
  showAdmin:adminUi,canViewFlower:()=>!!experience,onViewFlower:slot=>experience?.viewFlower(slot),
  onOpenChange(open) { experience?.pause(open); },
  onConfirmed() { feedbackFx?.queue(feedbackAt()); experience?.bloom(); rpg?.confirm(); },
  onPublicCards(cards) { latestCards = cards; experience?.setPublicCards(cards); },
  onConfig(config) { latestConfig = config; experience?.setConfig(config); },
});
if(params.get('garden')==='1')setTimeout(()=>greetings.sharedGarden.open(),1000);
const globalActions = document.createElement('div'); globalActions.className='global-greeting-actions';
globalActions.innerHTML=`<button id="send-greeting">${tr('Gửi lời chúc')}</button><button id="open-reflections">${tr('Góc suy ngẫm')}</button><button id="open-admin" title="${tr('Quản trị local')}">${tr('Quản trị')}</button><button id="lang-switch" lang="${LANG==='ja'?'vi':'ja'}" aria-label="${LANG==='ja'?'ベトナム語に切り替える':'Chuyển sang tiếng Nhật'}">${LANG==='ja'?'Tiếng Việt':'日本語'}</button>`;
globalActions.querySelector('#lang-switch')!.addEventListener('click',()=>setLang(LANG==='ja'?'vi':'ja'));document.title=tr('VJU2011 · Một mùa tri ân');
document.querySelector('.masthead')!.append(globalActions);
globalActions.querySelector('#send-greeting')!.addEventListener('click',()=>greetings.openCompose());
globalActions.querySelector('#open-reflections')!.addEventListener('click',()=>experience?.openReflections());
globalActions.querySelector('#open-admin')!.addEventListener('click',()=>greetings.openAdmin());
(globalActions.querySelector('#open-admin') as HTMLElement).hidden=!adminUi;
window.addEventListener('vju-moderation-ready',()=>{
  const button=globalActions.querySelector<HTMLButtonElement>('#open-admin')!;
  button.hidden=false;button.textContent=tr('Duyệt lời chúc');button.title=tr('Kiểm duyệt Bảng Tri Ân');
});
window.addEventListener('vju-moderation-ended',()=>{(globalActions.querySelector('#open-admin') as HTMLElement).hidden=!adminUi;});
if(location.hash==='#moderation')greetings.openAdmin();
if(adminUi)void import('./play/admin').then(m=>m.mountPlayEditor());
function showSceneRecovery(message: string, code='SCENE_INIT_FAILED') {
  document.querySelector('.welcome-map-dialog')?.remove();document.querySelector('.festival-welcome')?.remove();document.body.classList.remove('welcome-open');
  Array.from(viewport.children).forEach(e=>(e as HTMLElement).inert=false);
  document.body.classList.add('scene-unavailable');document.body.dataset.ready='true';
  (globalActions.querySelector('#open-reflections') as HTMLButtonElement).disabled=!experience;
  document.querySelector('h1')!.textContent=tr('Bảng Tri Ân 20/11');
  const target=document.querySelector<HTMLElement>('#error')!;target.hidden=false;
  target.replaceChildren(document.createTextNode(message));
  target.dataset.sceneFailure=code;
  const detail=document.createElement('p');detail.textContent=`Mã lỗi / エラーコード: ${code}`;target.append(detail);
  const button=document.createElement('button');button.textContent=tr('Gửi lời chúc ngay');button.onclick=()=>greetings.openCompose();
  target.append(document.createElement('br'),document.createElement('br'),button);
  const retry=document.createElement('button');retry.textContent=tr('Tải lại cảnh');retry.onclick=()=>location.reload();target.append(retry);
  const light=document.createElement('button');light.textContent=tr('Tải lại với đồ họa nhẹ');light.dataset.safeScene='true';light.onclick=()=>{saveQuality('economy');const url=new URL(location.href);url.searchParams.set('safe3d','1');location.replace(url);};target.append(light);
}
let mode: Mode = 'flycam';
let comparison = false;
const sourceBase = '/materials/festival-concept/campus-map-review/';
const descriptions = {
  dom: [tr('Dom và Văn phòng Khoa'), tr('7 khối Dom · VP Khoa ở khối trên trái · Hai cánh ngang nối lệch'), 'pictures/Screenshot 2026-11-15 080818.png', tr('Ảnh vệ tinh do anh Kiên gán nhãn'), tr('N1–N4 là bốn Dom phía đường ngoài; khối T1 là VP Khoa, T2–T4 là Dom. Khoảng lệch và chiều dài được ước lượng từ ảnh; ID N/T chỉ dùng duyệt.')],
  domplan: [tr('Dom · mặt bằng theo ảnh vệ tinh'), tr('8 khối vật lý: 7 Dom + 1 VP Khoa'), 'pictures/Screenshot 2026-11-15 080818.png', tr('Ảnh vệ tinh đã gán tên'), tr('Giữ quan hệ 4 + 2 + 2 khối, phân biệt Văn phòng Khoa với Dom. Hồ ở phía sau và đường ngoài cong thoải phía trước. Kích thước và đường bờ chưa phải số đo thực địa.')],
  gate: [tr('Cổng · lối vào đi thẳng'), tr('Bia đá bên trái · Phòng bảo vệ trong góc sân bên trái cổng'), 'pictures/Screenshot 2026-11-15 0810491.png', tr('Góc cổng thật do anh Kiên cung cấp'), tr('Ảnh thật là chuẩn kiến trúc: bia riêng ở bên trái, lối vào đi thẳng, Nhà đa năng bên phải. Concept chỉ dùng cho không khí lễ hội. Kích thước mô hình vẫn là ước lượng.')],
  plan: [tr('Mặt bằng · Theo ảnh vệ tinh đã gán nhãn'), tr('Hội trường · Khu Thí nghiệm · VNU–RMIT · Club House · 7 Dom và VP Khoa'), 'pictures/Screenshot 2026-11-15 080818.png', tr('Chuẩn bố trí: ảnh vệ tinh và xác nhận của anh Kiên'), tr('Thư viện ở tầng 2 khối VNU–RMIT, căng tin tầng 1. Club House là mái cam phía sau, sát hồ. Hai vùng mặt nước theo ảnh, đường bờ và kích thước ước lượng. Giữ cụm cổng, sân lễ hội và vị trí Hiệu bộ đã duyệt.')],
  flycam: [tr('Flycam chéo'), tr('Sân lát rộng · đường vòng · tương quan khối nhà'), '01-flycam-quang-truong.jpg', tr('Toàn cảnh khu quảng trường'), tr('Đối chiếu bề rộng sân, dãy nhà và đường cong bên phải. Phối cảnh chỉ dùng xác định tương quan, chưa có tỷ lệ đo.')],
  right: [tr('Campus bên phải · cập nhật vệ tinh'), tr('Khu Thí nghiệm → VNU–RMIT → VP Khoa và Dom; Club House mái cam phía sau'), 'pictures/Screenshot 2026-11-15 080818.png', tr('VNU–RMIT, Club House và Nhà đa năng đã xác nhận'), tr('Tầng 2 khối VNU–RMIT là thư viện, tầng 1 là căng tin. Club House mái cam nằm giữa khối này và hồ. Nhà đa năng là khối có mái ngay bên trái sân bóng.')],
  courtyard: [tr('Tầm mắt từ sân'), tr('Giảng đường 2 → Giảng đường 1 → Nhà Hiệu bộ'), '02-mat-dung-hieu-bo.jpg', tr('Mặt đứng nhìn từ sân'), tr('Đối chiếu thứ tự dãy nhà, nhịp cột, kính xanh và cụm cờ trước Hiệu bộ. Lều Job Fair là đồ sự kiện, không đưa vào mặt bằng.')],
  walk: [tr('Khảo sát bằng đi bộ'), tr('Đi quanh quảng trường và kiểm tra khoảng trống'), '02-mat-dung-hieu-bo.jpg', tr('Mặt đứng nhìn từ sân'), tr('Đối chiếu cảm giác khoảng thoáng từ sân. Điểm xuất hiện là đề xuất để duyệt, chưa phải lối vào sự kiện.')],
};

try {
  const renderer = new THREE.WebGLRenderer({ antialias: params.get('safe3d')!=='1', preserveDrawingBuffer: params.get('clean')==='1' });
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', tr('Khung nhìn campus 3D; dùng các nút phía dưới để đổi góc'));
  renderer.domElement.tabIndex = 0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dbe5e7');
  scene.fog = new THREE.Fog('#dbe5e7', 900, 1400);
  const ambient = new THREE.HemisphereLight(0xf4f9ff, 0x778273, 2.2);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff2df, 2.3);
  sun.position.set(-70, 120, 90);
  scene.add(sun);
  const campus = createCampus();
  scene.add(campus.group);
  const windows=createWindowLights(campus.group);
  const avatar=createVisitorAvatar();scene.add(avatar.root);
  const photo={poseUntil:0,shootAt:0};
  function takePhoto(){
    if(mode!=='walk'||photo.shootAt)return;
    const now=performance.now();photo.poseUntil=now+1500;photo.shootAt=now+450;
    document.body.classList.add('photo-flash');setTimeout(()=>document.body.classList.remove('photo-flash'),900);
  }
  const reviewLabels = new THREE.Group();
  const labels: [string, number, number][] = [
    [tr('CỔNG'),84,62], [tr('SÂN CAMPUS'),0,8], [tr('GĐ2'),-62,-59], [tr('GĐ1'),-27,-59],
    [tr('HIỆU BỘ'),18,-48], [tr('HỘI TRƯỜNG'),58,-54], [tr('NHÀ ĐA NĂNG'),112,8], [tr('SÂN BÓNG'),167,8],
    [tr('CỔNG PHỤ'),207,64],
    [tr('KHU THÍ NGHIỆM'),115,-69], ['VNU–RMIT',170,-66], [tr('T1: CĂNG TIN · T2: THƯ VIỆN'),170,-52],
    [tr('ĐƯỜNG NGANG'),123,-88], ['CLUB HOUSE',170,-111],
    [tr('NHÀ KHÁCH VNU · TẠM'),147,-184],
    [tr('HỒ PHÍA SAU · ƯỚC LƯỢNG'),-5,-128], [tr('HỒ SAU DOM · ƯỚC LƯỢNG'),246,-141], [tr('DẢI CÂY NỀN · TẠM'),125,-215],
  ];
  for (const block of DOM_LAYOUT_DRAFT) labels.push([block.displayName,block.x,block.z]);
  for (const [text,x,z] of labels) {
    const c = document.createElement('canvas'); c.height=80;
    const ctx=c.getContext('2d')!; ctx.font='bold 50px Arial';
    c.width = Math.ceil(ctx.measureText(text).width + 36);
    ctx.fillStyle='#fcfaf2'; ctx.fillRect(0,0,c.width,80);
    ctx.fillStyle='#17333a'; ctx.font='bold 50px Arial'; ctx.textAlign='center'; ctx.fillText(text,c.width/2,58);
    const texture=new THREE.CanvasTexture(c); texture.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:false,toneMapped:false}));
    sprite.position.set(x,24,z); sprite.scale.set(c.width/80*6,6,1); sprite.renderOrder=100;
    reviewLabels.add(sprite);
  }
  scene.add(reviewLabels);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.5, 1400);
  const graphics=createGraphicsQuality(renderer,scene,camera);
  const batchPreview=localReview&&params.get('assetPreview')==='batch03'?mountBatch03Preview(scene,camera):undefined;
  // Locked orthographic review: exact downward view, +Z (gate) at the bottom.
  const planCamera = new THREE.OrthographicCamera(-230,230,145,-145,0.5,1400);
  planCamera.position.set(108,400,-72);
  planCamera.up.set(0,0,-1);
  planCamera.lookAt(108,0,-72);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.maxPolarAngle = Math.PI / 2 - 0.015;
  orbit.minDistance = 12;
  orbit.maxDistance = 1000;
  const walk = new WalkController(camera, renderer.domElement, {
    colliders: campus.colliders, bounds: campus.bounds, spawn: campus.landmarks.spawn, heightAt: campus.heightAt,
    touchRoot: document.querySelector<HTMLElement>('#touch-controls')!,
  });
  function resize() {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    const nextAspect = w / Math.max(1, h);
    if (mode === 'flycam' || mode === 'right' || mode === 'dom') {
      const framing = (aspect: number) => Math.max(1, 1.45 / aspect);
      camera.position.sub(orbit.target).multiplyScalar(framing(nextAspect) / framing(camera.aspect)).add(orbit.target);
    }
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
    const pairTop=localReview&&params.get('mapReview')==='pair-top';
    const halfHeight = pairTop ? 52/nextAspect : mode === 'domplan' ? Math.max(108,150 / nextAspect) : Math.max(180,230 / nextAspect);
    const planCenter=pairTop?new THREE.Vector3(38,200,-50):mode==='domplan'?new THREE.Vector3(279,400,-25):new THREE.Vector3(108,400,-72);
    planCamera.position.copy(planCenter);planCamera.lookAt(planCenter.x,0,planCenter.z);
    planCamera.left = -halfHeight * nextAspect;
    planCamera.right = halfHeight * nextAspect;
    planCamera.top = halfHeight;
    planCamera.bottom = -halfHeight;
    planCamera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  new ResizeObserver(resize).observe(viewport);
  function setMode(next: Mode) {
    mode = next;
    // Review presets keep their original lens after leaving the wider festival walk view.
    camera.fov=48;
    reviewLabels.visible = mode === 'plan' || mode === 'domplan';
    campus.group.traverse(o=>{if(o.name==='dom-review-direction')o.visible=localReview&&reviewLabels.visible;});
    walk.setEnabled(false);
    orbit.enabled = false;
    if (mode === 'walk') {
      // Enter along the open gate spine, rather than aiming diagonally into the guard room.
      const festivalEntry=experience?.state().enabled===true;
      const spawn=festivalEntry?new THREE.Vector3(84,0,69):campus.landmarks.spawn;
      camera.fov=festivalEntry?64:48;
      walk.setView(festivalEntry?'third':'first');
      walk.reset(spawn,spawn.clone().add(new THREE.Vector3(0,1.7,-50)));
      walk.setEnabled(true);
    } else {
      const view = mode === 'dom' ? {position:new THREE.Vector3(155,92,125),target:new THREE.Vector3(252,0,-47)} : mode === 'gate' ? {position:new THREE.Vector3(112,23,98),target:new THREE.Vector3(84,1,49)} : mode === 'plan' || mode === 'domplan' ? { position: new THREE.Vector3(108,400,-43), target: new THREE.Vector3(108,0,-43) } : mode === 'right' ? { position: new THREE.Vector3(145,190,230), target: new THREE.Vector3(195,0,-40) } : campus.views[mode];
      camera.position.copy(view.position);
      camera.lookAt(view.target);
      orbit.target.copy(view.target);
      orbit.enabled = mode === 'flycam' || mode === 'right' || mode === 'dom';
      if (orbit.enabled) {
        camera.position.sub(view.target).multiplyScalar(Math.max(1, 1.45 / camera.aspect)).add(view.target);
        orbit.enableDamping = false;
        orbit.update();
        orbit.enableDamping = true;
      }
    }
    document.body.dataset.mode = mode;
    document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    const [title, description, path, photoTitle, photoDescription] = descriptions[mode];
    document.querySelector('#view-title')!.textContent = title;
    document.querySelector('#view-description')!.textContent = description;
    document.querySelector('#reference-title')!.textContent = photoTitle;
    document.querySelector('#reference-description')!.textContent = photoDescription;
    document.querySelector('#reference-path')!.textContent = path;
    if (localReview) {
      const img = document.querySelector<HTMLImageElement>('#reference-image')!;
      img.style.transform = '';
      img.src = sourceBase + path; img.alt = photoTitle + tr(' — ảnh thực địa VJU');
    }
    document.querySelector('#instructions')!.textContent = mode === 'walk'
      ? tr('WASD / phím mũi tên để đi · Kéo trên cảnh để nhìn · Cần chạm ở góc trái trên điện thoại')
      : mode === 'plan' || mode === 'domplan' ? tr('Ảnh vệ tinh đã gán nhãn · 7 Dom + VP Khoa · Nhà đa năng bên trái sân bóng · Kích thước ước lượng')
      : mode === 'flycam' || mode === 'right' || mode === 'dom' ? tr('Kéo để xoay · Cuộn để thu/phóng · Chuột phải để dịch góc') : tr('Góc đối chiếu cố định · Chọn “Đi lại” để khám phá sân');
    resize();
  }
  document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach(b => b.onclick = () => {experience?.beforeReview();setMode(b.dataset.mode as Mode);});
  document.querySelector<HTMLButtonElement>('#reset')!.onclick = () => setMode(mode);
  const compareButton = document.querySelector<HTMLButtonElement>('#compare')!;
  function toggleComparison() {
    comparison = !comparison;
    reference.hidden = !comparison;
    compareButton.setAttribute('aria-pressed', String(comparison));
    document.body.classList.toggle('comparing', comparison);
  }
  compareButton.onclick = toggleComparison;
  if (!localReview) compareButton.hidden = true;
  if (params.get('clean') === '1') document.body.classList.add('clean');
  const requested = params.get('view');
  setMode(requested === 'domplan' || requested === 'dom' || requested === 'gate' || requested === 'plan' || requested === 'courtyard' || requested === 'right' || requested === 'walk' ? requested : 'flycam');
  if (localReview && params.get('compare') === '1') toggleComparison();
  experience=mountExperience({scene,campus:campus.group,camera,renderer,sun,ambient,colliders:campus.colliders,setMode,
    reviewUi,getPlayerPosition:()=>walk.position,syncWalkView(){walk.syncCameraPose();},
    pause(paused){walk.setEnabled(!paused&&!accountOpen&&mode==='walk'&&(!admission||admission.active()));orbit.enabled=!paused&&['flycam','right','dom'].includes(mode);},
    openBoard:()=>{rpg?.markBoard();greetings.open();},isWriting:()=>!!presence?.isChatOpen()||mobileMenuOpen()||greetings.isOpen()||!!rpg?.isOpen()||!!campusPlay?.isBusy()||!!experience?.reflectionReading(),
    openGarden:()=>greetings.openGarden(),plantAt:slot=>rpg?.plantAt(slot),pickFlower:kind=>greetings.pickFlower(kind),getBasket:()=>greetings.getBasket(),getFlowerState:greetings.getFlowerState,getGardenTotal:greetings.sharedGarden.total,getGardenFocus:greetings.sharedGarden.focus,
  });
  feedbackAt=()=>walk.position;feedbackFx=createInteractionFeedback(scene,campus.heightAt);
  window.addEventListener('vju-flower-success',()=>feedbackFx?.queue(walk.position));
  const football=createCampusFootball(campus.group.getObjectByName('football-centre-ball')!,{
    send:async(id,heading)=>{if(!presence)throw new Error('Sân bóng chưa kết nối.');const result=await presence.kickFootball(id,heading);campusPlay?.recordActivity('football');return result;},
    announce:text=>rpg?.announce(text),
    onKick:heading=>avatar.kick(heading),
    onGoal:goals=>{sound.cheer();sound.effect('goal');rpg?.announce(tr('⚽ Vào! Bạn đã ghi {0} bàn.',{0:goals}));},
  });
  function canPlayFootball(){
    const s=experience?.state();
    return !!admission?.active()&&!accountOpen&&!presence?.isChatOpen()&&!mobileMenuOpen()&&!!s?.enabled&&mode==='walk'&&!s.welcome&&!s.intro&&!s.finale&&!s.flowerView&&
      !greetings.isOpen()&&!rpg?.isOpen()&&!campusPlay?.isBusy()&&!experience?.reflectionReading()&&!walk.seated&&walk.view!=='overview'&&!document.hidden;
  }
  rpg=mountRpgHud({accepting:()=>latestConfig?.event.acceptingSubmissions!==false,walk,football,mountGraphics:root=>{graphics.mount(root);experience?.mountPresentation(root);},navigate:id=>campusPlay?.navigateTo(id),shoot:()=>{const kicked=football.kick(walk.position,walk.heading,canPlayFootball());if(kicked)sound.kick();return kicked;},getFlowerState:greetings.getFlowerState,setAppearance:avatar.setAppearance,getBasket:greetings.getBasket,pick:greetings.pickFlower,openGarden:()=>greetings.sharedGarden.open(),setName:avatar.setName,takePhoto,openPlot:greetings.sharedGarden.open,ownPots:greetings.sharedGarden.ownedPots,openBoard:greetings.open,isWriting:()=>!!presence?.isChatOpen()||mobileMenuOpen()||greetings.isOpen()||!!campusPlay?.isBusy()||!!experience?.reflectionReading(),pause:value=>experience?.pause(value)});
  campusPlay=mountCampusPlay({journalActive:()=>{const s=experience?.state();return !!admission?.active()&&!accountOpen&&!!s?.enabled&&mode==='walk'&&!s.welcome&&!s.intro&&!s.finale;},heightAt:campus.heightAt,scene,camera,walk,colliders:campus.colliders,bounds:campus.bounds,photo:takePhoto,petSound:sound.pet,isMuted:()=>sound.muted,sfx:(name,at)=>sound.effect(name,at),announce:s=>rpg?.announce(s),pause:v=>experience?.pause(v),canUse:()=>{const s=experience?.state();return !!admission?.active()&&!accountOpen&&!presence?.isChatOpen()&&!mobileMenuOpen()&&!!s?.enabled&&mode==='walk'&&!s.welcome&&!s.intro&&!s.finale&&!s.flowerView&&!greetings.isOpen()&&!rpg?.isOpen()&&!experience?.reflectionReading();}});
  const landscape=createRoadsideLandscape(scene,campus.colliders,campus.bounds);graphics.register(landscape);
  experience.setPublicCards(latestCards);if(latestConfig)experience.setConfig(latestConfig);
  if(!requested||params.get('festival')==='1'){
    experience.setEnabled(true);
    if(requested&&requested in descriptions)setMode(requested as Mode);
  }
  const clock = new THREE.Clock();
  if(params.get('arrival')==='1') {
    camera.fov=ENTRANCE_VIEW.fov;camera.updateProjectionMatrix();
    walk.reset(new THREE.Vector3(...ENTRANCE_VIEW.position),new THREE.Vector3(...ENTRANCE_VIEW.target));
  }
  // Fixed photo-review angles; same transforms in day/festival. Campus is never rotated.
  const gateReview=params.get('gateReview');
  if(gateReview==='outside'||gateReview==='fence'){
    setMode('gate');camera.fov=gateReview==='outside'?88:58;
    camera.position.set(...(gateReview==='outside'?[79,1.7,70]:[46,1.7,68]) as [number,number,number]);
    camera.lookAt(gateReview==='outside'?79:76,2.8,gateReview==='outside'?49:53);camera.updateProjectionMatrix();
  }else if(gateReview==='front'||gateReview==='portrait'){
    setMode('gate');camera.fov=gateReview==='front'?38:64;
    camera.position.set(66,2.5,gateReview==='front'?70:73);camera.lookAt(66,2.5,58);camera.updateProjectionMatrix();
  }else if(gateReview==='entry'){
    setMode('walk');camera.fov=64;camera.updateProjectionMatrix();
    walk.reset(new THREE.Vector3(86,0,69),new THREE.Vector3(73,2.6,37));
  }
  // Reproducible eye-level route review; no changes to the campus or normal spawn.
  const mapReview=params.get('mapReview');
  if(localReview&&mapReview==='courier-overview'){setMode('gate');camera.fov=58;camera.position.set(232,16,93);camera.lookAt(207,1,70);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='courier'){setMode('walk');walk.reset(new THREE.Vector3(207,0,77),new THREE.Vector3(207,1.7,83));walk.setView('third');}
  if(localReview&&mapReview==='secondary-gate'){setMode('gate');camera.fov=58;camera.position.set(207,11,28);camera.lookAt(207,1.4,59);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='secondary-gate-walk'){setMode('walk');walk.reset(new THREE.Vector3(207,0,51),new THREE.Vector3(207,1.7,72));walk.setView('third');}
  if(localReview&&mapReview==='pair-court'){
    setMode('gate');camera.fov=55;camera.position.set(38,1.7,18);camera.lookAt(38,8,-44);camera.updateProjectionMatrix();
  }
  if(localReview&&mapReview==='pair-top'){
    setMode('plan');reviewLabels.visible=false;
    planCamera.position.set(38,200,-50);planCamera.lookAt(38,0,-50);
    planCamera.left=-52;planCamera.right=52;planCamera.top=29.25;planCamera.bottom=-29.25;planCamera.updateProjectionMatrix();
  }
  if(localReview&&['hall-front','hall-side','turn-east','turn-north'].includes(mapReview||'')){
    setMode('gate');camera.fov=58;camera.updateProjectionMatrix();
    const shot=mapReview==='hall-front'?[[71,1.7,-23],[71,5.2,-42]]:mapReview==='hall-side'?[[82,1.7,-28],[71,5,-43]]:mapReview==='turn-east'?[[84,1.7,43],[53,3.4,31]]:[[45,1.7,43],[52,4.7,8]];
    camera.position.set(...shot[0] as [number,number,number]);camera.lookAt(...shot[1] as [number,number,number]);
  }
  if(localReview&&['sticker-court','garden-art'].includes(mapReview||'')){
    setMode('gate');camera.fov=58;camera.position.set(...(mapReview==='sticker-court'?[17,4,32]:[25,5,19]) as [number,number,number]);camera.lookAt(...(mapReview==='sticker-court'?[0,4,8]:[34,1,-2]) as [number,number,number]);camera.updateProjectionMatrix();
  }
  if(localReview&&mapReview==='hero-flower'){setMode('gate');camera.fov=48;camera.position.set(34,2.5,3.5);camera.lookAt(34,2,-2);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='road-unified'){setMode('gate');camera.fov=58;camera.position.set(84,5,55);camera.lookAt(60,1,29);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='bench-garden'){setMode('gate');camera.fov=58;camera.position.set(60,5,32);camera.lookAt(38,1,0);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='dom-front'){setMode('gate');camera.fov=58;camera.position.set(184,2.7,1);camera.lookAt(220,4.8,1);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='dom-side'){setMode('gate');camera.fov=58;camera.position.set(197,2.5,27);camera.lookAt(216,4.2,0);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='dom-office'){setMode('gate');camera.fov=58;camera.position.set(199,5,-38);camera.lookAt(216,2,-43);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='dom-paving'){setMode('gate');camera.fov=58;camera.position.set(254,65,-16);camera.lookAt(254,0,-23);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='campfire-overview'){setMode('gate');camera.fov=58;camera.position.set(CAMPFIRE.x+24,22,CAMPFIRE.z+30);camera.lookAt(CAMPFIRE.x,0,CAMPFIRE.z);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='tea-overview'){setMode('gate');camera.fov=58;camera.position.set(118,10,-101);camera.lookAt(137,4,-116);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='koi-review'){walk.reset(new THREE.Vector3(137,0,-128),new THREE.Vector3(137,1.7,-141));setMode('gate');camera.fov=50;camera.position.set(137,4,-133);camera.lookAt(137,.1,-141);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='fish-feed'){setMode('walk');walk.reset(new THREE.Vector3(137,0,-128),new THREE.Vector3(137,1.7,-146));walk.setView('third');}
  if(localReview&&mapReview==='lake-west'){setMode('walk');walk.reset(new THREE.Vector3(0,0,-95),new THREE.Vector3(0,1.7,-130));walk.setView('third');}
  if(localReview&&mapReview==='lab-front'){setMode('gate');camera.fov=58;camera.position.set(115,2.8,-39);camera.lookAt(115,3.4,-62);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='hall-north'){setMode('gate');camera.fov=58;camera.position.set(116,3,-53);camera.lookAt(112,5,-18);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='hall-south'){setMode('gate');camera.fov=58;camera.position.set(112,3,69);camera.lookAt(112,5,34);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='tree-road'){setMode('gate');camera.fov=58;camera.position.set(99,1.7,58);camera.lookAt(99,2,32);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='board-grand'){setMode('gate');camera.fov=58;camera.position.set(0,3,40);camera.lookAt(0,5.8,8);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='gd2-corner'){setMode('gate');camera.fov=58;camera.position.set(-86,5,-23);camera.lookAt(-70,1,-38);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='reflection-board'){setMode('gate');camera.fov=58;camera.position.set(-55,5.2,-3);camera.lookAt(-69,5.175,-3);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='plant-garden'){setMode('walk');walk.reset(new THREE.Vector3(-32,0,23),new THREE.Vector3(-56,2,23));walk.setView('third');}
  if(localReview&&mapReview==='feedback-mailbox'){setMode('walk');walk.reset(new THREE.Vector3(-52,0,-22),new THREE.Vector3(-56,2,-22));walk.setView('third');}
  if(localReview&&mapReview==='reflection-walk'){setMode('walk');walk.reset(new THREE.Vector3(-52,0,-3),new THREE.Vector3(-69,4,-3));walk.setView('third');}
  if(localReview&&['clubhouse','guest-hotel','lake-review'].includes(mapReview||'')){
    const shot=mapReview==='clubhouse'?[[191,5,-87],[170,3.3,-111]]:mapReview==='guest-hotel'?[[147,5,-151],[147,5.8,-184]]:[[160,3,-124],[147,4,-184]];
    setMode('gate');camera.fov=58;camera.position.set(...shot[0] as [number,number,number]);camera.lookAt(...shot[1] as [number,number,number]);camera.updateProjectionMatrix();
  }
  if(localReview&&mapReview==='stage-front'){setMode('gate');camera.fov=58;camera.position.set(STAGE.x,10,18);camera.lookAt(STAGE.x,2,-10);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='canteen-front'){setMode('gate');camera.fov=58;camera.position.set(170,7,6);camera.lookAt(170,5.5,-41);camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='stage-seats'){setMode('walk');walk.reset(new THREE.Vector3(STAGE.x,0,2),new THREE.Vector3(STAGE.x,1.7,-18));}
  if(localReview&&mapReview==='football-shooter'){setMode('walk');walk.reset(new THREE.Vector3(165,0,8),new THREE.Vector3(196,1.7,8));walk.setView('third');}
  if(localReview&&mapReview==='football-keeper'){setMode('walk');walk.reset(new THREE.Vector3(194.5,0,8),new THREE.Vector3(165,1.7,8));walk.setView('third');}
  if(localReview&&mapReview==='football'){setMode('walk');walk.reset(new THREE.Vector3(165,0,10),new THREE.Vector3(196,1.7,8));walk.setView('third');}
  if(localReview&&mapReview?.startsWith('play-')){const positions:Record<string,[number,number]>={'play-cats':[-32,8.5],'play-pets':[42,25.5],'play-npcs':[48,28],'play-npc-ja':[32,36.5],'play-npc-vi':[60,40],'play-library':[170,-38],'play-sakura':[110,-110.5],'play-fish':[132,-120],'play-campfire':[CAMPFIRE.x-.85,CAMPFIRE.z-3],'play-campfire-other':[CAMPFIRE.x+.85,CAMPFIRE.z-3],'play-tea':[129,-115.4],'play-tea-other':[132,-113.6],'play-lotus':[105,-181],'play-green':[135,-33],'play-hotel':[147,-173],'play-football':[165,10]};const at=mapReview==='play-at'?(params.get('at')||'').split(',').map(Number):null,p=at&&at.length>=2&&at.every(Number.isFinite)?[at[0],at[1]] as [number,number]:positions[mapReview];if(p){setMode('walk');walk.reset(new THREE.Vector3(p[0],0,p[1]),new THREE.Vector3(p[0],1.7,p[1]-10));walk.setView('third');}}
  const routeReview=params.get('routeReview');
  if(localReview&&(routeReview==='turn'||routeReview==='board')) {
    setMode('walk');camera.fov=64;camera.updateProjectionMatrix();
    walk.reset(new THREE.Vector3(...(routeReview==='turn'?[68,0,43]:[35,0,14]) as [number,number,number]),
      new THREE.Vector3(...(routeReview==='turn'?[45,2.5,18]:[52,3,8]) as [number,number,number]));
  }
  const showCampusWelcome=(note='')=>{
    experience!.setWelcomeOpen(true);
    if(!document.querySelector('.festival-welcome'))showWelcome(()=>admission!.enter(),()=>greetings.openCompose(),note);
  };
  admission=mountAdmission({moving:()=>walk.moving,onWait(){
    campusPlay?.suspend();
    experience!.setWelcomeOpen(true);
  },onAdmit(first){experience!.setWelcomeOpen(false);if(first&&!localReview)experience!.startIntro();else experience!.pause(false);},onExit(reason){
    campusPlay?.suspend();experience?.closeOverlays();greetings.close();walk.standUp();
    document.querySelectorAll<HTMLDialogElement>('dialog[open]:not(.account-dialog)').forEach(d=>d.close());
    showCampusWelcome(reason==='idle'?tr('Bạn đã rời campus sau 5 phút không tương tác. Danh tính và bản nháp vẫn được giữ.'):reason==='full'?tr('Hàng chờ đang đầy. Hãy thử lại sau ít phút.'):reason==='missed'?tr('Lượt vào đã hết sau 60 giây. Bạn có thể vào lại hàng chờ.'):reason==='identity'?tr('Phiên đăng nhập đã hết. Hãy chọn lại cách tham gia.'):tr('Bạn đã rời campus. Có thể vào lại hoặc gửi lời chúc ngay.'));
  }});
  if(!requested&&!params.has('gateReview')&&!params.has('mapReview')&&!params.has('routeReview')&&params.get('clean')!=='1'){
    showCampusWelcome();
  }else admission.enter();
  if(params.get('panel')==='reflections'){
    experience.openReflections();const url=new URL(location.href);url.searchParams.delete('panel');history.replaceState(null,'',url);
  }
  const landscapeViews:Record<string,[number[],number[]]>={'landscape-avenue':[[207,3,34],[207,3,-65]],'landscape-garden':[[145,5,-85],[145,2.5,-110]],'campus-life-dom':[[264,4,-23],[265.7,2,-46.5]],'campus-life-canteen':[[176.5,5,-23],[170,2,-42]],'campus-life-sport':[[202,5,-20],[167,2,8]]};
  if(localReview&&mapReview&&landscapeViews[mapReview]){const [p,t]=landscapeViews[mapReview];setMode('gate');camera.position.set(...p as [number,number,number]);camera.lookAt(...t as [number,number,number]);camera.fov=58;camera.updateProjectionMatrix();}
  if(localReview&&mapReview==='graphics-show'){setMode('gate');camera.position.set(0,12,125);camera.lookAt(0,61,-35);camera.fov=60;camera.updateProjectionMatrix();}
  if(params.get('character')==='1')rpg.openAvatar();
  mountMobileNavigation(value=>experience?.pause(value));
  let windowsEnabled=false;
  const performanceProbe=mountPerformanceProbe(()=>({input:walk.diagnostics(),network:presence?.diagnostics(),graphics:{...graphics.state(),pixelRatio:renderer.getPixelRatio(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles}}));
  renderer.setAnimationLoop(() => {
    try {
    const frameDelta=clock.getDelta(),dt=Math.min(frameDelta,.05);
    if(accountOpen){greetings.sharedGarden.tick(performance.now(),false);return;}
    performanceProbe.frame(frameDelta*1000);
    graphics.update(frameDelta*1000);
    if(document.hidden){greetings.sharedGarden.tick(performance.now(),false);return;}
    if (mode === 'walk') walk.update(dt);
    else if (orbit.enabled) orbit.update();
    experience?.setParticleBudget(graphics.state().particles);experience?.update(dt);
    greetings.sharedGarden.setVisible(!!experience?.state().enabled&&mode==='walk'&&Math.hypot(walk.position.x+56,walk.position.z-23)<32&&!greetings.isOpen()&&!rpg?.isOpen()&&!experience?.reflectionReading()&&!experience?.state().finale);
    const state=experience?.state(),active=!!state?.enabled;
    if(active!==windowsEnabled){windowsEnabled=active;windows.setEnabled(active);}
    const cinematic=!!state?.intro||!!state?.finale||!!state?.flowerView;
    avatar.root.visible=active&&mode==='walk'&&walk.view!=='first'&&!cinematic&&camera.position.distanceTo(walk.position)>1.3;
    avatar.setBouquet(greetings.getBasket());
    football.aim(walk.position,walk.heading,canPlayFootball());
    football.update(frameDelta,canPlayFootball());
    // While posing for a photo the character turns to the lens instead of the walking direction.
    const posing=performance.now()<photo.poseUntil;
    avatar.update(walk.position,walk.velocity,posing?Math.atan2(-(camera.position.x-walk.position.x),-(camera.position.z-walk.position.z)):walk.heading,dt,!!state?.reduced,!!walk.seated,!!walk.seated?.startsWith('sakura-')&&walk.seated!=='sakura-bench');
    rpg?.update(active&&mode==='walk'&&!state?.welcome&&!cinematic,!!state?.finale);
    campusPlay?.update(dt);batchPreview?.update();
    const blocked=!active||mode!=='walk'||!!state?.welcome||cinematic||greetings.isOpen()||!!rpg?.isOpen()||!!campusPlay?.isBusy()||!!experience?.reflectionReading()||!!presence?.isChatOpen()||mobileMenuOpen()||document.hidden;
    greetings.sharedGarden.tick(performance.now(),!blocked);
    feedbackFx?.update(dt,campusPlay?.focus()||rpg?.focus()||null,blocked,!!state?.reduced,graphics.state().density);
    presence?.update(dt,!!state?.reduced);
    camera.getWorldDirection(soundLook);sound.update(dt,{listener:mode==='walk'?{x:walk.position.x,z:walk.position.z,fx:soundLook.x,fz:soundLook.z}:null,festival:!!state?.enabled,library:!!document.querySelector('dialog.library-room[open]'),speed:Math.hypot(walk.velocity.x,walk.velocity.z)/Math.max(dt,.001),walking:active&&mode==='walk'&&!cinematic&&!state?.welcome&&!walk.seated,finale:!!state?.finale,fireworks:state?.reduced?null:state?.finale&&state.finaleProgress!==null?{mode:'finale',time:state.finaleProgress*FINALE_SECONDS}:state?.optionalFireworks?.visible?{mode:'show',time:state.optionalFireworks.time}:null});
    renderer.render(scene, mode === 'plan' || mode === 'domplan' ? planCamera : camera);
    // Read the frame in the same task as the render, before the drawing buffer is cleared.
    if(photo.shootAt&&performance.now()>=photo.shootAt){photo.shootAt=0;savePhoto(renderer.domElement,String(avatar.root.userData.name||'')).then(message=>rpg?.announce(message));}
    } catch(error) {
      renderer.setAnimationLoop(null);walk.setEnabled(false);orbit.enabled=false;
      console.error('[VJU FRAME_FAILED]',error);
      showSceneRecovery(tr('Cảnh đang gián đoạn. Bạn vẫn có thể đọc và gửi lời chúc.'),'FRAME_FAILED');
    }
  });
  // Read-only diagnostics for local QA; not included in production behavior.
  if (localReview) Object.defineProperty(window, '__VJU_QA__', { get: () => ({
    i18n:i18nState(),landscape:landscape.userData.landscapeAudit,feedbackFx:feedbackFx?.state(),journey:rpg?.journey(),graphics:graphics.state(),pixelRatio:renderer.getPixelRatio(),fog:{near:(scene.fog as THREE.Fog).near,far:(scene.fog as THREE.Fog).far},batch03:batchPreview?.state(),avatarCollection:{selected:null,status:'legacy',rendered:'legacy'},heading:walk.heading,admission:admission?.state(),play:campusPlay?.state(),multiplayer:presence?.state(),
    football:football.state(),
    mode, seated:walk.seated, stageSeats:STAGE_SEATS, player:walk.position.toArray(), playerView:walk.view, avatarVisible:avatar.root.visible, windowMaterials:windows.count, festival:experience?.state(), position: (mode === 'plan' || mode === 'domplan' ? planCamera : camera).position.toArray(),
    cameraKind: mode === 'plan' || mode === 'domplan' ? 'orthographic' : 'perspective',
    direction: (mode === 'plan' || mode === 'domplan' ? planCamera : camera).getWorldDirection(new THREE.Vector3()).toArray(),
    colliders: campus.colliders.map(c => ({...c})),
    bounds: {...campus.bounds}, landmarks: Object.fromEntries(Object.entries(campus.landmarks).map(([k,v]) => [k,v.toArray()])),
    domBuildings:DOM_LAYOUT_DRAFT.map(b=>({id:b.id,name:b.displayName,x:b.x,z:b.z,rotation:b.rotation})),
    groundAudit:groundSurfaceAudit(scene),
    pavingAudit:(()=>{const paving:number[][][]=[],roads:number[][][]=[];scene.updateMatrixWorld(true);scene.traverse(obj=>{if(!(obj instanceof THREE.Mesh))return;const pos=obj.geometry.getAttribute('position');if(obj.parent?.name==='dom-paving-unified'){const idx=obj.geometry.index;for(let i=0;i<(idx?.count||pos.count);i+=3)paving.push([0,1,2].map(j=>{const p=new THREE.Vector3().fromBufferAttribute(pos,idx?idx.getX(i+j):i+j).applyMatrix4(obj.matrixWorld);return [p.x,p.z];}));}if(obj.userData.road){const left:number[][]=[],right:number[][]=[];for(let i=0;i<pos.count;i+=2){for(const [offset,out] of [[0,left],[1,right]] as const){const p=new THREE.Vector3().fromBufferAttribute(pos,i+offset).applyMatrix4(obj.matrixWorld);out.push([p.x,p.z]);}}roads.push([...left,...right.reverse()]);}});return {paving,roads};})(),
    benches:(()=>{const list:{position:number[];front:number[]}[]=[];scene.traverse(o=>{if(o.name==='bench-facing-flower-garden')list.push({position:o.position.toArray(),front:o.userData.front});});return list;})(),
    boardPage:experience?.boardState(),reflectionBoard:experience?.reflectionState(),festivalArt:{heroAsset:scene.getObjectByName('festival')?.userData.heroAsset||'pending',mockStickers:scene.getObjectByName('festival-greetings-board')?.userData.mockData===true},
      flowers:greetings.getFlowerState(),heldFlowers:avatar.root.userData.heldFlowers||[],
    calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  }) });
  renderer.domElement.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    walk.setEnabled(false);orbit.enabled=false;renderer.setAnimationLoop(null);
    showSceneRecovery(tr('Cảnh đang gián đoạn. Bạn vẫn có thể đọc và gửi lời chúc.'),'WEBGL_CONTEXT_LOST');
  });
  document.body.dataset.ready = 'true';
  presence=mountPresence({scene,camera,tab:admission.tab,onFootball:football.adopt,canChat:()=>!greetings.isOpen()&&!rpg?.isOpen()&&!campusPlay?.isBusy()&&!experience?.reflectionReading(),pause:v=>experience?.pause(v),active:()=>{
    const s=experience?.state();return !!admission?.active()&&!accountOpen&&!!s?.enabled&&mode==='walk'&&!s.welcome&&!s.intro&&!s.finale&&!s.flowerView;
  },pose:()=>({x:walk.position.x,y:walk.position.y,z:walk.position.z,heading:Math.atan2(Math.sin(avatar.root.rotation.y),Math.cos(avatar.root.rotation.y)),state:walk.seated?'seated':walk.moving?'walking':'idle',groundSeat:!!walk.seated?.startsWith('sakura-')&&walk.seated!=='sakura-bench',appearance:avatar.root.userData.appearance})});
} catch (error) {
  console.error('[VJU SCENE_INIT_FAILED]',error);
  showSceneRecovery(tr('Chưa tải được cảnh sân trường. Bạn vẫn có thể đọc và gửi lời chúc, hoặc thử tải lại cảnh.'));
}
