import * as T from 'three';
import type {StageSeat} from '../festival/stageLayout';
/** Camera-only input: sitting never updates the player's world position. */
export function createSeatedOrbit(camera:T.PerspectiveCamera){
 const canvas=document.querySelector<HTMLElement>('#canvas-host canvas')!;
 let seat:StageSeat|null=null,yaw=0,pitch=.32,pointer:number|null=null,x=0,y=0;
 const end=(e:PointerEvent)=>{if(pointer!==e.pointerId)return;pointer=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);};
 canvas.addEventListener('pointerdown',e=>{if(!seat||pointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();pointer=e.pointerId;x=e.clientX;y=e.clientY;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!seat||e.pointerId!==pointer)return;const sensitivity=e.pointerType==='touch'?.006:.004;yaw-=(e.clientX-x)*sensitivity;pitch=T.MathUtils.clamp(pitch+(e.clientY-y)*sensitivity,.08,.85);x=e.clientX;y=e.clientY;});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,end as EventListener);
 return {set(value:StageSeat|null){if(seat?.id!==value?.id){yaw=value?.heading||0;pitch=.32;pointer=null;}seat=value;},step(n:number){yaw+=n*.65;},update(){if(!seat)return;const radius=7;camera.position.set(seat.x+Math.sin(yaw)*Math.cos(pitch)*radius,seat.eyeY+.4+Math.sin(pitch)*radius,seat.z+Math.cos(yaw)*Math.cos(pitch)*radius);camera.lookAt(seat.x,seat.eyeY+.35,seat.z);}};
}
