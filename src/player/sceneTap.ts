type Contact=Pick<PointerEvent,'pointerId'|'pointerType'|'button'|'isPrimary'|'clientX'|'clientY'|'timeStamp'>;
/** A tap must stay within its slop for the entire gesture, not only finish near its start. */
export function createSceneTap(threshold=8,maxDuration=750){
 let start:Contact|null=null,dragged=false;
 const cancel=()=>{start=null;dragged=false;};
 return {
  down(e:Contact){
   if(start){dragged=true;return;}
   if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
   start=e;dragged=false;
  },
  move(e:Contact){if(start&&e.pointerId===start.pointerId&&Math.hypot(e.clientX-start.clientX,e.clientY-start.clientY)>threshold)dragged=true;},
  up(e:Contact){
   if(!start||e.pointerId!==start.pointerId)return false;
   const tapped=!dragged&&e.timeStamp>=start.timeStamp&&e.timeStamp-start.timeStamp<=maxDuration&&Math.hypot(e.clientX-start.clientX,e.clientY-start.clientY)<=threshold;
   cancel();return tapped;
  },cancel,
 };
}
export function onSceneTap(canvas:HTMLElement,callback:(event:PointerEvent)=>void,threshold=8,capture=false){
 const tap=createSceneTap(threshold),abort=new AbortController(),signal=abort.signal;
 // A second finger may land on the joystick, which stops event propagation.
 window.addEventListener('pointerdown',event=>{if(event.pointerType==='touch'&&!event.isPrimary)tap.cancel();},{signal,capture:true});
 canvas.addEventListener('pointerdown',tap.down,{signal});
 canvas.addEventListener('pointermove',tap.move,{signal});
 canvas.addEventListener('pointerup',event=>{
  if(!tap.up(event))return;
  const before=document.querySelector('dialog[open]');callback(event);
  if(document.querySelector('dialog[open]')!==before){
   // Touch generates a compatibility click after pointerup. A modal opened above
   // that point must not receive it as a second choice (e.g. enter a lab immediately).
   const guard=new AbortController();
   window.addEventListener('click',click=>{click.preventDefault();click.stopImmediatePropagation();guard.abort();},{capture:true,once:true,signal:guard.signal});
   window.addEventListener('pointerdown',()=>guard.abort(),{capture:true,once:true,signal:guard.signal});
   setTimeout(()=>guard.abort(),800);
  }
 },{signal,capture});
 for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,tap.cancel,{signal});
 window.addEventListener('blur',tap.cancel,{signal});
 document.addEventListener('visibilitychange',tap.cancel,{signal});
 return ()=>{tap.cancel();abort.abort();};
}
