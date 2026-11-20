import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {createPresence} from './presence.mjs';
test('presence counts unique identities, handles tabs, expiry, private response, auth and origin',async()=>{
 let time=0;const route=createPresence({identity:async r=>r.user?{issuer:'test',subject:r.user}:null,now:()=>time,readJson:async r=>r.body,json:(r,status,data)=>Object.assign(r,{status,data}),fail:(status,code)=>{throw Object.assign(Error(code),{status});}});
 const call=async(user,body,origin=true)=>{const r={};try{await route({user,body,method:body?'POST':'GET',headers:origin?{origin:'http://test'}:{}},r,new URL('http://test/api/presence'));}catch(e){r.status=e.status;}return r;};
 const a=randomUUID(),b=randomUUID();assert.equal((await call(null)).status,401);assert.equal((await call('a',{action:'pulse',tab:a},false)).status,403);assert.equal((await call('a',{action:'pulse',tab:a})).data.online,1);assert.equal((await call('a',{action:'pulse',tab:b})).data.online,1);assert.equal((await call('b',{action:'pulse',tab:a})).data.online,2);
 assert.equal((await call('a',{action:'leave',tab:a})).data.online,2);assert.equal((await call('a',{action:'leave',tab:b})).data.online,1);time=45001;assert.deepEqual((await call('a')).data,{online:0,ttlSeconds:45});
});

function multiplayer(){
 let time=1000;const route=createPresence({identity:async r=>r.user?{issuer:'private-issuer',subject:r.user,name:r.user==='anon'?'DO-NOT-EXPOSE':'Name '+r.user,mode:r.user==='anon'?'anonymous':'sso'}:null,now:()=>time,readJson:async r=>r.body,json:(r,status,data)=>Object.assign(r,{status,data}),fail:(status,code)=>{throw Object.assign(Error(code),{status});}});
 const tabs=new Map(),seq=new Map();
 const pose={x:0,y:1.7,z:0,heading:0,state:'idle',groundSeat:false,appearance:{body:'male',hair:'short',outfit:'vju',palette:0}};
 const raw=async(user,body)=>{const r={};try{await route({user,body,method:body?'POST':'GET',headers:{origin:'http://test'}},r,new URL('http://test/api/presence'));}catch(e){r.status=e.status;}return r;};
 const pulse=(user,overrides={},extra={})=>{if(!tabs.has(user))tabs.set(user,randomUUID());seq.set(user,(seq.get(user)||0)+1);return raw(user,{tab:tabs.get(user),seq:seq.get(user),action:'pulse',pose:{...pose,...overrides},limit:6,...extra});};
 return {raw,pulse,pose,tabs,seq,advance:ms=>time+=ms};
}
test('multiplayer uses trusted names, opaque ids, nearby caps and one avatar per account',async()=>{
 const f=multiplayer();for(let i=0;i<20;i++)assert.equal((await f.pulse('u'+i,{x:i})).status,200);
 await f.pulse('far',{x:250});await f.pulse('anon',{x:1});
 let r=await f.pulse('viewer');assert.equal(r.data.online,23);assert.equal(r.data.peers.length,6);assert.equal(r.data.nearby,21);
 assert.ok(r.data.peers.some(p=>p.name==='Khách ẩn danh'));
 assert.ok(!JSON.stringify(r.data).includes('DO-NOT-EXPOSE'));assert.ok(!JSON.stringify(r.data).includes('private-issuer'));
 assert.ok(r.data.peers.every(p=>/^[a-f\d-]{36}$/.test(p.id)));assert.ok(!r.data.peers.some(p=>p.name==='Name viewer'||p.name==='Name far'));
 assert.equal((await f.pulse('viewer',{}, {limit:16})).data.peers.length,16);
 const duplicate=await f.pulse('u0',{x:2},{tab:randomUUID()});assert.equal(duplicate.data.online,23);
 assert.equal((await f.pulse('viewer')).data.peers.filter(p=>p.name==='Name u0').length,1);
 assert.equal((await f.pulse('viewer')).data.peers.find(p=>p.name==='Name u0').x,0,'presenting tab remains stable');
});
test('multiplayer validates poses, rejects spoofed names, leaves safely across out-of-order requests and expires ghosts',async()=>{
 const f=multiplayer();await f.pulse('a');await f.pulse('b',{state:'seated',groundSeat:true,y:1.4});
 let r=await f.pulse('a');assert.equal(r.data.peers[0].state,'seated');assert.equal(r.data.peers[0].groundSeat,true);
 for(const overrides of [{x:Infinity},{z:-10000},{y:null},{heading:999},{state:'fly'},{appearance:{palette:99}}]){f.advance(1000);assert.equal((await f.pulse('a',overrides)).status,400);}
 assert.equal((await f.pulse('a',{}, {name:'Spoof'})).status,400);
 await f.raw('b',{action:'leave',tab:f.tabs.get('b'),seq:50});
 r=await f.pulse('b',{}, {seq:49});assert.equal(r.data.online,1);assert.equal((await f.pulse('a')).data.peers.length,0);
 await f.pulse('b',{}, {seq:51});f.advance(6001);r=await f.pulse('a');assert.equal(r.data.peers.length,0);assert.equal(r.data.online,2);
 f.advance(45001);assert.deepEqual((await f.raw('a')).data,{online:0,ttlSeconds:45});
});
test('50 participants at four updates per second stay bounded; abusive single-tab bursts are rejected',async()=>{
 const f=multiplayer();let responses=0;
 for(let tick=0;tick<40;tick++){
  for(let i=0;i<50;i++){const r=await f.pulse('u'+i,{x:i+tick/10,state:'walking'});assert.equal(r.status,200);assert.ok(r.data.peers.length<=6);assert.equal(r.data.online,tick===0?i+1:50,`online after tick=${tick}, user=u${i}`);responses++;}
  f.advance(250);
  assert.equal((await f.raw('u0')).data.online,50,`online after tick=${tick}`);
 }
 assert.equal(responses,2000);assert.equal(f.tabs.size,50);
 assert.equal((await f.raw('u0')).data.online,50);
 assert.equal((await f.raw('observer-only')).data.online,50,'GET does not register an observer');
 const statuses=[];for(let i=0;i<12;i++)statuses.push((await f.pulse('abusive')).status);assert.ok(statuses.includes(429));
 assert.equal((await f.raw('u0')).data.online,51,'the separate rate-limit probe is the 51st identity, not a duplicate');
 assert.equal((await f.raw('abusive',{action:'leave',tab:f.tabs.get('abusive'),seq:100})).status,429);
 // The burst exhausted this tab's allowance; advance the injected clock before leaving.
 f.advance(1000);assert.equal((await f.raw('abusive',{action:'leave',tab:f.tabs.get('abusive'),seq:101})).status,200);
 assert.equal((await f.raw('u0')).data.online,50);
});

