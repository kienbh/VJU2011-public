import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {createPlay,RUBBISH} from './play.mjs';
import {greenItems,greenUnlockSeconds} from './greenRules.mjs';
function fixture(t){const db=new DatabaseSync(':memory:');let time=100000;const route=createPlay(db,{identity:async r=>r.user?{issuer:'qa',subject:r.user}:null,now:()=>time,readJson:async r=>r.body,json:(r,status,body)=>Object.assign(r,{status,body}),fail:(status,code)=>{throw Object.assign(Error(code),{status,code});},admin:r=>{if(!r.admin)throw Error('UNAUTHORIZED');}});t.after(()=>db.close());
 return {db,advance:n=>time+=n,async api(path,body,{user='a',key=randomUUID(),admin=false,origin=true}={}){const res={};try{await route({user,admin,method:body?'POST':'GET',headers:{'idempotency-key':key,...(origin?{origin:'http://test'}:{})},body},res,new URL('http://test/api/play/'+path));}catch(e){return {status:e.status||401,code:e.code||e.message};}return res;}};}
test('play authentication, write origin, drafts hidden and no automatic publish',async t=>{const f=fixture(t);assert.equal((await f.api('progress',null,{user:null})).status,401);assert.equal((await f.api('start',{kind:'green',version:2},{origin:false})).status,403);assert.equal((await f.api('progress')).body.content.length,0);assert.equal((await f.api('admin/content')).status,401);assert.equal((await f.api('admin/content',null,{admin:true})).body.items.length,12);});
test('garbage capacity, unlock timing, incorrect sorting and replay',async t=>{const f=fixture(t),r=(await f.api('start',{kind:'green',version:2})).body;
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:12})).code,'EARLY');f.advance(100000);
 for(let i=0;i<6;i++)assert.equal((await f.api('event',{run:r.id,action:'pick',item:i})).status,200);
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:6})).code,'BAG_FULL');
 const key=randomUUID(),b={run:r.id,action:'sort',item:0,bin:RUBBISH[greenItems(r.state)[0]].bin==='recycle'?'organic':'recycle'},wrong=await f.api('event',b,{key});assert.equal(wrong.body.state.mistakes,1);assert.deepEqual((await f.api('event',b,{key})).body,wrong.body);
 assert.equal((await f.api('event',{...b,bin:RUBBISH[greenItems(r.state)[0]].bin},{key})).code,'REPLAY_CONFLICT');
 for(let i=0;i<6;i++)await f.api('event',{run:r.id,action:'sort',item:i,bin:RUBBISH[greenItems(r.state)[i]].bin});
 const p=(await f.api('progress')).body;assert.deepEqual(p.collection.map(i=>i.item),['green-first']);assert.equal(p.community,1);
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:6},{user:'b'})).code,'EXPIRED');assert.equal((await f.api('progress',null,{user:'b'})).body.collection.length,0);
});
test('perfect sorting awards once; locked decorations cannot be forged',async t=>{const f=fixture(t);assert.equal((await f.api('profile',{favorites:[],decor:'pot'})).code,'LOCKED');const r=(await f.api('start',{kind:'green',version:2})).body;f.advance(100000);for(let i=0;i<6;i++){await f.api('event',{run:r.id,action:'pick',item:i});await f.api('event',{run:r.id,action:'sort',item:i,bin:RUBBISH[greenItems(r.state)[i]].bin});}assert.equal((await f.api('progress')).body.collection.length,2);assert.equal((await f.api('profile',{favorites:['sakura'],decor:'pot'})).status,200);assert.deepEqual((await f.api('progress')).body.profile,{favorites:['sakura'],decor:'pot'});});
test('fishing rejects early catch; assisted reeling and same request never duplicate catch',async t=>{const f=fixture(t),r=(await f.api('start',{kind:'fish'})).body;await f.api('event',{run:r.id,action:'cast'});const early=(await f.api('event',{run:r.id,action:'reel',assisted:true})).body;assert.equal(early.state.success,false);await f.api('event',{run:r.id,action:'cast'});f.advance(10000);const key=randomUUID(),b={run:r.id,action:'reel',assisted:true};const a=await f.api('event',b,{key});assert.equal(a.body.state.caught,1);assert.deepEqual((await f.api('event',b,{key})).body,a.body);assert.equal((await f.api('progress')).body.collection.length,1);});
test('single active run resumes; completed and expired runs cannot award',async t=>{const f=fixture(t),r=(await f.api('start',{kind:'green',version:2})).body;assert.equal((await f.api('start',{kind:'green',version:2})).body.id,r.id);await f.api('event',{run:r.id,action:'finish'});assert.equal((await f.api('event',{run:r.id,action:'pick',item:0})).code,'FINISHED');const next=(await f.api('start',{kind:'green',version:2})).body;assert.notEqual(next.id,r.id);f.advance(1800001);assert.equal((await f.api('event',{run:next.id,action:'pick',item:0})).code,'EXPIRED');});
test('content requires explicit admin review and complete attribution',async t=>{const f=fixture(t);const data={text:'Demo',meaning:'Demo',type:'Diễn giải',source:'',example:'Demo',action:'Demo'};assert.equal((await f.api('admin/content',{id:'step',data,status:'approved'},{admin:true})).code,'CONTENT');data.source='QA source';assert.equal((await f.api('admin/content',{id:'step',data,status:'approved'},{admin:true})).status,200);assert.equal((await f.api('progress')).body.content.length,1);});
test('football caps five shots and score is computed against server targets',async t=>{const f=fixture(t),r=(await f.api('start',{kind:'football'})).body;for(const aim of [.25,.7,.45,.8,.3]){f.advance(5000);await f.api('event',{run:r.id,action:'shot',aim});}assert.equal((await f.api('progress')).body.collection[0].item,'football-5');assert.equal((await f.api('event',{run:r.id,action:'shot',aim:.3})).code,'FINISHED');});

