import {roundedRectPath} from '../browserCompat';
import {tr,LANG,font} from '../i18n/index.ts';
import {wrapUnits} from '../i18n/lineBreak.ts';
import {REFLECTIONS_JA} from '../reflections/board-content-ja';
import * as THREE from 'three';
import approvedContent from '../reflections/board-content-approved';
import type {Collider} from '../types';

// West edge of the square, facing into the courtyard. Clear of the road,
// stage seating and planting beds; the board never turns to follow the camera.
export const REFLECTION_BOARD={x:-69,z:-3,width:20,height:11.25,centreY:6.9,scale:.75,rotation:Math.PI/2};
type Entry=typeof approvedContent[number];
/** Japanese UI: overlay translated text by id; keep the original type for the Diễn giải / excerpt logic. */
const localize=(list:Entry[]):Entry[]=>LANG==='ja'?list.map(e=>REFLECTIONS_JA[e.id]?{...e,...REFLECTIONS_JA[e.id],originType:e.type}:e):list;
const kind=(e:Entry)=>(e as Entry&{originType?:string}).originType??e.type;
const W=2560,H=1440,FONT=font('"Segoe UI", Arial, sans-serif');
const BUTTONS=[{x:110,y:1295,w:410,h:100,step:-1,label:tr('← Trước')},{x:2040,y:1295,w:410,h:100,step:1,label:tr('Sau →')}];

