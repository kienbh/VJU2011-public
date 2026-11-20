import {tr} from '../i18n/index.ts';
import {emptyJournal,readJournal,addJournalTime,addJournalActivity,type Journal} from './journalModel';
import {PLACES} from './navigation';

const zones=[...PLACES.map(p=>({...p,r:p.id==='football'?32:p.id==='green'?22:['plaza','stage','flowers','plant'].includes(p.id)?14:10})),
 {id:'lake',name:tr('Bờ hồ cá koi'),x:150,z:-148,r:55},
 {id:'labs',name:tr('Khu phòng thí nghiệm'),x:115,z:-58,r:18},
 {id:'doms',name:tr('Khu DOM'),x:256,z:-20,r:75}];
export function journalArea(at:{x:number;z:number}){
 const found=zones.map(p=>({...p,d:Math.hypot(p.x-at.x,p.z-at.z)})).filter(p=>p.d<p.r).sort((a,b)=>a.d-b.d)[0];
 return found?.name||tr('Đường dạo campus');
}
export const JOURNAL_ACTIVITIES:Record<string,string>={football:tr('Sút bóng'),feed:tr('Cho cá ăn'),pick:tr('Nhặt rác'),sort:tr('Phân loại đúng'),green:tr('Hoàn thành vòng sân xanh'),tea:tr('Ngồi uống trà'),campfire:tr('Ngồi góc bếp nướng'),sakura:tr('Ngồi ngắm hoa'),lotus:tr('Ngồi bên ao sen'),library:tr('Ghé thư viện'),pet:tr('Chào chó, mèo')};
export function createJournal(owner:string,eligible:()=>boolean,area:()=>string){
 const key='vju2011-journal-v1:'+owner;
 let memory:Journal=emptyJournal(),durable=true,last:number|null=null,pending=false;
 function read(){try{return readJournal(localStorage.getItem(key),Date.now());}catch{durable=false;return memory;}}
 function update(change:(data:Journal)=>void){
  const apply=()=>{const data=durable?read():memory;change(data);memory=data;if(durable)try{localStorage.setItem(key,JSON.stringify(data));}catch{durable=false;}};
  // Serialise cross-tab read/modify/write; browsers without Web Locks retain in-tab history only.
  if(navigator.locks)return navigator.locks.request(key,apply);
  durable=false;apply();return Promise.resolve();
 }
 function allowed(){return eligible()&&!document.hidden&&document.hasFocus();}
 const reset=()=>{last=null;};document.addEventListener('visibilitychange',reset);window.addEventListener('blur',reset);window.addEventListener('pagehide',reset);
 return {
  tick(){
   const now=Date.now();if(!allowed()){last=null;return;}
   if(last===null){last=now;return;}if(now-last<1000||pending)return;
   const from=last,place=area();last=now;pending=true;
   void update(data=>{if(allowed())addJournalTime(data,from,now,place);}).finally(()=>{pending=false;});
  },
  record(activity:string){if(!JOURNAL_ACTIVITIES[activity])return;const now=Date.now(),place=area();void update(data=>addJournalActivity(data,now,activity,place));},
  snapshot(){return {data:durable?read():memory,durable};},
 };
}