test('50 accounts updating concurrently through three tabs keep one place; GET is read-only and leave releases the final tab',async()=>{
 const f=multiplayer(),users=Array.from({length:50},(_,i)=>({name:'parallel-'+i,tabs:Array.from({length:3},()=>randomUUID())}));
 for(let tick=0;tick<8;tick++){
  const replies=await Promise.all(users.flatMap((u,i)=>u.tabs.map(tab=>f.raw(u.name,{action:'pulse',tab,seq:tick,pose:{...f.pose,x:i,state:'walking'},limit:6}))));
  assert.ok(replies.every(r=>r.status===200&&r.data.online<=50&&r.data.peers.length<=6));
  const reads=await Promise.all(Array.from({length:12},(_,i)=>f.raw('reader-'+i)));
  assert.ok(reads.every(r=>r.status===200&&r.data.online===50),`parallel count at tick=${tick}`);
  f.advance(250);
 }
 for(let tabIndex=0;tabIndex<3;tabIndex++){
  const replies=await Promise.all(users.map(u=>f.raw(u.name,{action:'leave',tab:u.tabs[tabIndex],seq:20})));
  assert.ok(replies.every(r=>r.status===200));
  assert.equal((await f.raw('observer-only')).data.online,tabIndex<2?50:0);
 }
});

test('nearby speech follows a trusted avatar, stays local, expires and cannot be revived by retry',async()=>{
 const f=multiplayer();await f.pulse('a');await f.pulse('b',{x:3});await f.pulse('far',{x:13});
 const id=randomUUID(),body={action:'say',tab:f.tabs.get('a'),id,text:'  Chào bạn! <b>Xin chào</b>  '};
 assert.equal((await f.raw('a',body)).status,200);
 let p=(await f.pulse('b',{x:3})).data.peers.find(p=>p.name==='Name a');assert.equal(p.speech.text,'Chào bạn! <b>Xin chào</b>');assert.equal(p.speech.remainingMs,10000);
 assert.equal((await f.pulse('far',{x:13})).data.peers.find(p=>p.name==='Name a').speech,null);
 f.advance(4000);assert.equal((await f.raw('a',body)).data.speech.remainingMs,6000,'retry does not extend lifetime');
 assert.equal((await f.raw('a',{...body,text:'changed'})).status,409);
 await f.pulse('a');f.advance(6001);await f.pulse('a');assert.equal((await f.raw('a',body)).data.speech,null,'expired retry cannot resurrect bubble');
 assert.equal((await f.pulse('b',{x:3})).data.peers.find(p=>p.name==='Name a').speech,null);
});

test('chat rejects absent/stale/nonpresenting tabs, spoofing and flood; leaving removes speech',async()=>{
 const f=multiplayer(),tab=randomUUID(),say=(text='hello',extra={})=>({action:'say',tab:f.tabs.get('a')||tab,id:randomUUID(),text,...extra});
 assert.equal((await f.raw('a',say())).status,409);await f.pulse('a');
 for(const body of [say(' '),say('x'.repeat(161)),say('ok',{name:'Spoof'}),say('ok',{pose:f.pose})])assert.equal((await f.raw('a',body)).status,400);
 await f.pulse('a',{}, {tab});assert.equal((await f.raw('a',say('other tab',{tab}))).status,409);
 assert.equal((await f.raw('a',say())).status,200);assert.equal((await f.raw('a',say())).status,429);
 await f.raw('a',{action:'leave',tab:f.tabs.get('a'),seq:20});assert.equal((await f.pulse('viewer')).data.peers.find(p=>p.name==='Name a').speech,null);
 assert.equal((await f.raw('a',say('flood through second tab',{tab}))).status,429);
 f.advance(6001);assert.equal((await f.raw('a',say('stale',{tab}))).status,409);
});
