import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {createAppServer} from './app.mjs';

const TOKEN='test-only-admin-token-'.repeat(3);
const payload=overrides=>({recipientId:'general',message:'Cảm ơn thầy cô đã đồng hành cùng chúng em.',signature:'Người gửi thử',className:'Lớp thử',visibility:'public',gift:'flowers',...overrides});
async function fixture(t,options={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'vju2011-api-')),dbPath=path.join(dir,'test.sqlite'),staticRoot=path.join(dir,'dist');await mkdir(staticRoot);await writeFile(path.join(staticRoot,'index.html'),'<!doctype html><title>LOCAL TEST</title>');
 let server,url;
 const boot=async()=>{server=createAppServer({dbPath,adminToken:TOKEN,staticRoot,logger:()=>{},...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;};
 const close=()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await boot();
 t.after(async()=>{if(server.listening)await close();const resolved=path.resolve(dir);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('vju2011-api-'));await rm(resolved,{recursive:true,force:true});});
 async function api(route,{method='GET',body,token,headers={}}={}){if(headers.Host)return new Promise((resolve,reject)=>{const req=http.request(url+route,{method,headers:{...headers,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>{let data;try{data=JSON.parse(text);}catch{data=text;}resolve({status:res.statusCode,data,headers:new Headers(res.headers)});});});req.on('error',reject);req.end(body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body));});const response=await fetch(url+route,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`} : {}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return {status:response.status,data,headers:response.headers};}
 return {api,dir,dbPath,staticRoot,restart:async()=>{await close();await boot();},url:()=>url};
}
const submit=(f,body=payload(),key=randomUUID())=>f.api('/api/greetings',{method:'POST',body,headers:{'Idempotency-Key':key}});
const moderate=(f,id,action)=>f.api(`/api/admin/greetings/${id}/moderate`,{method:'POST',token:TOKEN,body:{action}});

test('coffee and Xuyen Chi survive submission, moderation and server restart',async t=>{
 const f=await fixture(t),key=randomUUID(),body=payload({gift:'coffee'});
 const coffee=await submit(f,body,key);assert.equal(coffee.status,201);
 const flowers=await submit(f,payload({gift:'flowers',bouquet:['bidens','rose','daisy','bidens','lotus']}));assert.equal(flowers.status,201);
 await f.restart();assert.equal((await submit(f,body,key)).status,200);
 await moderate(f,coffee.data.id,'approve');await moderate(f,flowers.data.id,'approve');
 const wall=(await f.api('/api/greetings')).data.greetings;
 assert.equal(wall.find(g=>g.id===coffee.data.id).gift,'coffee');assert.equal(wall.find(g=>g.id===flowers.data.id).bouquet[0],'bidens');
});

test('public wall exposes approved public only; private content and identities stay private',async t=>{
 const f=await fixture(t);await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{autoApprove:false}});const initial=await f.api('/api/greetings');assert.equal(initial.data.greetings.length,3);assert.ok(initial.data.greetings.every(g=>g.isSample&&g.message.startsWith('[THIỆP MẪU]')));
 const pub=await submit(f,payload({message:'Public pending content for moderation'}));const priv=await submit(f,payload({visibility:'private',message:'PRIVATE-CONTENT-DO-NOT-EXPOSE',signature:'PRIVATE-NAME',className:'PRIVATE-CLASS'}));assert.equal(pub.status,201);assert.equal(priv.status,201);
 let wall=await f.api('/api/greetings');assert.equal(wall.data.greetings.length,3);
 const pending=await f.api('/api/admin/greetings?status=pending',{token:TOKEN});assert.equal(pending.data.greetings.length,2);assert.ok(pending.data.greetings.some(g=>g.message==='PRIVATE-CONTENT-DO-NOT-EXPOSE'));assert.ok(!JSON.stringify(pending.data).includes(priv.data.receiptToken));
 assert.equal((await moderate(f,pub.data.id,'approve')).status,200);assert.equal((await moderate(f,priv.data.id,'approve')).status,200);
 wall=await f.api('/api/greetings');assert.equal(wall.data.greetings.length,4);assert.ok(wall.data.greetings.some(g=>g.id===pub.data.id));for(const secret of ['PRIVATE-CONTENT','PRIVATE-NAME','PRIVATE-CLASS',priv.data.id,priv.data.receiptToken])assert.ok(!JSON.stringify(wall.data).includes(secret));
 const receipt=await f.api(`/api/receipts/${priv.data.id}`,{token:priv.data.receiptToken});assert.deepEqual(receipt.data,{status:'approved',visibility:'private',recipientName:'Tập thể thầy cô và cán bộ nhân viên VJU'});
 await moderate(f,pub.data.id,'reject');assert.equal((await f.api('/api/greetings')).data.greetings.length,3);
});

test('custom recipient and book details persist, remain moderated, and participate in idempotency',async t=>{
 const f=await fixture(t);await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{autoApprove:false}});const key=randomUUID(),body=payload({recipientId:'teacher',recipientName:'Thầy Nguyễn Văn A',gift:'book',bookTitle:'Một cuốn sách',bookAuthor:'Tác giả thử nghiệm'});
 const first=await submit(f,body,key);assert.equal(first.status,201);
 assert.ok(!(await f.api('/api/greetings')).data.greetings.some(g=>g.id===first.data.id));
 await f.restart();assert.equal((await submit(f,body,key)).status,200);
 assert.equal((await submit(f,{...body,bookAuthor:'Different'},key)).status,409);
 await moderate(f,first.data.id,'approve');
 const card=(await f.api('/api/greetings')).data.greetings.find(g=>g.id===first.data.id);
 assert.equal(card.recipientName,body.recipientName);assert.equal(card.bookTitle,body.bookTitle);assert.equal(card.bookAuthor,body.bookAuthor);
 assert.equal((await submit(f,payload({recipientId:'other',recipientName:'Tập thể lớp'}))).status,201);
 for(const extra of [{recipientId:'teacher',recipientName:''},{gift:'book',bookTitle:'Book'},{gift:'tea',bookTitle:'Book',bookAuthor:'Author'},{recipientId:'general',recipientName:'Override'},{recipientId:'other',recipientName:'a'.repeat(121)}])assert.equal((await submit(f,payload(extra))).status,400);
});

test('idempotency survives restart; same request replay returns same receipt and mismatch conflicts',async t=>{
 const f=await fixture(t);await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{autoApprove:false}});const key=randomUUID(),body=payload();
 const first=await submit(f,body,key);assert.equal(first.status,201);assert.equal(first.data.duplicate,false);
 const replay=await submit(f,body,key);assert.equal(replay.status,200);assert.equal(replay.data.id,first.data.id);assert.equal(replay.data.receiptToken,first.data.receiptToken);assert.equal(replay.data.duplicate,true);
 assert.equal((await submit(f,payload({message:'This is a different message entirely'}),key)).status,409);
 await f.restart();const persisted=await submit(f,body,key);assert.equal(persisted.status,200);assert.equal(persisted.data.receiptToken,first.data.receiptToken);assert.equal((await f.api('/api/admin/greetings?status=pending',{token:TOKEN})).data.greetings.length,1);
 const concurrentKey=randomUUID(),receipts=await Promise.all(Array.from({length:5},()=>submit(f,body,concurrentKey)));assert.equal(receipts.filter(r=>r.status===201).length,1);assert.equal(receipts.filter(r=>r.status===200).length,4);assert.equal(new Set(receipts.map(r=>r.data.id)).size,1);
});

test('admin/receipt auth and CSRF reject unauthorized callers without revealing private receipt existence',async t=>{
 const f=await fixture(t);const saved=await submit(f,payload({visibility:'private'}));
 assert.equal((await f.api('/api/admin/greetings')).status,401);assert.equal((await f.api('/api/admin/settings',{method:'POST',body:{acceptingSubmissions:false}})).status,401);assert.equal((await f.api(`/api/admin/greetings/${saved.data.id}/moderate`,{method:'POST',body:{action:'approve'}})).status,401);
 const bad=await f.api(`/api/receipts/${saved.data.id}`,{token:'wrong-token'}),missing=await f.api(`/api/receipts/${randomUUID()}`,{token:'wrong-token'});assert.equal(bad.status,404);assert.deepEqual(bad.data,missing.data);
 const forbidden=await submit(f,payload());assert.equal(forbidden.status,201);
 const csrf=await f.api('/api/greetings',{method:'POST',body:payload(),headers:{Origin:'https://attacker.invalid','Idempotency-Key':randomUUID()}});assert.equal(csrf.status,403);assert.equal(csrf.data.code,'ORIGIN_FORBIDDEN');
 const nullOrigin=await f.api('/api/config',{headers:{Origin:'null'}});assert.equal(nullOrigin.status,403);
 const allowed=await f.api('/api/config',{headers:{Origin:'http://127.0.0.1:5173'}});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('access-control-allow-origin'),'http://127.0.0.1:5173');assert.equal(allowed.data.event.mode,'rehearsal');assert.deepEqual(allowed.data.recipients,[{id:'general',name:'Tập thể thầy cô và cán bộ nhân viên VJU'}]);
});

test('event switch and real closingAt block new submissions; settings and moderation survive restart',async t=>{
 const f=await fixture(t),key=randomUUID(),body=payload(),saved=await submit(f,body,key);await moderate(f,saved.data.id,'approve');
 const off=await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{acceptingSubmissions:false,effectsEnabled:false,mode:'rehearsal'}});assert.equal(off.data.event.acceptingSubmissions,false);assert.equal((await submit(f)).data.code,'EVENT_CLOSED');
 assert.equal((await submit(f,body,key)).status,200);
 await f.restart();const cfg=await f.api('/api/config');assert.equal(cfg.data.event.acceptingSubmissions,false);assert.equal(cfg.data.event.effectsEnabled,false);assert.ok((await f.api('/api/greetings')).data.greetings.some(g=>g.id===saved.data.id));
 const past=new Date(Date.now()-1000).toISOString();await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{acceptingSubmissions:true,closingAt:past}});assert.equal((await submit(f)).status,403);assert.equal((await f.api('/api/config')).data.event.acceptingSubmissions,false);
 await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{closingAt:null}});assert.equal((await submit(f)).status,201);
});

test('input limits, enums, unknown recipients and malformed/oversized JSON fail without writes',async t=>{
 const f=await fixture(t);for(const changes of [{message:''},{message:'short'},{message:'x'.repeat(1001)},{signature:'s'.repeat(81)},{className:3},{recipientId:'not-configured'},{visibility:'everyone'},{gift:'money'},{message:'valid text\u0000 invalid'},{unexpected:true}])assert.equal((await submit(f,payload(changes))).status,400,JSON.stringify(changes));
 assert.equal((await f.api('/api/greetings',{method:'POST',body:payload()})).status,400);
 assert.equal((await f.api('/api/greetings',{method:'POST',body:'{bad',headers:{'Idempotency-Key':randomUUID()}})).status,400);
 assert.equal((await f.api('/api/greetings',{method:'POST',body:'[]',headers:{'Idempotency-Key':randomUUID()}})).status,400);
 assert.equal((await f.api('/api/greetings',{method:'POST',body:'x'.repeat(33000),headers:{'Idempotency-Key':randomUUID()}})).status,413);
 const chunkedStatus=await new Promise((resolve,reject)=>{const request=http.request(f.url()+'/api/greetings',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),'Transfer-Encoding':'chunked'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.on('error',reject);request.write('x'.repeat(17000));request.end('x'.repeat(17000));});assert.equal(chunkedStatus,413);
 assert.equal((await f.api('/api/greetings',{method:'POST',body:payload(),headers:{'Idempotency-Key':randomUUID(),'Content-Type':'text/plain'}})).status,415);
 for(const body of [{acceptingSubmissions:'yes'},{effectsEnabled:0},{mode:'live'},{closingAt:'tomorrow'},{closingAt:'2026-11-20T18:00:00'},{}])assert.equal((await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body})).status,400);
 assert.equal((await f.api('/api/admin/greetings?status=bogus',{token:TOKEN})).status,400);assert.equal((await f.api('/api/admin/greetings?status=all',{token:TOKEN})).data.greetings.length,3);
 assert.equal((await submit(f,payload({message:'1234567890',signature:'',className:''}))).status,201);
});

test('static files stay within dist, no directory/secret access; no client token leakage',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.dir,'admin-token.txt'),'NOT-A-PUBLIC-TOKEN');await mkdir(path.join(f.staticRoot,'assets'));await writeFile(path.join(f.staticRoot,'assets','app.js'),'console.log("local")');
 for(const route of ['/.local/admin-token.txt','/server/app.mjs','/assets/','/%2e%2e/admin-token.txt','/..%5cadmin-token.txt'])assert.equal((await f.api(route)).status,404,route);
 const page=await f.api('/');assert.equal(page.status,200);assert.ok(!page.data.includes(TOKEN));assert.equal(page.headers.get('x-content-type-options'),'nosniff');assert.equal((await f.api('/assets/app.js')).status,200);
 assert.equal((await f.api('/api/does-not-exist')).status,404);
});

test('rate limit returns 429 and retry-after, and approved recipient config is explicit',async t=>{
 const f=await fixture(t,{submissionRateLimit:2,recipients:[{id:'demo',name:'Nhóm nhận thử'}]});assert.equal((await f.api('/api/config')).data.recipients.length,2);
 assert.equal((await submit(f,payload({recipientId:'demo'}))).status,201);assert.equal((await submit(f)).status,201);const blocked=await submit(f);assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get('retry-after'))>0);
});

test('bouquet accepts exactly five flowers of the five supported kinds; invalid bouquets never write',async t=>{
 const f=await fixture(t);
 const invalid=[null,{},'rose',[],['rose'],Array(4).fill('rose'),Array(6).fill('rose'),['rose','daisy','sunflower','rose','lily'],['rose','daisy','sunflower','rose',null],['rose','daisy','sunflower','rose',{}],['Rose','daisy','sunflower','rose','rose']];
 for(const bouquet of invalid){const response=await submit(f,payload({bouquet}));assert.equal(response.status,400,JSON.stringify(bouquet));assert.equal(response.data.code,'INVALID_BOUQUET');}
 for(const gift of ['none','tea','book'])assert.equal((await submit(f,payload({gift,bouquet:Array(5).fill('rose')}))).data.code,'INVALID_BOUQUET');
 assert.equal((await f.api('/api/admin/greetings?status=pending',{token:TOKEN})).data.greetings.length,0);
 for(const kind of ['rose','daisy','sunflower','cosmos','lavender'])assert.equal((await submit(f,payload({bouquet:Array(5).fill(kind)}))).status,201,kind);
 assert.equal((await submit(f,payload({bouquet:['rose','daisy','sunflower','rose','daisy']}))).status,201);
 // Existing symbolic flower cards remain valid without a picked bouquet.
 assert.equal((await submit(f,payload())).status,201);
});

test('bouquet order participates in idempotency and persists in receipt/admin/public after restart',async t=>{
 const f=await fixture(t),key=randomUUID(),bouquet=['rose','daisy','sunflower','rose','daisy'],body=payload({bouquet});
 const first=await submit(f,body,key);assert.equal(first.status,201);
 const duplicate=await submit(f,body,key);assert.equal(duplicate.status,200);assert.equal(duplicate.data.id,first.data.id);
 assert.equal((await submit(f,payload({bouquet:['daisy','rose','sunflower','rose','daisy']}),key)).status,409);
 assert.equal((await submit(f,payload(),key)).status,409);
 await moderate(f,first.data.id,'approve');await f.restart();
 const replay=await submit(f,body,key);assert.equal(replay.status,200);assert.equal(replay.data.id,first.data.id);assert.equal(replay.data.receiptToken,first.data.receiptToken);assert.equal(replay.data.duplicate,true);
 assert.deepEqual((await f.api(`/api/receipts/${first.data.id}`,{token:first.data.receiptToken})).data.bouquet,bouquet);
 assert.deepEqual((await f.api('/api/admin/greetings?status=approved',{token:TOKEN})).data.greetings.find(g=>g.id===first.data.id).bouquet,bouquet);
 assert.deepEqual((await f.api('/api/greetings')).data.greetings.find(g=>g.id===first.data.id).bouquet,bouquet);
});

test('private bouquet stays private after approval and restart, while its authenticated receipt remains usable',async t=>{
 const f=await fixture(t),bouquet=Array(5).fill('sunflower'),body=payload({bouquet,visibility:'private',message:'BOUQUET-PRIVATE-MESSAGE',signature:'BOUQUET-PRIVATE-SIGNATURE'});
 const saved=await submit(f,body);assert.equal(saved.status,201);await moderate(f,saved.data.id,'approve');await f.restart();
 const publicResult=await f.api('/api/greetings');for(const secret of [saved.data.id,body.message,body.signature,saved.data.receiptToken,JSON.stringify(bouquet)])assert.ok(!JSON.stringify(publicResult.data).includes(secret),secret);
 assert.equal((await f.api(`/api/receipts/${saved.data.id}`)).status,404);
 const receipt=await f.api(`/api/receipts/${saved.data.id}`,{token:saved.data.receiptToken});assert.equal(receipt.data.status,'approved');assert.equal(receipt.data.visibility,'private');assert.deepEqual(receipt.data.bouquet,bouquet);
 const admin=await f.api('/api/admin/greetings?status=approved',{token:TOKEN});assert.deepEqual(admin.data.greetings.find(g=>g.id===saved.data.id).bouquet,bouquet);
});


test('HTTPS deployment accepts only exact host and origin; forwarded headers grant no access',async t=>{
 const f=await fixture(t,{publicOrigin:'https://sv11.bcse-vju.com',seedSamples:false,releaseSha:'a'.repeat(40)});
 const good={Host:'sv11.bcse-vju.com',Origin:'https://sv11.bcse-vju.com'};
 assert.equal((await f.api('/api/config',{headers:good})).status,200);
 for(const headers of [{Host:'evil.invalid'},{Host:'sv11.bcse-vju.com',Origin:'https://evil.invalid'},{Host:'sv11.bcse-vju.com',Origin:'http://sv11.bcse-vju.com'},{Host:'sv11.bcse-vju.com',Origin:'http://127.0.0.1:5173'},{Host:'evil.invalid','X-Forwarded-Host':'sv11.bcse-vju.com','X-Forwarded-Proto':'https'}])assert.equal((await f.api('/api/config',{headers})).status,403);
 assert.equal((await f.api('/',{headers:{Host:'evil.invalid'}})).status,403);
 assert.equal((await f.api('/api/admin/greetings?admin=1',{headers:good})).status,401);
 const health=await f.api('/api/health',{headers:good});assert.equal(health.data.release,'a'.repeat(40));assert.ok(!JSON.stringify(health.data).includes(TOKEN));
});

test('runtime submission lock cannot be bypassed by admin settings; clean DB can remain sample-free',async t=>{
 const f=await fixture(t,{submissionsEnabled:false,seedSamples:false,publicOnly:true});
 assert.equal((await f.api('/api/greetings')).data.greetings.length,0);
 await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{acceptingSubmissions:true}});
 assert.equal((await f.api('/api/config')).data.event.acceptingSubmissions,false);
 assert.equal((await submit(f)).data.code,'EVENT_CLOSED');await f.restart();
 assert.equal((await f.api('/api/greetings')).data.greetings.length,0);assert.equal((await submit(f)).status,403);
});

test('public-only release rejects new private cards but preserves old private data and retry receipts',async t=>{
 const options={seedSamples:false,publicOnly:false};const f=await fixture(t,options),key=randomUUID(),privateBody=payload({visibility:'private',message:'LEGACY PRIVATE MUST STAY HIDDEN'});
 await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{autoApprove:false}});
 const old=await submit(f,privateBody,key);await moderate(f,old.data.id,'approve');options.publicOnly=true;await f.restart();
 assert.equal((await f.api('/api/config')).data.event.publicOnly,true);
 assert.equal((await submit(f,privateBody)).data.code,'PUBLIC_ONLY');
 assert.equal((await submit(f,privateBody,key)).data.receiptToken,old.data.receiptToken);
 assert.equal((await f.api('/api/greetings')).data.greetings.length,0);
 const fresh=await submit(f);assert.equal(fresh.data.status,'pending');assert.equal((await f.api('/api/greetings')).data.greetings.length,0);
 await moderate(f,fresh.data.id,'approve');assert.equal((await f.api('/api/greetings')).data.greetings.length,1);
 await moderate(f,fresh.data.id,'reject');assert.equal((await f.api('/api/greetings')).data.greetings.length,0);
});

test('read traffic does not exhaust submissions; forwarded IP cannot evade submit or admin throttles',async t=>{
 const f=await fixture(t,{readRateLimit:5,submissionRateLimit:2,seedSamples:false});
 for(let i=0;i<5;i++)assert.equal((await f.api('/api/config')).status,200);
 assert.equal((await f.api('/api/config')).status,429);
 assert.equal((await submit(f)).status,201);assert.equal((await submit(f)).status,201);
 assert.equal((await f.api('/api/greetings',{method:'POST',body:payload(),headers:{'Idempotency-Key':randomUUID(),'X-Forwarded-For':'1.2.3.4','CF-Connecting-IP':'1.2.3.4'}})).status,429);
 const g=await fixture(t,{seedSamples:false});for(let i=0;i<10;i++)assert.equal((await g.api('/api/admin/greetings',{token:'wrong'})).status,401);
 assert.equal((await g.api('/api/admin/greetings',{token:'wrong',headers:{'X-Forwarded-For':'2.3.4.5'}})).status,429);
 assert.equal((await g.api('/api/admin/greetings',{token:TOKEN})).status,200);
});

test('runtime deployment defaults fail closed and reject ambiguous configuration',async()=>{
 const {runtimeConfig}=await import('./runtimeConfig.mjs');const root=path.resolve('.');
 const c=runtimeConfig({},root);assert.equal(c.submissionsEnabled,false);assert.equal(c.seedSamples,false);assert.equal(c.publicOnly,true);
 for(const env of [{ALLOW_SUBMISSIONS:'true'},{SEED_SAMPLES:'yes'},{PORT:'0'},{DATA_DIR:'relative'},{PUBLIC_ORIGIN:'http://sv11.bcse-vju.com'},{PUBLIC_ORIGIN:'https://sv11.bcse-vju.com/path'}])assert.throws(()=>runtimeConfig(env,root));
});


test('consistent SQLite backup restores pending decisions, privacy, closure and idempotent receipt',async t=>{
 const {DatabaseSync,backup}=await import('node:sqlite');const f=await fixture(t,{seedSamples:false});
 const key=randomUUID(),body=payload({message:'BACKUP PUBLIC — Nhật Việt 日本語 感謝'}),saved=await submit(f,body,key);
 const hidden=await submit(f,payload({visibility:'private',message:'BACKUP PRIVATE NEVER PUBLIC'}));
 await moderate(f,saved.data.id,'approve');await moderate(f,hidden.data.id,'approve');
 await f.api('/api/admin/settings',{method:'POST',token:TOKEN,body:{acceptingSubmissions:false}});
 const source=new DatabaseSync(f.dbPath,{readOnly:true}),restorePath=path.join(f.dir,'restored.sqlite');await backup(source,restorePath);source.close();
 const restored=createAppServer({dbPath:restorePath,adminToken:TOKEN,seedSamples:false});await new Promise(r=>restored.listen(0,'127.0.0.1',r));t.after(()=>restored.listening?new Promise(r=>restored.close(r)):undefined);
 const root=`http://127.0.0.1:${restored.address().port}`;
 const wall=await(await fetch(root+'/api/greetings')).json();assert.deepEqual(wall.greetings.map(x=>x.id),[saved.data.id]);assert.ok(!JSON.stringify(wall).includes('PRIVATE'));
 assert.equal((await(await fetch(root+'/api/config')).json()).event.acceptingSubmissions,false);
 const replay=await fetch(root+'/api/greetings',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});assert.equal(replay.status,200);assert.equal((await replay.json()).receiptToken,saved.data.receiptToken);
 await new Promise(r=>restored.close(r));
});


