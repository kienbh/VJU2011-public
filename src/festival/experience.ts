import {tr} from '../i18n/index.ts';
import {onSceneTap} from '../player/sceneTap';
import {FINALE_SECONDS} from './finalePlan';
import {skyVertex,skyFragment} from './skyShader';
import {createDuskEnvironment} from './duskEnvironment';
import {createFireworksMode} from './fireworksMode';
import {nextDusk,readScene} from './scenePreset';
import {loadGraphics,saveGraphics} from '../graphics/settings';
import {createBoardPager,loadPublicBoardPage} from './boardFeed';
import {GARDEN_PLOTS,nearFlowerGarden,nearestEmptyPlot,nearPlantGarden} from './festivalLayout';
import type {FlowerLoopState} from './flowerLoop';
import * as THREE from 'three';
import { createFestivalScene, type PublicFestivalCard } from './scene';
import type { Collider } from '../types';
import { createFestivalBreeze } from './breeze';
import { createEveningAmbience } from './eveningAmbience';
import { createGuidanceLight } from './guidanceLight';
import './experience.css';
import {isFlower,type FlowerKind} from '../greetings/flowers';

type EventConfig = { acceptingSubmissions: boolean; effectsEnabled: boolean; closingAt: string | null; mode: string };
type Options = {
  scene: THREE.Scene; campus: THREE.Object3D; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight; ambient: THREE.HemisphereLight; colliders: Collider[];
  setMode(mode: 'walk' | 'flycam' | 'gate' | 'courtyard' | 'plan'): void;
  pause(paused: boolean): void; openBoard(): void; isWriting(): boolean;
  openGarden(): void; plantAt(slot:number):void; pickFlower(kind:FlowerKind):string; getBasket():FlowerKind[];getFlowerState():FlowerLoopState;getGardenTotal():number|null;getGardenFocus():number;
  syncWalkView():void; getPlayerPosition():THREE.Vector3; reviewUi:boolean;
};

