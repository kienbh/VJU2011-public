// Single-process, ephemeral admission. Heartbeats never count as human activity.
export function createCampusAdmission({capacity=50,queueLimit=200,idleMs=300000,offerMs=60000,leaseMs=45000,now=Date.now,onRelease=()=>{}}={}){
 const people=new Map(),ended=new Map();
 function remove(owner,reason){const p=people.get(owner);if(!p)return;people.delete(owner);if(p.state==='admitted')onRelease(owner);for(const tab of p.tabs.keys())ended.set(owner+':'+tab,{reason,until:now()+600000});}
 function prune(){
  for(const [key,e] of ended)if(e.until<=now())ended.delete(key);
  for(const [owner,p] of people){
   if(p.state==='admitted'&&now()-p.activity>=idleMs){remove(owner,'idle');continue;}
   if(p.state==='offered'&&p.offerUntil<=now()){remove(owner,'missed');continue;}
   for(const [tab,t] of p.tabs)if(t.until<=now())p.tabs.delete(tab);
   if(!p.tabs.size)remove(owner,'disconnected');
  }
  let free=capacity-[...people.values()].filter(p=>p.state!=='queued').length;
  for(const p of people.values())if(free>0&&p.state==='queued'){p.state='offered';p.offerUntil=now()+offerMs;free--;}
 }
 function status(owner,tab){
  prune();const p=people.get(owner),base={capacity,online:[...people.values()].filter(p=>p.state==='admitted').length,queued:[...people.values()].filter(p=>p.state==='queued').length};
  if(!p?.tabs.has(tab))return {...base,state:'outside',reason:ended.get(owner+':'+tab)?.reason||'missing'};
  const queue=[...people.entries()].filter(([,v])=>v.state==='queued');
  return {...base,state:p.state,position:p.state==='queued'?queue.findIndex(([id])=>id===owner)+1:0,offerSeconds:p.state==='offered'?Math.max(0,Math.ceil((p.offerUntil-now())/1000)):0,idleSeconds:p.state==='admitted'?Math.max(0,Math.ceil((idleMs-(now()-p.activity))/1000)):null,warnAfterSeconds:Math.max(0,(idleMs-60000)/1000)};
 }
 function enter(owner,tab,activity=0){
  prune();let p=people.get(owner);
  if(!p){
   const busy=[...people.values()].filter(p=>p.state!=='queued').length;
   if(busy>=capacity&&[...people.values()].filter(p=>p.state==='queued').length>=queueLimit)return {...status(owner,tab),reason:'full'};
   p={state:busy<capacity?'admitted':'queued',tabs:new Map(),activity:now(),offerUntil:0};people.set(owner,p);
  }
  if(!p.tabs.has(tab)&&p.tabs.size>=12)return {...status(owner,tab),reason:'tabs'};
  ended.delete(owner+':'+tab);p.tabs.set(tab,{until:now()+leaseMs,activity});
  if(p.state==='offered'){p.state='admitted';p.activity=now();}
  return status(owner,tab);
 }
 function pulse(owner,tab,activity){
  prune();const p=people.get(owner),t=p?.tabs.get(tab);
  if(t){t.until=now()+leaseMs;if(Number.isSafeInteger(activity)&&activity>t.activity){t.activity=activity;if(p.state==='admitted')p.activity=now();}}
  return status(owner,tab);
 }
 function poll(owner,tab){prune();const p=people.get(owner);if(p&&p.state!=='admitted'&&p.tabs.has(tab))p.tabs.get(tab).until=now()+leaseMs;return status(owner,tab);}
 function leave(owner,tab){prune();const p=people.get(owner);if(p){if(tab){p.tabs.delete(tab);ended.set(owner+':'+tab,{reason:'left',until:now()+600000});if(!p.tabs.size)remove(owner,'left');}else remove(owner,'left');}prune();return status(owner,tab);}
 return {enter,pulse,poll,leave,status,prune,has(owner,tab){prune();const p=people.get(owner);return p?.state==='admitted'&&(!tab||p.tabs.has(tab));},count(){prune();return [...people.values()].filter(p=>p.state==='admitted').length;}};
}

export function campusRoute(admission,{identity,json,readJson,fail}){
 const sequences=new Map();
 return async(req,res,url)=>{
  if(url.pathname!=='/api/campus')return false;
  const u=await identity(req);if(!u)fail(401,'SIGN_IN_REQUIRED','Chọn cách tham gia trước.');
  const {participantOwner}=await import('./participants.mjs');const owner=participantOwner(u);
  const b=req.method==='GET'?{tab:url.searchParams.get('tab')}:await readJson(req);
  if(typeof b.tab!=='string'||!/^[-\da-f]{36}$/i.test(b.tab))fail(400,'TAB','Phiên campus không hợp lệ.');
  let result;
  if(req.method==='GET')result=admission.poll(owner,b.tab);
  else{
   if(req.method!=='POST')fail(405,'METHOD','Phương thức không hợp lệ.');
   if(!req.headers.origin)fail(403,'ORIGIN_REQUIRED','Thiếu nguồn yêu cầu.');
   if(!['enter','pulse','leave'].includes(b.action)||!Number.isSafeInteger(b.seq)||b.seq<0||!Number.isSafeInteger(b.activity)||b.activity<0)fail(400,'CAMPUS','Thao tác campus không hợp lệ.');
   const key=owner+':'+b.tab,previous=sequences.get(key);
   for(const [k,s] of sequences)if(s.until<Date.now())sequences.delete(k);
   if(previous&&previous.seq>=b.seq)result=admission.status(owner,b.tab);
   else{sequences.set(key,{seq:b.seq,until:Date.now()+600000});result=admission[b.action](owner,b.tab,b.activity);}
  }
  json(res,200,result);return true;
 };
}