test('green v2 has 24 varied items, stable shuffle, timing, completion and no duplicate reward',async t=>{
 const f=fixture(t),r=(await f.api('start',{kind:'green',version:2})).body,ids=greenItems(r.state);
 assert.equal(r.state.version,2);assert.equal(ids.length,24);assert.equal(new Set(ids).size,12);
 assert.deepEqual(greenItems((await f.api('start',{kind:'green',version:2})).body.state),ids);
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:24})).code,'ITEM');
 for(let i=0;i<12;i++){
  assert.equal((await f.api('event',{run:r.id,action:'pick',item:i})).status,200);
  assert.equal((await f.api('event',{run:r.id,action:'sort',item:i,bin:RUBBISH[ids[i]].bin})).body.state.sorted.length,i+1);
 }
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:12})).code,'EARLY');
 f.advance(3999);assert.equal((await f.api('event',{run:r.id,action:'pick',item:12})).code,'EARLY');f.advance(1);
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:12})).status,200);
 await f.api('event',{run:r.id,action:'sort',item:12,bin:RUBBISH[ids[12]].bin});f.advance(100000);
 for(let i=13;i<24;i++){await f.api('event',{run:r.id,action:'pick',item:i});const result=await f.api('event',{run:r.id,action:'sort',item:i,bin:RUBBISH[ids[i]].bin});assert.equal(result.body.state.sorted.length,i+1);assert.equal(result.body.state.done,i===23);}
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:0})).code,'FINISHED');
 assert.deepEqual((await f.api('progress')).body.collection.map(i=>i.item),['green-first','green-perfect']);
 const next=(await f.api('start',{kind:'green',version:2})).body;assert.notEqual(next.id,r.id);assert.notDeepEqual(greenItems(next.state),ids);
});
test('pre-release green runs keep their 12 items, original meanings and unlock schedule',async t=>{
 const f=fixture(t),r=(await f.api('start',{kind:'green',version:2})).body;
 const legacy={picked:[0],sorted:[],mistakes:0,done:false};f.db.prepare('UPDATE play_runs SET state=? WHERE id=?').run(JSON.stringify(legacy),r.id);
 assert.deepEqual(greenItems(legacy),[0,1,2,3,4,5,0,1,2,3,4,5]);assert.equal(greenUnlockSeconds(legacy,3),10);
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:3})).code,'EARLY');
 assert.equal((await f.api('event',{run:r.id,action:'pick',item:12})).code,'ITEM');
 const sorted=await f.api('event',{run:r.id,action:'sort',item:0,bin:'organic'});assert.equal(sorted.body.state.sorted.length,1);
 f.advance(100000);for(let i=1;i<12;i++){await f.api('event',{run:r.id,action:'pick',item:i});await f.api('event',{run:r.id,action:'sort',item:i,bin:RUBBISH[i%6].bin});}
 assert.equal((await f.api('progress')).body.runs[0].state.done,true);
});

test('cached old client starts a legacy run until refreshed',async t=>{const f=fixture(t),r=(await f.api('start',{kind:'green'})).body;assert.equal(r.state.version,undefined);assert.equal(greenItems(r.state).length,12);assert.equal((await f.api('event',{run:r.id,action:'pick',item:3})).code,'EARLY');});