/** Festival is an additive presentation of the reviewed campus, never a second map. */
/** Festival is an additive presentation of the reviewed campus, never a second map. */
export function mountExperience(options: Options) {
  const { scene, camera, renderer, sun, ambient } = options;
  const paintEnvironment=createDuskEnvironment(scene);
  const layer = createFestivalScene(options.campus); scene.add(layer.group);
  const reflectionControls=layer.reflectionBoard.mountControls(document.querySelector('#viewport')!,camera,renderer,open=>options.pause(open||options.isWriting()||welcomeOpen));
  const breeze=createFestivalBreeze(layer.group,options.campus), guidanceLight=createGuidanceLight();
  layer.group.add(breeze.group,guidanceLight);
  const ambience=createEveningAmbience();scene.add(ambience.group);
  const baseFog=scene.fog instanceof THREE.Fog?{near:scene.fog.near,far:scene.fog.far}:null;
  const skyMaterial=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{dusk:{value:0},cloudAmount:{value:1},top:{value:new THREE.Color('#879eb7')},horizon:{value:new THREE.Color('#f1c39f')}},
    vertexShader:skyVertex,fragmentShader:skyFragment,
  });
  const skyDome=new THREE.Mesh(new THREE.SphereGeometry(850,48,32),skyMaterial);skyDome.name='festival-sunset-sky';skyDome.renderOrder=-20;skyDome.visible=false;scene.add(skyDome);
  const settings=loadGraphics();let scenePreset=readScene(settings.scene),dusk=scenePreset==='dusk'?1:0,showEnabled=settings.fireworks===true,showBudget=11500;
  let show:ReturnType<typeof createFireworksMode>|undefined;document.addEventListener('visibilitychange',()=>{if(document.hidden&&show)show.root.visible=false;});const baseSunPosition=sun.position.clone();
  function mountPresentation(root:HTMLElement){const field=document.createElement('fieldset');field.className='graphics-presentation';field.innerHTML=`<legend>${tr('Không gian sân trường')}</legend><label>${tr('Ánh sáng')} <select aria-label="${tr('Ánh sáng')}"><option value="day">${tr('Ban ngày')}</option><option value="dusk">${tr('Chạng vạng')}</option></select></label><label><input type="checkbox"> ${tr('Pháo hoa 20/11')}</label><small>${tr('Pháo hoa nghỉ khi ẩn tab hoặc xem kết lễ.')}</small>`;const select=field.querySelector('select')!,check=field.querySelector('input')!;select.value=scenePreset;check.checked=showEnabled;select.onchange=()=>{scenePreset=readScene(select.value);saveGraphics({scene:scenePreset});};check.onchange=()=>{showEnabled=check.checked;saveGraphics({fireworks:showEnabled});};root.append(field);}
  const baseColliders = [...options.colliders];
  let enabled = false, introTime: number | null = null, finaleTime: number | null = null;
  const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=motionPreference.matches,explicitMotion=false,welcomeOpen=false,flowerTime:number|null=null;
  type Pose={position:THREE.Vector3;quaternion:THREE.Quaternion;fov:number};
  let savedPose:Pose|null=null;
  const poseCamera=new THREE.PerspectiveCamera();
  function savePose(){savedPose={position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};options.pause(true);document.body.classList.add('cinematic-active');}
  function restorePose(){if(savedPose){camera.position.copy(savedPose.position);camera.quaternion.copy(savedPose.quaternion);camera.fov=savedPose.fov;camera.updateProjectionMatrix();options.syncWalkView();savedPose=null;}document.body.classList.remove('cinematic-active');options.pause(options.isWriting()||welcomeOpen);}
  const introPath=new THREE.CatmullRomCurve3([new THREE.Vector3(60,5,87),new THREE.Vector3(65,3.5,80),new THREE.Vector3(76,2.4,73),new THREE.Vector3(84,1.7,69)]);
  const introTargets=new THREE.CatmullRomCurve3([new THREE.Vector3(66,3.2,58),new THREE.Vector3(68,3.1,56),new THREE.Vector3(78,2.7,51),new THREE.Vector3(84,1.7,20)]);
  let event: EventConfig = { acceptingSubmissions: true, effectsEnabled: true, closingAt: null, mode: 'rehearsal' };
  // Visitor switch for fireflies, drifting leaves and wind; remembered on this browser.
  let effects=true;try{effects=localStorage.getItem('vju2011-ambience')!=='off';}catch{/* optional */}
  const allowsBreeze=()=>effects&&enabled&&event.effectsEnabled&&!reduced&&!document.hidden&&!options.isWriting();
  let seenClosing: string | null = null;
  try { seenClosing=sessionStorage.getItem('vju2011-seen-closing'); } catch { /* Session storage is optional. */ }
  const introStory=[
    [tr('Một mùa tri ân'),tr('Gặp nhau ở sân trường VJU, dành một lời cảm ơn gửi thầy cô.')],
    [tr('Qua cổng trường'),tr('Đi thẳng qua cổng, rồi rẽ trái theo lối đèn vào sân.')],
    [tr('Bảng Tri Ân'),tr('Dừng bên bảng để đọc thiệp đã duyệt hoặc gửi lời chúc của mình.')],
    [tr('Vườn lời chúc'),tr('Hái hoa, phối bó và trồng vào ô có tên bạn. Viết thiệp là lựa chọn riêng.')],
  ];
  let introChapter=-1,routeHint='';
  const panel = document.createElement('div'); panel.className = 'festival-tools';
  panel.innerHTML = `<button id="festival-toggle">${tr('Vào lễ hội')}</button><button id="festival-board">${tr('Bảng Tri Ân')}</button><button id="festival-garden">${tr('Vườn hoa')}</button><button id="festival-intro">${tr('Dạo một vòng')}</button><button id="festival-finale">${tr('Xem kết lễ thử')}</button><label><input id="festival-reduced" type="checkbox"> ${tr('Giảm chuyển động')}</label><label><input id="festival-ambience" type="checkbox" checked> ${tr('Đom đóm & gió')}</label>`;
  (panel.querySelector('#festival-toggle') as HTMLElement).hidden=!options.reviewUi;
  (panel.querySelector('#festival-intro') as HTMLElement).hidden=!options.reviewUi;
  panel.querySelector('#festival-finale')!.textContent=tr('Xem kết lễ');
  document.querySelector('#viewport')!.append(panel);
  const routeGuide=document.createElement('p');routeGuide.className='route-guidance';routeGuide.setAttribute('role','status');document.querySelector('#viewport')!.append(routeGuide);
  const boardControls=document.createElement('section');boardControls.className='board-pager';boardControls.hidden=true;
  boardControls.innerHTML=`<p class="board-pager-status">${tr('Đang tải lời chúc công khai…')}</p><button id="board-next" type="button">${tr('Lời chúc tiếp theo →')}</button><small id="board-countdown">${tr('Tự đổi sau 10 giây')}</small>`;
  document.querySelector('#viewport')!.append(boardControls);
  const boardStatus=boardControls.querySelector('p')!,boardNext=boardControls.querySelector<HTMLButtonElement>('#board-next')!,boardCountdown=boardControls.querySelector('#board-countdown')!;
  const pager=createBoardPager({load:loadPublicBoardPage,change:page=>layer.setBoardPage(page),status:text=>{boardStatus.textContent=text;},now:()=>performance.now(),tr});
  boardNext.onclick=()=>{void pager.next();};
  const overlay = document.createElement('div'); overlay.className='festival-overlay'; overlay.hidden=true;
  overlay.innerHTML=`<p class="festival-kicker">VJU · 20/11</p><h2>${tr('Một lời cảm ơn,')}<br>${tr('một mùa hoa')}</h2><p id="festival-overlay-copy"></p><button id="festival-skip">${tr('Bỏ qua')}</button>`;
  document.querySelector('#viewport')!.append(overlay);
  const credit=document.createElement('p');credit.className='finale-credit';credit.hidden=true;credit.textContent='Developed by: Bui Huy Kien, Tran Ngo Tien Dat, Tran Quan';document.querySelector('#viewport')!.append(credit);
  const toast = document.createElement('p'); toast.className='festival-toast'; toast.setAttribute('role','status');toast.hidden=true;document.querySelector('#viewport')!.append(toast);
  let toastUntil=0;
  function announce(message:string) { toast.textContent=message;toast.hidden=false;toastUntil=performance.now()+5500; }
  function paint(night=0) {
    const sky = enabled ? new THREE.Color('#71839b').lerp(new THREE.Color('#344258'),night) : new THREE.Color('#dbe5e7');
    scene.background=sky;
    if(scene.fog instanceof THREE.Fog&&baseFog){
      scene.fog.color.copy(sky);scene.fog.near=baseFog.near;scene.fog.far=baseFog.far;
    }
    skyMaterial.uniforms.top.value.set('#506f98').lerp(new THREE.Color('#101a30'),night);
    skyMaterial.uniforms.horizon.value.set('#a3b4c5').lerp(new THREE.Color('#344258'),night);
    ambient.color.set(enabled ? 0xa9c4f2 : 0xf4f9ff);ambient.groundColor.set(enabled?0x66766d:0x778273);ambient.intensity=enabled ? THREE.MathUtils.lerp(1.65,.8,night) : 2.2;
    sun.color.set(enabled ? 0xffdfbd : 0xfff2df); sun.intensity=enabled ? THREE.MathUtils.lerp(1.2,.42,night) : 2.3;
    renderer.toneMappingExposure=enabled ? 1.12 : 1.3;
    if(enabled&&night===0){sky.lerp(new THREE.Color('#626080'),dusk);scene.background=sky;if(scene.fog instanceof THREE.Fog)scene.fog.color.copy(sky);skyMaterial.uniforms.top.value.lerp(new THREE.Color('#423e72'),dusk);skyMaterial.uniforms.horizon.value.lerp(new THREE.Color('#edb292'),dusk);ambient.intensity=THREE.MathUtils.lerp(1.65,1.15,dusk);sun.intensity=THREE.MathUtils.lerp(1.2,.75,dusk);sun.color.lerp(new THREE.Color('#ffb477'),dusk);}
    skyMaterial.uniforms.dusk.value=enabled?Math.max(dusk,night):0;
    paintEnvironment(enabled?dusk:0,enabled?night:0);
    sun.position.copy(baseSunPosition).lerp(new THREE.Vector3(-110,35,70),enabled?dusk:0);
  }
  function finishIntro() { introTime=null;overlay.hidden=true;document.body.classList.remove('cinematic-active');options.setMode('walk');options.pause(options.isWriting()||welcomeOpen); }
  function stopFinale() { finaleTime=null;credit.hidden=true;skyMaterial.uniforms.cloudAmount.value=1;flowerTime=null;layer.setFinale(null,reduced);overlay.hidden=true;overlay.classList.remove('finale-controls');restorePose();paint(); }
  function setEnabled(next:boolean) {
    if(!next&&reflectionControls.isOpen())reflectionControls.close();
    enabled=next;if(!next)boardControls.hidden=true;layer.group.visible=next;skyDome.visible=next;document.body.classList.toggle('festival-active',next);
    layer.setPresentation(next);if(!next){breeze.update(0,false);ambience.group.visible=false;}
    const external=options.colliders.filter(c=>!baseColliders.includes(c)&&!layer.colliders.includes(c));options.colliders.splice(0,options.colliders.length,...(next?baseColliders.filter(c=>!layer.replacesCollider(c)):baseColliders),...external);if(next)options.colliders.push(...layer.colliders);
    introTime=null;stopFinale();
    panel.querySelector('#festival-toggle')!.textContent=next?tr('Map ban ngày'):tr('Vào lễ hội');
    document.querySelector('h1')!.textContent=next?tr('Một mùa tri ân'):tr('Duyệt mặt bằng');
    document.querySelector('.status')!.textContent=next?tr('20/11 · Bản trải nghiệm thử'):tr('Map đã duyệt · Ước lượng');
    document.querySelector('.scene-note')!.textContent=next?tr('Không âm thanh · Nội dung công khai qua kiểm duyệt'):tr('Bố trí theo duyệt mới nhất · Kích thước ước lượng');
    options.setMode(next?'walk':'plan'); paint();
  }
  function startIntro() {
    if(!enabled)setEnabled(true);
    if(!event.effectsEnabled){announce(tr('Hiệu ứng đang được quản trị viên tắt. Anh/chị vẫn có thể đi lại và mở Bảng Tri Ân.'));return;}
    if(reduced){finishIntro();return;}
    stopFinale();options.pause(true);document.body.classList.add('cinematic-active');introTime=0;
    introChapter=-1;
    overlay.hidden=false;overlay.classList.remove('is-finale');
    overlay.querySelector('#festival-skip')!.textContent=tr('Bỏ qua');
    overlay.querySelector('h2')!.innerHTML=`${tr('Một lời cảm ơn,')}<br>${tr('một mùa hoa')}`;
    overlay.querySelector('#festival-overlay-copy')!.textContent=tr('Từ cổng trường đến Bảng Tri Ân và vườn lời chúc.');
  }
  function startFinale() {
    if(!event.effectsEnabled){announce(tr('Hiệu ứng đang được quản trị viên tắt.'));return;}
    if(options.isWriting()){announce(tr('Hãy hoàn thành hoặc đóng thiệp trước khi xem kết lễ.'));return;}
    if(!enabled)setEnabled(true);if(introTime!==null)finishIntro();if(savedPose)stopFinale();savePose();finaleTime=0;
    overlay.hidden=false;overlay.classList.add('is-finale','finale-controls');credit.hidden=false;
    overlay.querySelector('#festival-skip')!.textContent=tr('Trở lại');
  }
  let viewedSlot=-1;
  function viewFlower(slot=-1){
    viewedSlot=slot;
    if(!enabled)setEnabled(true);if(introTime!==null)finishIntro();if(savedPose)stopFinale();savePose();flowerTime=0;if(!options.getFlowerState().planted.some(Boolean))layer.bloom();
    overlay.hidden=false;overlay.classList.add('is-finale');overlay.querySelector('h2')!.textContent=tr('Hoa của lời cảm ơn');
    overlay.querySelector('#festival-overlay-copy')!.textContent=options.getFlowerState().planted.some(Boolean)?tr('Chậu hoa được lưu trong vườn chung. Dùng Hoa của tôi để xem vị trí và trạng thái duyệt.'):tr('Bông hoa tượng trưng cho thiệp đã được tiếp nhận. Không công khai nội dung riêng.');
    overlay.querySelector('#festival-skip')!.textContent=tr('Trở lại chỗ đang đứng');
  }
  (panel.querySelector('#festival-reduced') as HTMLInputElement).checked=reduced;
  function applyMotion(value:boolean){reduced=value;document.body.classList.toggle('reduced-motion',value);(panel.querySelector('#festival-reduced') as HTMLInputElement).checked=value;if(reduced&&introTime!==null)finishIntro();layer.setFinale(finaleTime===null?null:finaleTime/FINALE_SECONDS,reduced);}
  applyMotion(reduced);
  panel.querySelector('#festival-reduced')!.addEventListener('change',e=>{explicitMotion=true;applyMotion((e.target as HTMLInputElement).checked);});
  motionPreference.addEventListener('change',e=>{if(!explicitMotion)applyMotion(e.matches);});
  const ambienceBox=panel.querySelector<HTMLInputElement>('#festival-ambience')!;ambienceBox.checked=effects;document.body.classList.toggle('ambience-off',!effects);
  ambienceBox.addEventListener('change',()=>{effects=ambienceBox.checked;document.body.classList.toggle('ambience-off',!effects);try{localStorage.setItem('vju2011-ambience',effects?'on':'off');}catch{/* optional */}});
  panel.querySelector('#festival-toggle')!.addEventListener('click',()=>setEnabled(!enabled));
  panel.querySelector('#festival-board')!.addEventListener('click',options.openBoard);
  const nearGarden=()=>enabled&&nearFlowerGarden(options.getPlayerPosition());
  function openGarden(){if(nearGarden())options.openGarden();else announce(tr('Vườn hoa ở bên phải Bảng Tri Ân, khi đứng từ lối vào nhìn vào sân. Đi dọc mép vườn để hái và trồng hoa.'));}
  panel.querySelector('#festival-garden')!.addEventListener('click',openGarden);
  panel.querySelector('#festival-intro')!.addEventListener('click',startIntro);
  panel.querySelector('#festival-finale')!.addEventListener('click',startFinale);
  overlay.querySelector('#festival-skip')!.addEventListener('click',()=>introTime!==null?finishIntro():stopFinale());
  function nextStageMode(){announce(tr('Phông sân khấu · {0}. Mỗi câu hiện 10 giây.',{0:layer.stageSign.userData.nextMode()}));}
  window.addEventListener('vju-stage-mode',nextStageMode);
  const raycaster=new THREE.Raycaster();
  onSceneTap(renderer.domElement,e=>{
    if(!enabled||introTime!==null||finaleTime!==null||flowerTime!==null||welcomeOpen)return;
    const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);
    if(options.isWriting()||reflectionControls.isOpen())return;
    const reflectionHit=raycaster.intersectObject(layer.reflectionBoard.face,false)[0];
    if(reflectionHit&&reflectionHit.distance<43){if(!layer.reflectionBoard.select(reflectionHit.uv))reflectionControls.open();return;}
    if(enabled&&nearPlantGarden(options.getPlayerPosition())){const plot=raycaster.intersectObjects(layer.plotTargets,false)[0];if(plot){options.plantAt(plot.object.userData.plot);return;}}
    if(nearGarden()){const hit=raycaster.intersectObjects(layer.flowerTargets,true)[0];if(hit){let node:THREE.Object3D|null=hit.object;while(node&&!isFlower(node.userData.flowerKind))node=node.parent;if(node&&isFlower(node.userData.flowerKind)){announce(options.pickFlower(node.userData.flowerKind));return;}}}
    if(options.getPlayerPosition().distanceTo(layer.landmarks.stage)<45){const sign=raycaster.intersectObject(layer.stageSign,false)[0];if(sign){announce(tr('Phông sân khấu · {0}. Mỗi câu hiện 10 giây.',{0:layer.stageSign.userData.select(sign.uv)}));return;}}
    if(raycaster.intersectObject(layer.board,true).length)options.openBoard();
  },6);
  window.addEventListener('keydown',e=>{if(e.code==='KeyF'&&!e.repeat&&!options.isWriting()&&nearGarden())options.openGarden();});
  window.addEventListener('keydown',e=>{if(enabled&&e.code==='KeyE'&&!options.isWriting()&&options.getPlayerPosition().distanceTo(layer.landmarks.board)<14)options.openBoard();});
  layer.group.visible=false;
  return {
    closeOverlays(){if(introTime!==null)finishIntro();stopFinale();reflectionControls.close();},
    mountPresentation,setParticleBudget(value:number){showBudget=value;},setEnabled, startIntro,viewFlower,boardState:pager.state,reflectionState:layer.reflectionBoard.state,reflectionReading:reflectionControls.isOpen,openReflections:reflectionControls.open,
    setWelcomeOpen(value:boolean){welcomeOpen=value;options.pause(value||options.isWriting());},
    pause(open:boolean){if(open&&introTime!==null)finishIntro();if(open&&savedPose)stopFinale();options.pause(open||welcomeOpen||introTime!==null||finaleTime!==null||flowerTime!==null);},
    bloom(){if(!event.effectsEnabled)return;layer.bloom();},
    setPublicCards(cards:PublicFestivalCard[]){layer.setPublicCards(cards);},
    setConfig(config:{event:EventConfig}){event=config.event;if(!event.effectsEnabled){if(introTime!==null)finishIntro();stopFinale();}},
    beforeReview(){if(introTime!==null)finishIntro();if(enabled)setEnabled(false);},
    update(dt:number){
      const next=nextDusk(dusk,scenePreset,dt,reduced);if(next!==dusk){dusk=next;if(finaleTime===null)paint();}
      if(showEnabled&&!show){show=createFireworksMode();scene.add(show.root);}
      show?.update(dt,showEnabled&&enabled&&event.effectsEnabled&&!document.hidden&&!welcomeOpen&&introTime===null&&finaleTime===null&&flowerTime===null,reduced,renderer.getPixelRatio(),showBudget,camera.aspect);
      const boardActive=enabled&&!document.hidden&&!welcomeOpen&&!options.isWriting()&&!reflectionControls.isOpen()&&introTime===null&&finaleTime===null&&flowerTime===null;
      reflectionControls.update(boardActive);
      pager.tick(performance.now(),boardActive);
      boardControls.hidden=!boardActive||document.body.dataset.mode!=='walk'||options.getPlayerPosition().distanceTo(layer.landmarks.board)>24;
      const pageState=pager.state();boardNext.disabled=pageState.busy||pageState.total===0;
      boardCountdown.textContent=pageState.busy?tr('Đang tải…'):tr('Tự đổi sau {0} giây',{0:pageState.remaining});
      if(!enabled)return;layer.update(dt);breeze.update(dt,allowsBreeze());ambience.update(dt,camera,true,reduced,renderer.getPixelRatio(),effects&&finaleTime===null);skyDome.position.copy(camera.position);
      if(!toast.hidden&&performance.now()>toastUntil)toast.hidden=true;
      if(introTime!==null){
        introTime+=dt;const progress=Math.min(introTime/9,1),t=THREE.MathUtils.smoothstep(progress,0,1),i=Math.min(3,Math.floor(progress*4));
        if(introChapter!==i){introChapter=i;overlay.querySelector('h2')!.textContent=introStory[i][0];overlay.querySelector('#festival-overlay-copy')!.textContent=introStory[i][1];}
        camera.position.copy(introPath.getPointAt(t));camera.lookAt(introTargets.getPointAt(t));
        if(introTime>=9)finishIntro();
      }
      // In-place guidance follows the visitor, without moving the camera or adding obstacles.
      if(document.body.dataset.mode==='walk'&&introTime===null){
        const atGarden=nearFlowerGarden(options.getPlayerPosition());
        const atBoard=options.getPlayerPosition().distanceTo(layer.landmarks.board)<14;
        const stage=atGarden?'garden':atBoard?'board':options.getPlayerPosition().z>35?'gate':options.getPlayerPosition().x>62?'turn':'courtyard';
        const message=atGarden?tr('Vườn lời chúc · Chạm luống để hái; nhấn F để chọn ô trồng hoa có ghi danh.'):atBoard?tr('Bảng Tri Ân · Nhấn E hoặc chạm vào bảng để đọc và gửi thiệp.'):stage==='gate'?tr('Đi thẳng qua cổng, rồi rẽ trái vào sân.'):stage==='turn'?tr('Rẽ trái theo lối đèn · Bảng Tri Ân lớn ở giữa sân.'):tr('Theo lối đèn tới Bảng Tri Ân ở giữa sân · Vườn hoa ở bên phải bảng.');
        const hint=document.querySelector<HTMLElement>('#instructions')!;
        const touch=matchMedia('(pointer: coarse)').matches;
        const deviceMessage=touch?message.replace('nhấn F để','chọn Vườn hoa để').replace('Nhấn E hoặc chạm vào bảng','Chạm vào bảng'):message;
        const text=deviceMessage+'  ·  '+(touch?tr('Dùng cần chạm để đi; vuốt cảnh để nhìn.'):tr('WASD / mũi tên để đi; kéo cảnh để nhìn.'));
        routeGuide.textContent=text;routeGuide.dataset.routeStage=stage;
        if(routeHint!==text||hint.textContent!==text){routeHint=text;hint.textContent=text;hint.dataset.routeStage=stage;}
      }
      const basket=options.getBasket(),basketCount=basket.length;layer.setFlowers(options.getFlowerState());layer.setGardenTotal(options.getGardenTotal());
      layer.setPlotTarget(options.getGardenFocus()>=0?options.getGardenFocus():basketCount&&nearPlantGarden(options.getPlayerPosition())?nearestEmptyPlot(options.getPlayerPosition(),options.getFlowerState().planted):-1);
      const gardenButton=panel.querySelector('#festival-garden')!;const gardenLabel=nearGarden()?tr('Bó hoa · {0}/5',{0:basketCount}):tr('Vườn hoa{0}',{0:basketCount?` · ${basketCount}/5`:''});if(gardenButton.textContent!==gardenLabel)gardenButton.textContent=gardenLabel;
      if(event.closingAt&&seenClosing!==event.closingAt&&Date.now()>=Date.parse(event.closingAt)&&!options.isWriting()){
        seenClosing=event.closingAt;try{sessionStorage.setItem('vju2011-seen-closing',seenClosing);}catch{/* optional */}announce(tr('Phiên nhận thiệp đã kết thúc. Bạn có thể chọn Xem kết lễ.'));
      }
      if(finaleTime!==null&&savedPose){
        if(!document.hidden)finaleTime+=dt;const p=Math.min(finaleTime/FINALE_SECONDS,1),blend=reduced?1:THREE.MathUtils.smoothstep(finaleTime,0,1.5);
        const destination=new THREE.Vector3(1,9,Math.max(90,48/Math.max(.3,camera.aspect)-24));
        const look=poseCamera;look.position.copy(destination);look.lookAt(1,48,-50);
        camera.position.lerpVectors(savedPose.position,destination,blend);camera.quaternion.slerpQuaternions(savedPose.quaternion,look.quaternion,blend);camera.fov=64;camera.updateProjectionMatrix();
        layer.setFinale(p,reduced,camera.aspect,showBudget);paint(reduced?.9:THREE.MathUtils.smoothstep(p,.03,.15));skyMaterial.uniforms.cloudAmount.value=1-.75*THREE.MathUtils.smoothstep(p,.03,.15);if(p>=1)stopFinale();
      }
      if(flowerTime!==null&&savedPose){flowerTime+=dt;const blend=reduced?1:THREE.MathUtils.smoothstep(flowerTime,0,1.2),look=poseCamera;const plants=options.getFlowerState().planted;const chosen=viewedSlot>=0?viewedSlot:plants.reduce((last,item,i)=>item&&(!plants[last]||item.plantedAt>=plants[last]!.plantedAt)?i:last,0);const [gx,gz]=GARDEN_PLOTS[chosen];look.position.set(gx,3.8,gz+4.2);look.lookAt(gx,1.5,gz+.35);camera.position.lerpVectors(savedPose.position,look.position,blend);camera.quaternion.slerpQuaternions(savedPose.quaternion,look.quaternion,blend);camera.fov=64;camera.updateProjectionMatrix();}
    },
    state(){
      let finaleScreenBounds:null|{min:number[];max:number[]}=null;
      if(finaleTime!==null){const bounds=new THREE.Box3(),point=new THREE.Vector3(),positions=layer.finale.geometry.attributes.position;for(let i=0;i<Math.min(positions.count,layer.finale.geometry.drawRange.count);i++){point.fromBufferAttribute(positions,i).applyMatrix4(layer.finale.matrixWorld).project(camera);bounds.expandByPoint(point);}finaleScreenBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};}
      return {finaleProgress:finaleTime===null?null:finaleTime/FINALE_SECONDS,finaleFireworks:layer.finaleFireworksState(),finaleLettering:layer.finaleLetteringState(),finaleSky:layer.finaleSkyState(),finaleLogo:layer.finaleLogoState(),finaleCredit:!credit.hidden,scenePreset,dusk,optionalFireworks:show?.state(),enabled,intro:introTime!==null,finale:finaleTime!==null,flowerView:flowerTime!==null,welcome:welcomeOpen,reduced,finaleScreenBounds,breezeAllowed:allowsBreeze(),petalsVisible:breeze.group.visible,landmarks:Object.fromEntries(Object.entries(layer.landmarks).map(([k,v])=>[k,v.toArray()]))};},
  };
}
