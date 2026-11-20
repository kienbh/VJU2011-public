import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAppServer} from './app.mjs';
const ADMIN='trial-test-admin-token-'.repeat(3);
const card={recipientId:'general',message:'Cam on thay co da dong hanh cung chung em.',signature:'QA Name',className:'QA',visibility:'public',gift:'none'};
const pot={flowers:['lotus','rose'],signature:'QA Name',recipient:'Thay co VJU',message:card.message};
async function fixture(t,opts={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'vju-trial-'));let server,base;const jar={};
 const boot=async()=>{server=createAppServer({dbPath:path.join(dir,'db.sqlite'),adminToken:ADMIN,trialAccounts:true,seedSamples:false,publicOnly:true,logger:()=>{},...opts});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};await boot();
 const close=()=>new Promise(r=>server.close(r));t.after(async()=>{await close();assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('vju-trial-'));await rm(dir,{recursive:true,force:true});});
 const api=async(route,body,extra={})=>{
  const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Cookie:Object.entries(jar).map(([k,v])=>k+'='+v).join('; '),...(body?{'Content-Type':'application/json',Origin:base,'Idempotency-Key':randomUUID()}:{}),...extra},body:body?JSON.stringify(body):undefined});
  for(const line of r.headers.getSetCookie()){const [name,value]=line.split(';')[0].split('=');if(value)jar[name]=value;else delete jar[name];}
  return {status:r.status,data:await r.json(),cookies:r.headers.getSetCookie()};
 };
 return {api,jar,restart:async()=>{await close();await boot();}};
}
test('named and anonymous guests share persistent quota across rename/logout/restart and mixed submissions',async t=>{
 const f=await fixture(t);assert.equal((await f.api('/api/auth/session')).data.account,null);
 assert.equal((await f.api('/api/greetings',card)).status,401);
 const login=await f.api('/api/auth/guest',{mode:'guest',name:'QA Guest'});assert.equal(login.status,200);const id=login.data.account.id;
 assert.ok(login.cookies.every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Lax')));
 const key=randomUUID(),first=await f.api('/api/greetings',card,{'Idempotency-Key':key});assert.equal(first.status,201);
 assert.equal((await f.api('/api/greetings',card,{'Idempotency-Key':key})).data.duplicate,true);
 const sends=await Promise.all(Array.from({length:6},(_,i)=>f.api(i%2?'/api/garden/pots':'/api/greetings',i%2?pot:card)));
 assert.equal(sends.filter(x=>x.status===201).length,2);assert.equal(sends.filter(x=>x.data.code==='GARDEN_LIMIT').length,4);
 assert.equal((await f.api('/api/garden')).data.account.used,3);
 await f.api('/api/auth/logout',{});assert.equal((await f.api('/api/auth/session')).data.account,null);
 const renamed=await f.api('/api/auth/guest',{mode:'anonymous'});assert.equal(renamed.data.account.id,id);assert.equal(renamed.data.account.used,3);
 await f.restart();assert.equal((await f.api('/api/auth/session')).data.account.used,3);
 assert.equal((await f.api('/api/greetings',card)).data.code,'GARDEN_LIMIT');
});
test('anonymous signature and class are forced by server; moderation keeps content private until approved',async t=>{
 const f=await fixture(t);await f.api('/api/admin/settings',{autoApprove:false},{Authorization:'Bearer '+ADMIN});await f.api('/api/auth/guest',{mode:'anonymous',name:'NOT PUBLIC'});
 const a=await f.api('/api/greetings',card),b=await f.api('/api/garden/pots',pot);assert.equal(a.status,201);assert.equal(b.status,201);
 const mine=(await f.api('/api/garden')).data;assert.equal(mine.mine[0].signature,'Khách ẩn danh');
 assert.equal((await f.api('/api/greetings')).data.greetings.length,0);
 const admin=(await f.api('/api/admin/greetings',undefined,{Authorization:'Bearer '+ADMIN})).data.greetings;
 assert.equal(admin.length,2);for(const c of admin){assert.equal(c.signature,'Khách ẩn danh');assert.equal(c.className,'');}
 await f.api('/api/admin/greetings/'+a.data.id+'/moderate',{action:'approve'},{Authorization:'Bearer '+ADMIN});
 assert.equal((await f.api('/api/greetings')).data.greetings[0].signature,'Khách ẩn danh');
});
test('guest writes reject missing/cross-site Origin and forged identity, quota receipt is owner-bound',async t=>{
 const f=await fixture(t);assert.equal((await f.api('/api/auth/guest',{mode:'guest',name:'QA'},{Origin:''})).status,403);
 assert.equal((await f.api('/api/auth/guest',{mode:'guest',name:'QA'},{Origin:'https://evil.example'})).status,403);
 assert.equal((await f.api('/api/auth/guest',{mode:'guest',name:'  '})).status,400);
 assert.equal((await f.api('/api/auth/guest',{mode:'sso',name:'Fake'})).status,400);
 await f.api('/api/auth/guest',{mode:'guest',name:'First'});const key=randomUUID();await f.api('/api/greetings',card,{'Idempotency-Key':key});
 for(const k of Object.keys(f.jar))delete f.jar[k];await f.api('/api/auth/guest',{mode:'guest',name:'Second'});
 assert.equal((await f.api('/api/greetings',card,{'Idempotency-Key':key})).status,409);
 assert.equal((await f.api('/api/auth/logout',{},{Origin:''})).status,403);
 assert.equal((await f.api('/api/garden/pots',pot,{Origin:''})).status,403);
});
test('closed trial still permits visiting and account choice but neither write path',async t=>{
 const f=await fixture(t,{submissionsEnabled:false});await f.api('/api/auth/guest',{mode:'anonymous'});
 assert.equal((await f.api('/api/greetings',card)).data.code,'EVENT_CLOSED');assert.equal((await f.api('/api/garden/pots',pot)).data.code,'EVENT_CLOSED');
 assert.equal((await f.api('/api/auth/session')).data.account.used,0);
});

test('campus progress persists across guest rename and restart, isolates other guests and preserves gratitude quota',async t=>{
 const f=await fixture(t);await f.api('/api/auth/guest',{mode:'guest',name:'QA Campus'});
 const enter=()=>f.api('/api/campus',{action:'enter',tab:randomUUID(),seq:1,activity:0});await enter();
 const owner=(await f.api('/api/auth/session')).data.account.id;
 await f.api('/api/greetings',card);
 const run=(await f.api('/api/play/start',{kind:'green'})).data;
 const key=randomUUID(),event={run:run.id,action:'pick',item:0};
 assert.equal((await f.api('/api/play/event',event,{'Idempotency-Key':key})).status,200);
 await f.api('/api/play/profile',{favorites:['sakura','lotus'],decor:'none'});
 await f.api('/api/auth/guest',{mode:'anonymous'});await f.restart();
 await enter();
 const me=(await f.api('/api/auth/session')).data.account;assert.equal(me.id,owner);assert.equal(me.used,1);
 const replay=await f.api('/api/play/event',event,{'Idempotency-Key':key});assert.deepEqual(replay.data.state.picked,[0]);
 assert.deepEqual((await f.api('/api/play/progress')).data.profile.favorites,['sakura','lotus']);
 for(const k of Object.keys(f.jar))delete f.jar[k];await f.api('/api/auth/guest',{mode:'anonymous'});
 await enter();
 assert.equal((await f.api('/api/play/progress')).data.runs.length,0);
 assert.equal((await f.api('/api/play/event',{run:run.id,action:'finish'})).status,409);
});

test('campus feature switch leaves guest entry and gratitude available',async t=>{
 const f=await fixture(t,{playEnabled:false});await f.api('/api/auth/guest',{mode:'anonymous'});
 assert.equal((await f.api('/api/play/progress')).data.code,'PLAY_DISABLED');
 assert.equal((await f.api('/api/greetings',card)).status,201);
});
