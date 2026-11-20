export type Visit={area:string;at:number;ms:number;end:number};
export type JournalDay={areas:Record<string,number>;activities:Record<string,number>;events:{activity:string;area:string;at:number}[];visits:Visit[]};
export type Journal={version:1;until:number;days:Record<string,JournalDay>};
export const emptyJournal=():Journal=>({version:1,until:0,days:{}});
const DAY=86400000,OFFSET=7*3600000;
export const journalDate=(time:number)=>new Date(time+OFFSET).toISOString().slice(0,10);
function day(data:Journal,time:number){const id=journalDate(time);return data.days[id]??= {areas:{},activities:{},events:[],visits:[]};}
export function pruneJournal(data:Journal,now:number){
 const oldest=journalDate(now-6*DAY),today=journalDate(now);
 for(const id of Object.keys(data.days))if(id<oldest||id>today)delete data.days[id];
}
/** Count a short observed interval once, even if two tabs report overlapping time. */
export function addJournalTime(data:Journal,from:number,to:number,area:string){
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>3000)return;
 let start=Math.max(from,data.until);if(start>=to)return;
 while(start<to){
  const end=Math.min(to,(Math.floor((start+OFFSET)/DAY)+1)*DAY-OFFSET),d=day(data,start),ms=end-start;
  d.areas[area]=(d.areas[area]||0)+ms;
  const last=d.visits.at(-1);
  if(last?.area===area&&start-last.end<=3000){last.ms+=ms;last.end=end;}
  else d.visits.push({area,at:start,ms,end});
  d.visits=d.visits.slice(-40);start=end;
 }
 data.until=to;pruneJournal(data,to);
}
export function addJournalActivity(data:Journal,at:number,activity:string,area:string){
 const d=day(data,at);d.activities[activity]=(d.activities[activity]||0)+1;
 d.events.push({activity,area,at});d.events=d.events.slice(-40);pruneJournal(data,at);
}
export function readJournal(raw:string|null,now:number):Journal{
 try{
  if(!raw||raw.length>150000)return emptyJournal();
  const data=JSON.parse(raw) as Journal;
  if(data.version!==1||!Number.isFinite(data.until)||!data.days||Array.isArray(data.days))return emptyJournal();
  for(const [id,d]of Object.entries(data.days)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(id)||!d||!d.areas||!d.activities||!Array.isArray(d.events)||!Array.isArray(d.visits))return emptyJournal();
   for(const values of [d.areas,d.activities])if(Object.keys(values).length>100||Object.values(values).some(v=>!Number.isFinite(v)||v<0))return emptyJournal();
   if(d.events.some(e=>typeof e.activity!=='string'||typeof e.area!=='string'||!Number.isFinite(e.at))||d.visits.some(v=>typeof v.area!=='string'||![v.at,v.end,v.ms].every(Number.isFinite)||v.ms<0))return emptyJournal();
   d.events=d.events.slice(-40);d.visits=d.visits.slice(-40);
  }
  if(data.until>now)data.until=now;
  pruneJournal(data,now);return data;
 }catch{return emptyJournal();}
}
export function journalDuration(ms:number){
 const sec=Math.floor(ms/1000);if(sec<60)return `${sec} giây`;
 const min=Math.floor(sec/60);return min<60?`${min} phút ${sec%60} giây`:`${Math.floor(min/60)} giờ ${min%60} phút`;
}