export function createReflectionBoard(){
 const group=new THREE.Group();group.name='teacher-reflection-board';
 group.position.set(REFLECTION_BOARD.x,0,REFLECTION_BOARD.z);group.rotation.y=REFLECTION_BOARD.rotation;
 group.scale.setScalar(REFLECTION_BOARD.scale);
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d')!;
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 const face=new THREE.Mesh(new THREE.PlaneGeometry(20,11.25),new THREE.MeshBasicMaterial({map:texture,toneMapped:false,fog:false}));
 face.name='teacher-reflection-content';face.position.set(0,REFLECTION_BOARD.centreY,.25);group.add(face);
 const wood=new THREE.MeshStandardMaterial({color:0x45372f,roughness:.72});
 const brass=new THREE.MeshStandardMaterial({color:0xb79b66,metalness:.5,roughness:.6});
 const stone=new THREE.MeshStandardMaterial({color:0xc8c1b2,roughness:.9});
 const boxGeo=new THREE.BoxGeometry(1,1,1);
 function box(name:string,x:number,y:number,z:number,w:number,h:number,d:number,material:THREE.Material){
  const mesh=new THREE.Mesh(boxGeo,material);mesh.name=name;mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 box('reflection-board-backing',0,6.9,0,20.4,11.65,.42,wood);
 for(const x of [-10.22,10.22]){
  box('reflection-board-upright',x,6.5,0,.28,12.5,.5,wood);
  box('reflection-board-brass-edge',x,6.9,.27,.045,11.7,.025,brass);
  box('reflection-board-stone-foot',x,.4,0,.9,.32,1.35,stone);
 }
 for(const y of [1.13,12.67])box('reflection-board-frame',0,y,0,20.8,.25,.54,wood);
 box('reflection-board-cap',0,12.86,0,21.1,.14,.78,wood);
 const colliders:Collider[]=[{minX:-69.65,maxX:-68.35,minZ:-11.2,maxZ:5.2,maxY:9.8,label:tr('Góc suy ngẫm · Nghề thầy')}];
 let entries:Entry[]=localize([...approvedContent]),index=0,revision=0,minFont=0,quoteLines=0,questionFont=0,questionLines=0,textBottom=0;
 const listeners=new Set<()=>void>();
 function lines(text:string,width:number,size:number,weight=400){
  ctx.font=`${weight} ${size}px ${FONT}`;
  return text.split('\n').flatMap(paragraph=>{
   if(!paragraph.trim())return [''];
   // Japanese has no spaces: break units allow breaks between characters (kinsoku-safe).
   return wrapUnits(paragraph,width,s=>ctx.measureText(s).width);
  });
 }
 function text(value:string,x:number,y:number,size:number,color='#2b3736',weight=400,align:CanvasTextAlign='left'){
  ctx.font=`${weight} ${size}px ${FONT}`;ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(value,x,y);
 }
 function attribution(entry:Entry){return `— ${entry.author}${kind(entry).startsWith('Diễn giải')?tr(' · Diễn giải'):''}`;}
 function label(entry:Entry){
  if(kind(entry).startsWith('Diễn giải'))return tr('DIỄN GIẢI · KHÔNG PHẢI NGUYÊN VĂN');
  return tr('BẢN TRÍCH / DỊCH DO BIÊN TẬP VIÊN CUNG CẤP · CHƯA ĐỐI CHIẾU BẢN IN');
 }
 function draw(){
  const entry=entries[index];if(!entry)return;
  ctx.fillStyle='#fff6e5';ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#b49a71';ctx.lineWidth=3;ctx.strokeRect(28,28,W-56,H-56);
  text(tr('GÓC SUY NGẪM: “NGHỀ THẦY”'),110,64,54,'#823c34',700);
  ctx.fillStyle='#b49a71';ctx.fillRect(110,158,2340,2);
  // Equal typographic importance; fit both complete texts together, never shrink only the question.
  let size=104,quote=lines(entry.content,2340,size,500),question=lines(entry.question,2340,size,500);
  const contentBudget=820,lineHeight=1.25;
  while((quote.length+question.length)*size*lineHeight>contentBudget&&size>40){size--;quote=lines(entry.content,2340,size,500);question=lines(entry.question,2340,size,500);}
  if((quote.length+question.length)*size*lineHeight>contentBudget)throw Error('Reflection text exceeds readable board area.');
  let y=210;
  quote.forEach(line=>{text(line,110,y,size,'#202c2b',500);y+=size*lineHeight;});
  minFont=questionFont=size;quoteLines=quote.length;questionLines=question.length;
  // Attribution stays directly below the quote, aligned to its right edge.
  y+=12;text(attribution(entry),2450,y,46,'#823c34',600,'right');
  y+=58;text(entry.source,2450,y,30,'#665b4c',400,'right');
  y+=56;ctx.fillStyle='#b49a71';ctx.fillRect(110,y,2340,2);
  y+=28;text(tr('SUY NGẪM HÔM NAY'),110,y,38,'#823c34',700);
  y+=58;
  question.forEach(line=>{text(line,110,y,size,'#202c2b',500);y+=size*lineHeight;});textBottom=y;
  if(entries.length>1)BUTTONS.forEach(button=>{
   ctx.beginPath();roundedRectPath(ctx,button.x,button.y,button.w,button.h,12);ctx.fillStyle='#344b46';ctx.fill();
   ctx.font=`600 40px ${FONT}`;ctx.textBaseline='middle';ctx.textAlign='center';ctx.fillStyle='#fff6e5';ctx.fillText(button.label,button.x+button.w/2,button.y+button.h/2);
  });
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 32px ${FONT}`;ctx.fillStyle='#665b4c';
  ctx.fillText(entries.length>1?tr('{0} / {1}{2}   ·   Chạm để đọc rõ',{0:index+1,1:entries.length,2:entry.approved?'':tr(' · Bản nháp')}):tr('Hiện có 1 nội dung đã duyệt · Chạm để đọc rõ'),W/2,1345);
  texture.needsUpdate=true;revision++;listeners.forEach(fn=>fn());
 }
 function move(step:number){if(entries.length<2)return;index=(index+step+entries.length)%entries.length;draw();}
 function select(uv?:{x:number;y:number}){
  if(!uv||entries.length<2)return false;
  const button=BUTTONS.find(b=>uv.x*W>=b.x&&uv.x*W<=b.x+b.w&&(1-uv.y)*H>=b.y&&(1-uv.y)*H<=b.y+b.h);
  if(!button)return false;move(button.step);return true;
 }
 draw();
 // Vite removes this import from production, so unapproved drafts are not shipped.
 if(import.meta.env.DEV&&new URLSearchParams(location.search).get('reflectionPreview')!=='approved')void import('../reflections/board-content-preview').then(({default:preview})=>{entries=localize(preview);index=0;draw();});
 return {group,face,colliders,move,select,
  state:()=>({id:entries[index]?.id,index,total:entries.length,revision,minFont,quoteLines,questionFont,questionLines,textBottom,content:entries[index]?.content,question:entries[index]?.question,approved:entries[index]?.approved}),
  // Native focusable hit areas follow the printed controls, including touch sizing.
  mountControls(host:HTMLElement,camera:THREE.Camera,renderer:THREE.WebGLRenderer,onReading:(open:boolean)=>void){
   const controls=document.createElement('div');controls.className='reflection-board-controls';controls.hidden=true;controls.setAttribute('role','group');controls.setAttribute('aria-label',tr('Góc suy ngẫm: Nghề thầy'));
   const live=document.createElement('p');live.className='reflection-sr-only';live.setAttribute('aria-live','polite');controls.append(live);
   const buttons=BUTTONS.map(spec=>{const button=document.createElement('button');button.type='button';button.className='reflection-board-hit';button.setAttribute('aria-label',spec.step<0?tr('Suy ngẫm trước'):tr('Suy ngẫm tiếp theo'));const span=document.createElement('span');span.className='reflection-sr-only';span.textContent=spec.label;button.append(span);button.onclick=()=>move(spec.step);controls.append(button);return button;});
   const read=document.createElement('button');read.type='button';read.className='reflection-read';read.textContent=tr('Đọc rõ');read.setAttribute('aria-label',tr('Đọc rõ Góc suy ngẫm'));controls.append(read);
   const reader=document.createElement('dialog');reader.className='reflection-reader';reader.setAttribute('aria-labelledby','reflection-reader-heading');
   reader.innerHTML=`<header><p id="reflection-reader-heading">${tr('GÓC SUY NGẪM: “NGHỀ THẦY”')}</p><button type="button" aria-label="${tr('Đóng suy ngẫm')}">×</button></header><article tabindex="0"><blockquote></blockquote><p class="reflection-author"></p><p class="reflection-source"></p><h3>${tr('Suy ngẫm hôm nay')}</h3><p class="reflection-question"></p><details class="reflection-notes"><summary>${tr('Ghi chú nguồn')}</summary><p class="reflection-type"></p><p class="reflection-review-status"></p></details></article><footer><button type="button" data-step="-1">${tr('← Trước')}</button><span aria-live="polite"></span><button type="button" data-step="1">${tr('Sau →')}</button></footer>`;
   document.body.append(reader);let lastFocus:HTMLElement|null=null;
   const open=()=>{if(reader.open)return;lastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;reader.showModal();onReading(true);reader.querySelector<HTMLButtonElement>('header button')!.focus();};
   read.onclick=open;
   reader.querySelector<HTMLButtonElement>('header button')!.onclick=()=>reader.close();
   reader.addEventListener('close',()=>{onReading(false);controls.hidden=false;lastFocus?.focus({preventScroll:true});});
   reader.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b=>b.onclick=()=>move(Number(b.dataset.step)));
   const notify=()=>{
    const entry=entries[index];live.textContent=tr('{0} trên {1}. {2}. {3} {4}. {5}. {6}. Suy ngẫm hôm nay: {7}',{0:index+1,1:entries.length,2:entry.title,3:entry.content,4:entry.author,5:entry.source,6:label(entry),7:entry.question});
    [...buttons,...reader.querySelectorAll<HTMLButtonElement>('[data-step]')].forEach(b=>{b.disabled=entries.length<2;b.hidden=entries.length<2;});
    const fill=(selector:string,value:string)=>reader.querySelector(selector)!.textContent=value;
    fill('.reflection-review-status',entry.approved?tr('Nội dung đã duyệt'):tr('Bản nháp · Xem thử local'));fill('blockquote',entry.content);fill('.reflection-author',attribution(entry));fill('.reflection-source',entry.source);fill('.reflection-type',label(entry));fill('.reflection-question',entry.question);fill('footer span',entries.length>1?`${index+1} / ${entries.length}${entry.approved?'':tr(' · Bản nháp')}`:tr('Hiện có 1 nội dung đã duyệt'));
    reader.querySelector<HTMLDetailsElement>('details')!.open=false;
    reader.querySelector('article')!.scrollTop=0;
   };listeners.add(notify);notify();host.append(controls);
   const position=new THREE.Vector3(),normal=new THREE.Vector3(),point=new THREE.Vector3(),cameraPosition=new THREE.Vector3(),localCamera=new THREE.Vector3();
   return {open,isOpen:()=>reader.open,close:()=>reader.close(),update(available:boolean){
    face.getWorldPosition(position);camera.getWorldPosition(cameraPosition);normal.set(0,0,1).transformDirection(face.matrixWorld);
    const facing=normal.dot(point.copy(cameraPosition).sub(position))>0;point.copy(position).project(camera);
    // Only float reading controls in front of the board span, not over adjacent props.
    group.worldToLocal(localCamera.copy(cameraPosition));
    const inFrontOfPanel=Math.abs(localCamera.x)<=REFLECTION_BOARD.width/2+4;
    const visible=available&&inFrontOfPanel&&cameraPosition.distanceTo(position)<43&&facing&&point.z>=-1&&point.z<=1&&Math.abs(point.x)<.8&&Math.abs(point.y)<.9;
    controls.hidden=!visible;document.body.classList.toggle('reflection-near',visible||reader.open);if(!visible)return;
    const bounds=renderer.domElement.getBoundingClientRect(),hostBounds=host.getBoundingClientRect();
    BUTTONS.forEach((spec,i)=>{
     point.set((spec.x+spec.w/2)/W*20-10,(.5-(spec.y+spec.h/2)/H)*11.25,0);face.localToWorld(point);point.project(camera);
     const button=buttons[i];const fallback=Math.abs(point.x)>.8||Math.abs(point.y)>.8||bounds.width<600;
     button.hidden=entries.length<2||point.z<-1||point.z>1;button.classList.toggle('is-floating',fallback);
     button.style.left=`${fallback?bounds.width/2+(i===0?-116:116):bounds.left-hostBounds.left+(point.x+1)*bounds.width/2}px`;button.style.top=`${fallback?bounds.height-188:bounds.top-hostBounds.top+(1-point.y)*bounds.height/2}px`;
    });
    point.copy(position).project(camera);read.hidden=point.z<-1||point.z>1||Math.abs(point.x)>1.3;
    read.style.left=`${bounds.width/2}px`;read.style.top=`${bounds.width<600?bounds.height-188:Math.min(bounds.height-70,bounds.top-hostBounds.top+(1-point.y)*bounds.height/2+Math.min(300,bounds.height*.37))}px`;
   }};
  },
 };
}
