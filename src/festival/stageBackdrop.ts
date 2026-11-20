import {roundedRectPath} from '../browserCompat';
import {tr,font} from '../i18n/index.ts';
import {breakUnits,joinUnits} from '../i18n/lineBreak.ts';
import * as THREE from 'three';

/** Three playlists. Each entry is [saying, source]; sources are the usual attributions,
 * given in Vietnamese translation. Review wording before public release. */
/** Three playlists. Each entry is [saying, source]; sources are the usual attributions,
 * given in Vietnamese translation. Review wording before public release. */
export const STAGE_MODES=[
  {id:'teacher',label:tr('Thầy trò 20/11'),sayings:[
    [tr('Tiên học lễ, hậu học văn'),''],[tr('Nhất tự vi sư, bán tự vi sư'),''],[tr('Tôn sư trọng đạo'),''],[tr('Uống nước nhớ nguồn'),''],
    [tr('Không thầy đố mày làm nên'),''],
  ]},
  {id:'east',label:tr('Triết học phương Đông'),sayings:[
    [tr('Học không biết chán, dạy người không biết mỏi'),tr('Khổng Tử')],[tr('Ôn cũ để biết mới'),tr('Khổng Tử')],
    [tr('Ba người cùng đi, ắt có người là thầy ta'),tr('Khổng Tử')],[tr('Biết thì nói là biết, không biết thì nói là không biết'),tr('Khổng Tử')],
    [tr('Hành trình ngàn dặm bắt đầu từ một bước chân'),tr('Lão Tử')],[tr('Học như thuyền ngược nước, không tiến ắt lùi'),tr('Cổ ngữ')],
  ]},
  {id:'west',label:tr('Triết học phương Tây'),sayings:[
    [tr('Tôi chỉ biết một điều là tôi không biết gì cả'),'Socrates'],[tr('Cuộc đời không tự xét lại thì không đáng sống'),'Socrates'],
    [tr('Rễ của học vấn thì đắng, quả của nó thì ngọt'),'Aristotle'],[tr('Tri thức là sức mạnh'),'Francis Bacon'],
    [tr('Tôi tư duy, vậy tôi tồn tại'),tr('René Descartes')],[tr('Hãy dám biết'),'Immanuel Kant'],
  ]},
] as const;
export const STAGE_SAYING_MS=10000;
const STORE='vju2011-stage-mode',FONT=font('"Segoe UI", Arial, sans-serif'),SAYING_SIZE=100;
// Tab strip on the canvas, in canvas fractions; the same numbers decide which tab a tap hits.
const TABS={top:.845,height:.115,left:.11,width:.78,gap:.012};

/** Fixed title; one saying at a time, each held 10 s. The three topic tabs are drawn on the
 * backdrop itself; `userData.select(uv)` switches topic from a tap and restarts the 10 s. */
/** Fixed title; one saying at a time, each held 10 s. The three topic tabs are drawn on the
 * backdrop itself; `userData.select(uv)` switches topic from a tap and restarts the 10 s. */
