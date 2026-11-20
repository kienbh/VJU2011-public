import {tr} from '../i18n/index.ts';
import {onSceneTap} from '../player/sceneTap';
import * as T from 'three';
import type {createKoi} from './koi';
import './fishFeeding.css';

export function mountFishFeeding(o:{koi:ReturnType<typeof createKoi>;scene:T.Scene;camera:T.PerspectiveCamera;at:()=>T.Vector3;canUse:()=>boolean;announce:(text:string)=>void;poem?:{near(at:T.Vector3):boolean;open():void};onFeed?:()=>void;splash?:(at:{x:number;z:number})=>void}){
  const canvas=document.querySelector<HTMLCanvasElement>('#canvas-host canvas')!;
  const panel=document.createElement('div');panel.className='fish-feeding';panel.hidden=true;
  const action=document.createElement('button');action.type='button';
  const hint=document.createElement('span');hint.className='fish-feeding-hint';hint.textContent=tr('Chạm mặt nước để ném mồi');
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent=tr('Huỷ');
  const poem=document.createElement('button');poem.type='button';poem.dataset.lakePoem='true';poem.textContent=tr('Đọc thơ');poem.onclick=()=>{if(o.canUse()&&o.poem?.near(o.at())){stop();o.poem.open();}};
  const status=document.createElement('span');status.setAttribute('role','status');status.className='fish-feeding-status';panel.append(status);
  panel.append(hint,action,cancel,poem);document.querySelector('#viewport')!.append(panel);
  const marker=new T.Mesh(new T.RingGeometry(.45,.60,32),new T.MeshBasicMaterial({color:'#f7d67e',side:T.DoubleSide,depthWrite:false}));
  marker.rotation.x=-Math.PI/2;marker.visible=false;marker.renderOrder=4;o.scene.add(marker);
  const ray=new T.Raycaster(),ndc=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.11),hit=new T.Vector3();
  let armed=false,valid=false;
  function aim(x:number,y:number){
    const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);ray.setFromCamera(ndc,o.camera);
    valid=!!ray.ray.intersectPlane(plane,hit)&&o.koi.validTarget(hit,o.at());
    marker.visible=armed&&valid;if(valid)marker.position.copy(hit);
  }
  function centre(){const rect=canvas.getBoundingClientRect();aim(rect.left+rect.width/2,rect.top+rect.height/2);}
  function stop(){armed=false;marker.visible=false;update();}
  function throwFood(){
    if(!armed||!o.canUse())return;
    if(!valid){o.announce(tr('Chọn mặt nước gần bờ, trong vùng cá bơi.'));return;}
    if(o.koi.feed(hit,o.at())){o.onFeed?.();o.splash?.(hit);status.textContent=tr('Đã ném mồi. Còn {0} lượt.',{0:o.koi.foodState().charges});stop();}
  }
  action.onclick=()=>{
    if(armed){centre();throwFood();return;}
    if(!o.koi.foodState().charges)return;
    armed=true;centre();update();
  };
  cancel.onclick=()=>{stop();action.focus();};
  canvas.addEventListener('pointermove',e=>{if(armed)aim(e.clientX,e.clientY);});
  onSceneTap(canvas,e=>{
    if(!armed)return;
    e.stopImmediatePropagation();aim(e.clientX,e.clientY);throwFood();
  },8,true);
  window.addEventListener('keydown',e=>{if(armed&&e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();stop();action.focus();}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  function update(){
    const canFeed=o.koi.nearBank(o.at()),canRead=!!o.poem?.near(o.at());
    const show=o.canUse()&&!document.hidden&&(canFeed||canRead);
    if(!show||!canFeed){armed=false;marker.visible=false;}
    panel.hidden=!show;const state=o.koi.foodState();
    action.hidden=!canFeed;poem.hidden=!canRead||armed;
    action.disabled=!state.charges;
    action.textContent=armed?tr('Ném vào tâm nhìn'):state.charges?tr('Cho cá ăn · {0}/3',{0:state.charges}):tr('Hồi mồi · {0}s',{0:state.seconds});
    hint.hidden=cancel.hidden=!armed;action.setAttribute('aria-pressed',String(armed));
    if(armed&&matchMedia('(pointer:coarse)').matches)hint.textContent=tr('Chạm mặt nước để ném mồi');
    else hint.textContent=tr('Bấm mặt nước để ném mồi');
  }
  return {update,isVisible:()=>!panel.hidden,isAiming:()=>armed};
}
