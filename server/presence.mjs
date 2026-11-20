import {createFootballWorld,FOOTBALL} from './footballWorld.mjs';
import {randomUUID} from 'node:crypto';
import {participantOwner} from './participants.mjs';
export function createPresence({identity,json,readJson,fail,now=Date.now,admission}){
 const football=createFootballWorld(),shots=new Map();
 const owners=new Map(),sequences=new Map(),speechLimits=new Map();
 const CHAT_RADIUS=12,CHAT_LIFETIME=10000;
 function presenting(p){
  let s=p?.tabs.get(p.presenter);if(!s?.pose||now()-s.updated>=6000){const next=p&&[...p.tabs.entries()].find(([,s])=>s.pose&&now()-s.updated<6000);if(p)p.presenter=next?.[0];s=next?.[1];}return s;
 }
 const speech=p=>p?.speech&&p.speech.until>now()&&p.speech.tab===p.presenter?{id:p.speech.id,text:p.speech.text,remainingMs:p.speech.until-now()}:null;
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 function pose(value){
  if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['x','y','z','heading','state','groundSeat','appearance'].includes(k))||!finite(value.x,-110,310)||!finite(value.z,-230,85)||!finite(value.y,-2,30)||!finite(value.heading,-Math.PI*2,Math.PI*2)||!['idle','walking','seated'].includes(value.state)||typeof value.groundSeat!=='boolean')fail(400,'POSE','Vị trí campus không hợp lệ.');
  const a=value.appearance;
  if(!a||!['male','female'].includes(a.body)||!['short','bob','ponytail'].includes(a.hair)||!['casual','polo','vju'].includes(a.outfit)||!Number.isInteger(a.palette)||a.palette<0||a.palette>2)fail(400,'APPEARANCE','Nhân vật không hợp lệ.');
  return {x:value.x,y:value.y,z:value.z,heading:value.heading,state:value.state,groundSeat:value.state==='seated'&&value.groundSeat,appearance:{body:a.body,hair:a.hair,outfit:a.outfit,palette:a.palette}};
 }
 function ballPlayers(){return [...owners.values()].flatMap(p=>{const s=p.tabs.get(p.presenter);return s?.pose?[{id:p.id,...s.pose,updated:s.updated}]:[];});}
 function prune(){for(const [key,time] of shots)if(now()-time>30000)shots.delete(key);for(const [owner,p] of owners){for(const [tab,s] of p.tabs)if(s.until<=now()||(admission&&!admission.has(owner,tab)))p.tabs.delete(tab);if(p.speech?.until<=now())p.speech=null;if(!p.tabs.size)owners.delete(owner);}for(const [key,s] of sequences)if(s.until<=now())sequences.delete(key);for(const [key,s] of speechLimits)if(now()-s.time>60000)speechLimits.delete(key);}
 return async(req,res,url)=>{
  if(url.pathname!=='/api/presence')return false;
  const u=await identity(req);if(!u)fail(401,'SIGN_IN_REQUIRED','Chọn cách tham gia trước.');football.advance(now(),ballPlayers());prune();
  const owner=participantOwner(u);let view=null,limit=6,viewTab=null;
  if(req.method==='POST'){
   if(!req.headers.origin)fail(403,'ORIGIN_REQUIRED','Thiếu nguồn yêu cầu.');const b=await readJson(req);
   if(b.action==='footballKick'){
    if(Object.keys(b).some(k=>!['action','tab','id','seq','pose'].includes(k))||typeof b.tab!=='string'||!/^[-\da-f]{36}$/i.test(b.tab)||typeof b.id!=='string'||!/^[-\da-f]{36}$/i.test(b.id)||!Number.isSafeInteger(b.seq)||b.seq<0)fail(400,'FOOTBALL_INPUT','Cú sút không hợp lệ.');
    const p=owners.get(owner),current=presenting(p);
    if(!current||p.presenter!==b.tab)fail(409,'FOOTBALL_TAB','Hãy sút ở tab đang điều khiển nhân vật.');
    const shotKey=owner+':'+b.id;
    if(shots.has(shotKey)){json(res,200,{football:football.snapshot(),self:p.id,accepted:true});return true;}
    const nextPose=pose(b.pose),key=owner+':'+b.tab,prior=sequences.get(key);
    if(prior&&b.seq<=prior.seq)fail(409,'FOOTBALL_STALE','Vị trí vừa thay đổi. Hãy thử sút lại.');
    if(prior&&now()-prior.start<1000&&prior.count>=8)fail(429,'PRESENCE_RATE','Thao tác quá nhanh. Hãy thử lại.');
    if(!football.kick({id:p.id,...nextPose},now(),b.id))fail(409,'FOOTBALL_NOT_READY','Đứng gần bóng và chờ bóng sẵn sàng để sút.');
    const same=prior&&now()-prior.start<1000;sequences.set(key,{seq:b.seq,start:same?prior.start:now(),count:same?prior.count+1:1,until:now()+45000});
    current.pose=nextPose;current.updated=now();current.until=now()+45000;shots.set(shotKey,now());
    json(res,200,{football:football.snapshot(),self:p.id,accepted:true});return true;
   }
   if(b.action==='say'){
    if(Object.keys(b).some(k=>!['action','tab','id','text'].includes(k))||typeof b.tab!=='string'||typeof b.id!=='string'||!/^[-\da-f]{36}$/i.test(b.id)||typeof b.text!=='string')fail(400,'CHAT','Tin nhắn không hợp lệ.');
    const text=b.text.normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim();
    if(!text||text.length>160)fail(400,'CHAT_LENGTH','Nhập từ 1 đến 160 ký tự.');
    const p=owners.get(owner),s=presenting(p);if(!s||p.presenter!==b.tab)fail(409,'CHAT_NOT_PRESENT','Hãy trò chuyện ở tab đang điều khiển nhân vật.');
    const prior=speechLimits.get(owner);
    if(prior?.id===b.id){if(prior.text!==text)fail(409,'CHAT_ID','Tin nhắn đã thay đổi.');json(res,200,{speech:speech(p)});return true;}
    if(prior&&now()-prior.time<3000)fail(429,'CHAT_RATE','Chờ 3 giây trước khi gửi tiếp.');
    speechLimits.set(owner,{id:b.id,text,time:now()});p.speech={id:b.id,text,until:now()+CHAT_LIFETIME,tab:b.tab};
    json(res,200,{speech:speech(p)});return true;
   }
   if(typeof b.tab!=='string'||!/^[-\da-f]{36}$/i.test(b.tab)||!['pulse','leave'].includes(b.action)||Object.keys(b).some(k=>!['tab','action','seq','pose','limit'].includes(k)))fail(400,'PRESENCE','Phiên campus không hợp lệ.');
   if(b.action==='pulse'&&admission&&!admission.has(owner,b.tab))fail(409,'CAMPUS_REQUIRED','Campus admission required.');
   if(b.pose!==undefined){view=pose(b.pose);viewTab=b.tab;if(![6,16].includes(b.limit))fail(400,'LIMIT','Giới hạn hiển thị không hợp lệ.');limit=b.limit;}
   const key=owner+':'+b.tab,prior=sequences.get(key);
   if(b.seq!==undefined&&(!Number.isSafeInteger(b.seq)||b.seq<0))fail(400,'SEQUENCE','Phiên campus không hợp lệ.');
   const stale=b.seq!==undefined&&prior&&b.seq<=prior.seq;
   if(!stale){
    const start=prior&&now()-prior.start<1000?prior.start:now(),count=prior&&start===prior.start?prior.count+1:1;
    if(count>8)fail(429,'PRESENCE_RATE','Cập nhật quá nhanh.');
    sequences.set(key,{seq:b.seq??-1,start,count,until:now()+45000});
    let p=owners.get(owner);
    if(b.action==='leave'){p?.tabs.delete(b.tab);if(p&&!p.tabs.size)owners.delete(owner);}
    else{
     if(!p){if(owners.size>=1000)fail(503,'CAMPUS_FULL','Campus đang đông, vui lòng thử lại.');p={id:randomUUID(),tabs:new Map(),name:''};owners.set(owner,p);}
     p.name=u.mode==='anonymous'?'Khách ẩn danh':String(u.name||'Sinh viên VJU').normalize('NFC').replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,40);
     if(!p.tabs.has(b.tab)&&p.tabs.size>=12)p.tabs.delete(p.tabs.keys().next().value);
     p.tabs.set(b.tab,{until:now()+45000,updated:now(),pose:view});
     presenting(p);
    }
   }
  }else if(req.method!=='GET')fail(405,'METHOD','Phương thức không hợp lệ.');
  const result={online:admission?admission.count():owners.size,ttlSeconds:45};
  if(view){
   const candidates=[];
   for(const [id,p] of owners){if(id===owner)continue;
    // Keep one presenting tab stable; don't make an account jump between two open windows.
    const s=presenting(p);if(!s)continue;
    const distance=(s.pose.x-view.x)**2+(s.pose.z-view.z)**2;if(distance>80**2)continue;candidates.push({id:p.id,name:p.name,...s.pose,speech:distance<=CHAT_RADIUS**2?speech(p):null,distance});}
   candidates.sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
   const self=owners.get(owner);
   if(Math.hypot(view.x-FOOTBALL.x,view.z-FOOTBALL.z)<90)result.football=football.snapshot();
   Object.assign(result,{self:self?.id??null,selfSpeech:self?.presenter===viewTab?speech(self):null,nearby:candidates.length,limit,peers:candidates.slice(0,limit).map(({distance,...p})=>p)});
  }
  json(res,200,result);return true;
 };
}