test('new cards normalize excessive whitespace and bidi controls; raw retries still match',async t=>{
 const f=await fixture(t,{seedSamples:false}),body=payload({message:'Cảm ơn'+ '\n'.repeat(300)+'thầy cô   日本語\u202E',signature:'Người   gửi\u2066'}),key=randomUUID();
 const saved=await submit(f,body,key);assert.equal(saved.status,201);
 const rows=(await f.api('/api/admin/greetings?status=all',{token:TOKEN})).data.greetings;
 assert.equal(rows[0].message,'Cảm ơn\n\nthầy cô 日本語');assert.equal(rows[0].signature,'Người gửi');
 await f.restart();const replay=await submit(f,body,key);assert.equal(replay.status,200);assert.equal(replay.data.id,saved.data.id);
 assert.equal((await submit(f,payload({message:'A'+ '\n'.repeat(300)+'B'}))).status,400);
});

test('unexpected errors log route and location without text, credentials or query; summaries count errors',async t=>{
 const records=[],f=await fixture(t,{logger:record=>records.push(record)});
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(f.dbPath);
 db.exec("CREATE TRIGGER qa_fail BEFORE INSERT ON greetings BEGIN SELECT RAISE(FAIL,'DO-NOT-LOG-PRIVATE-TEXT'); END;");
 const bad=await f.api('/api/greetings?secret=PRIVATE-QUERY',{method:'POST',body:payload({message:'PRIVATE-CARD-CONTENT'}),headers:{'Idempotency-Key':randomUUID(),Authorization:`Bearer ${TOKEN}`}});
 assert.equal(bad.status,500);assert.equal(bad.data.code,'INTERNAL_ERROR');
 const error=records.find(r=>r.event==='server_error');assert.equal(error.route,'/api/greetings');assert.equal(error.method,'POST');assert.ok(error.locations.length);assert.match(error.id,/^[a-f0-9-]{36}$/);
 db.exec('DROP TRIGGER qa_fail');db.close();await f.restart();
 assert.equal(records.find(r=>r.event==='request_summary').serverErrors,1);
 for(const secret of ['DO-NOT-LOG-PRIVATE-TEXT','PRIVATE-QUERY','PRIVATE-CARD-CONTENT',TOKEN])assert.ok(!JSON.stringify(records).includes(secret));
});


