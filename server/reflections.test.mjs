import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createAppServer} from './app.mjs';
import {vietnamDate} from './reflections.mjs';
const TOKEN='reflection-test-only-token-'.repeat(3);
const content=(extra={})=>({topic:'Nghề thầy',content:'Nội dung hư cấu chỉ dùng trong kiểm thử.',author:'Tác giả kiểm thử',sourceBook:'Tài liệu kiểm thử',sourceReference:'Nguồn giả lập trong bộ test, không xuất bản thật.',sourceUrl:'',sourcePages:'12',attributionNote:'Diễn giải, không phải nguyên văn.',quoteType:'paraphrase',question:'Một câu hỏi dùng trong kiểm thử?',sourceVerified:true,contentOrigin:'ai_assisted',displayDate:vietnamDate(),...extra});
async function fixture(t){
 const dir=await mkdtemp(path.join(os.tmpdir(),'vju-reflections-')),dbPath=path.join(dir,'test.sqlite');let server,base;
 async function boot(){server=createAppServer({dbPath,adminToken:TOKEN,seedSamples:false,submissionsEnabled:false,logger:()=>{}});await new Promise(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${server.address().port}`;}
 const close=()=>new Promise(r=>server.close(r));await boot();
 t.after(async()=>{await close();assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('vju-reflections-'));await rm(dir,{recursive:true,force:true});});
 async function api(route,body,auth=true,headers={}){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(auth?{Authorization:`Bearer ${TOKEN}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 async function create(extra){const r=await api('/api/admin/reflections',content(extra));assert.equal(r.status,201);return r.data.reflection;}
 async function act(row,action){return api(`/api/admin/reflections/${row.id}/action`,{revision:row.revision,action});}
 async function publish(extra){let row=await create(extra);for(const action of ['submit','approve','publish']){const r=await act(row,action);assert.equal(r.status,200,JSON.stringify(r.data));row=r.data.reflection;}return row;}
 return {api,create,act,publish,dbPath,restart:async()=>{await close();await boot();}};
}
test('reflection demo remains a single unverified paraphrase draft across restarts',async t=>{
 const f=await fixture(t);let rows=(await f.api('/api/admin/reflections')).data.items;assert.equal(rows.length,1);assert.equal(rows[0].quoteType,'paraphrase');assert.equal(rows[0].status,'draft');assert.equal(rows[0].sourceVerified,false);assert.equal(rows[0].sourceBook,'');
 assert.equal((await f.api('/api/reflections/today',null,false)).data.reflection,null);assert.equal((await f.api('/api/reflections/library',null,false)).data.total,0);assert.equal((await f.api('/api/reflections/'+rows[0].id,null,false)).status,404);
 await f.restart();rows=(await f.api('/api/admin/reflections')).data.items;assert.equal(rows.length,1);
});
test('CMS reads and writes require authentication and same-origin protection',async t=>{
 const f=await fixture(t);assert.equal((await f.api('/api/admin/reflections',null,false)).status,401);assert.equal((await f.api('/api/admin/reflections',content(),false)).status,401);
 const row=await f.create();for(const route of [`/api/admin/reflections/${row.id}`,`/api/admin/reflections/${row.id}/action`])assert.equal((await f.api(route,{revision:1,action:'publish'},false)).status,401);
 assert.equal((await f.api('/api/admin/reflections',content(),true,{Origin:'https://attacker.example'})).status,403);
});
test('AI-assisted content cannot bypass explicit submit, approval and publication',async t=>{
 const f=await fixture(t);assert.equal((await f.api('/api/admin/reflections',{...content(),status:'published'})).status,400);let row=await f.create();
 assert.equal((await f.act(row,'publish')).status,409);row=(await f.act(row,'submit')).data.reflection;assert.equal((await f.act(row,'publish')).status,409);row=(await f.act(row,'approve')).data.reflection;assert.equal((await f.api('/api/reflections/today')).data.reflection,null);
 row=(await f.act(row,'publish')).data.reflection;assert.equal((await f.api('/api/reflections/today')).data.reflection.id,row.id);
 const db=new DatabaseSync(f.dbPath);try{assert.deepEqual(db.prepare('SELECT action FROM reflection_history WHERE reflection_id=? ORDER BY id').all(row.id).map(r=>r.action),['create','submit','approve','publish']);}finally{db.close();}
});
test('source verification is required; verbatim also requires a book and page locator',async t=>{
 const f=await fixture(t);for(const extra of [{sourceVerified:false},{sourceBook:'',sourceReference:''},{quoteType:'verbatim',sourcePages:''},{quoteType:'verbatim',sourceBook:''}]){
  const row=(await f.act(await f.create(extra),'submit')).data.reflection;assert.equal((await f.act(row,'approve')).status,400);
 }
 assert.equal((await f.api('/api/admin/reflections',content({sourceUrl:'javascript:alert(1)'}))).status,400);
 assert.equal((await f.api('/api/admin/reflections',content({displayDate:'2026-02-30'}))).status,400);
});
test('editing published content withdraws it and invalidates approval; stale revisions cannot overwrite',async t=>{
 const f=await fixture(t),row=await f.publish();const edit=await f.api(`/api/admin/reflections/${row.id}`,{...content({content:'Bản sửa cần duyệt lại.'}),revision:row.revision});assert.equal(edit.status,200);assert.equal(edit.data.reflection.status,'draft');assert.equal(edit.data.reflection.approvedAt,null);assert.equal((await f.api('/api/reflections/today')).data.reflection,null);
 assert.equal((await f.api(`/api/admin/reflections/${row.id}`,{...content(),revision:row.revision})).status,409);assert.equal((await f.act(edit.data.reflection,'publish')).status,409);
});
test('only one published item per date; archiving releases its slot',async t=>{
 const f=await fixture(t),first=await f.publish();let second=await f.create();for(const a of ['submit','approve'])second=(await f.act(second,a)).data.reflection;
 assert.equal((await f.act(second,'publish')).status,409);assert.equal((await f.act(first,'archive')).status,200);assert.equal((await f.act(second,'publish')).status,200);assert.equal((await f.api('/api/reflections/'+first.id)).status,404);
});
test('today and library respect Vietnam dates and hide future scheduled content',async t=>{
 const f=await fixture(t),today=vietnamDate(),shift=n=>new Date(Date.parse(today+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 const past=await f.publish({displayDate:shift(-1)}),future=await f.publish({displayDate:shift(1)}),current=await f.publish();
 assert.equal((await f.api('/api/reflections/today')).data.reflection.id,current.id);const library=(await f.api('/api/reflections/library')).data;assert.equal(library.total,1);assert.equal(library.items[0].id,past.id);assert.equal((await f.api('/api/reflections/'+future.id)).status,404);
 assert.equal((await f.api('/api/reflections/library?page=-1')).status,400);await f.restart();assert.equal((await f.api('/api/reflections/today')).data.reflection.id,current.id);
});
test('Vietnam day rolls over at UTC 17:00 regardless of server timezone',()=>{
 assert.equal(vietnamDate(new Date('2026-11-15T16:59:59Z')),'2026-11-15');assert.equal(vietnamDate(new Date('2026-11-15T17:00:00Z')),'2026-11-16');
});
test('archive pagination is ordered and bounded, while source text is stored verbatim',async t=>{
 const f=await fixture(t),today=vietnamDate();for(let i=1;i<=13;i++)await f.publish({displayDate:new Date(Date.parse(today+'T00:00:00Z')-i*86400000).toISOString().slice(0,10),content:i===1?'<img src=x onerror=alert(1)>':`Nội dung kiểm thử ${i}`});
 const first=(await f.api('/api/reflections/library')).data,second=(await f.api('/api/reflections/library?page=1')).data;
 assert.equal(first.items.length,12);assert.equal(second.items.length,1);assert.equal(first.pages,2);assert.equal(first.items[0].content,'<img src=x onerror=alert(1)>');assert.ok(first.items[11].displayDate>second.items[0].displayDate);assert.equal((await f.api('/api/reflections/library?page=999')).data.page,1);
 const row=await f.create();assert.equal((await f.act(row,'__proto__')).status,409);assert.equal((await f.act(row,['submit'])).status,409);
});