export function createStageBackdrop(){
  const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=778;
  const ctx=canvas.getContext('2d')!,w=canvas.width,h=canvas.height;
  ctx.textAlign='center';ctx.textBaseline='middle';
  function line(text:string,y:number,size:number,color:string,weight=700,x=w/2){
    ctx.font=`${weight} ${size}px ${FONT}`;ctx.fillStyle=color;ctx.fillText(text,x,y);
  }
  /** One size for every saying: long ones break into two lines (at a comma when there is one). */
  /** One size for every saying: long ones break into two lines (at a comma when there is one). */
  function saying(text:string,centre:number){
    ctx.font=`700 ${SAYING_SIZE}px ${FONT}`;
    const limit=w*.86;let lines=[text];
    if(ctx.measureText(text).width>limit){
      // Japanese sayings have no spaces: break units allow a break between characters (after 、 preferred).
      const units=breakUnits(text);let best=1,score=Infinity;
      for(let i=1;i<units.length;i++){
        const a=joinUnits(units.slice(0,i)),b=joinUnits(units.slice(i));
        const s=Math.abs(ctx.measureText(a).width-ctx.measureText(b).width)-(/[,、]$/.test(a)?w*.25:0);
        if(s<score){score=s;best=i;}
      }
      lines=[joinUnits(units.slice(0,best)),joinUnits(units.slice(best))];
    }
    const widest=Math.max(...lines.map(l=>ctx.measureText(l).width)),size=Math.min(SAYING_SIZE,SAYING_SIZE*limit/widest),step=size*1.28;
    lines.forEach((l,i)=>line(l,centre+(i-(lines.length-1)/2)*step,size,'#402d24'));
    return centre+(lines.length-1)/2*step+size*.5;
  }
  let mode=0;try{mode=Math.max(0,STAGE_MODES.findIndex(m=>m.id===localStorage.getItem(STORE)));}catch{/* optional */}
  let started=Date.now();
  function draw(index:number){
    const [text,source]=STAGE_MODES[mode].sayings[index];
    ctx.fillStyle='#f7e9cd';ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='#b59560';ctx.lineWidth=4;ctx.strokeRect(22,22,w-44,h-44);
    line(tr('Cảm ơn người gieo hạt'),h*.125,96,'#60362d');
    line('VJU · 20/11/2026',h*.235,48,'#67513d');
    ctx.strokeStyle='#c6aa77';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(w*.18,h*.3);ctx.lineTo(w*.82,h*.3);ctx.stroke();
    const bottom=saying(text,h*(source?.5:.545));
    if(source)line(`— ${source}`,Math.min(h*.79,bottom+52),54,'#6b4a3a',600);
    // Topic tabs: the active one is filled.
    const tabW=(w*TABS.width-(STAGE_MODES.length-1)*w*TABS.gap)/STAGE_MODES.length,y=h*TABS.top,th=h*TABS.height;
    STAGE_MODES.forEach((m,i)=>{
      const x=w*TABS.left+i*(tabW+w*TABS.gap),active=i===mode;
      ctx.beginPath();roundedRectPath(ctx,x,y,tabW,th,th/2);ctx.fillStyle=active?'#7b3b33':'#fff8e8';ctx.fill();ctx.strokeStyle='#9c7a4e';ctx.lineWidth=3;ctx.stroke();
      line(m.label,y+th/2+2,42,active?'#fff4dc':'#5c4636',600,x+tabW/2);
    });
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=8;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(15,5.7),new THREE.MeshBasicMaterial({map,fog:false,toneMapped:false}));
  let shown='';
  const refresh=()=>{
    const index=Math.floor(Math.max(0,Date.now()-started)/STAGE_SAYING_MS)%STAGE_MODES[mode].sayings.length,key=`${mode}:${index}`;
    if(key===shown)return;
    shown=key;draw(index);map.needsUpdate=true;mesh.userData.saying=STAGE_MODES[mode].sayings[index][0];mesh.userData.mode=STAGE_MODES[mode].id;
  };
  function setMode(next:number){
    mode=(next+STAGE_MODES.length)%STAGE_MODES.length;started=Date.now();
    try{localStorage.setItem(STORE,STAGE_MODES[mode].id);}catch{/* optional */}
    refresh();return STAGE_MODES[mode].label;
  }
  mesh.userData.nextMode=()=>setMode(mode+1);
  /** Tap on the backdrop: a tab selects that topic; anywhere else moves to the next topic. */
  /** Tap on the backdrop: a tab selects that topic; anywhere else moves to the next topic. */
  mesh.userData.select=(uv?:{x:number;y:number})=>{
    if(uv&&1-uv.y>=TABS.top-.02&&uv.x>=TABS.left&&uv.x<=TABS.left+TABS.width)return setMode(Math.min(STAGE_MODES.length-1,Math.floor((uv.x-TABS.left)/TABS.width*STAGE_MODES.length)));
    return setMode(mode+1);
  };
  refresh();mesh.onBeforeRender=refresh;
  mesh.name='stage-teacher-appreciation-backdrop';return mesh;
}