test('board paginates all approved public cards in stable order, excludes private and clamps after removal',async t=>{
 const f=await fixture(t,{seedSamples:false,submissionRateLimit:200});
 assert.deepEqual((await f.api('/api/greetings/board')).data,{greetings:[],page:0,pageSize:24,total:0,pages:1});
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(f.dbPath);
 try{
 const insert=db.prepare('INSERT INTO greetings(id,receipt_token,recipient_id,recipient_name,message,signature,class_name,visibility,gift,status,created_at,is_sample) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
 for(let i=0;i<106;i++)insert.run(String(i).padStart(4,'0'),'SECRET-'+i,'general','Thầy cô','Lời chúc thử '+i,'Tên mẫu','','public','none','approved','2026-11-15T00:00:00Z',0);
 for(const [id,visibility,status] of [['private','private','approved'],['pending','public','pending'],['rejected','public','rejected']])insert.run(id,'HIDDEN-TOKEN','general','HIDDEN-RECIPIENT','HIDDEN-CONTENT','HIDDEN-NAME','HIDDEN-CLASS',visibility,'none',status,'2026-11-15T00:00:00Z',0);
 const ids=[];
 for(let n=0;n<5;n++){const r=await f.api('/api/greetings/board?page='+n);assert.equal(r.status,200);assert.equal(r.data.page,n);assert.equal(r.data.total,106);assert.equal(r.data.pages,5);ids.push(...r.data.greetings.map(c=>c.id));assert.ok(!JSON.stringify(r.data).includes('HIDDEN'));assert.ok(!JSON.stringify(r.data).includes('SECRET'));assert.ok(r.data.greetings.every(c=>!('receiptToken' in c)&&!('receipt_token' in c)));}
 assert.equal(new Set(ids).size,106);assert.deepEqual(ids,Array.from({length:106},(_,i)=>String(i).padStart(4,'0')));
 for(const value of ['-1','1.5','bad','10000000'])assert.equal((await f.api('/api/greetings/board?page='+value)).status,400);
 db.prepare("UPDATE greetings SET status='rejected' WHERE visibility='public' AND id >= '0020'").run();
 const last=await f.api('/api/greetings/board?page=4');assert.equal(last.data.page,0);assert.equal(last.data.total,20);assert.equal(last.data.greetings.length,20);
 }finally{db.close();}
});
