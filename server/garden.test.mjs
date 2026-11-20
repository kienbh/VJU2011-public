import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAppServer} from './app.mjs';
import {verifyBcseToken,createSso} from './sso.mjs';
import {DatabaseSync} from 'node:sqlite';
const TOKEN='garden-tests-admin-token-'.repeat(3);
const BODY={flowers:['rose','lotus'],signature:'Người thử',recipient:'Thầy cô VJU',message:'Cảm ơn thầy cô đã đồng hành cùng chúng em.'};
async function fixture(t,options={}){
 const dir=await mkdtemp(path.join(os.tmpdir(),'vju-garden-'));let server,url;
 async function boot(){server=createAppServer({dbPath:path.join(dir,'db.sqlite'),adminToken:TOKEN,seedSamples:false,logger:()=>{},gardenIdentity:async req=>req.headers['x-test-user']?{issuer:'https://test.example',subject:req.headers['x-test-user'],name:'QA'}:null,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port;}
 const close=()=>new Promise(r=>server.close(r));await boot();
 t.after(async()=>{await close();assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('vju-garden-'));await rm(dir,{recursive:true,force:true});});
 async function api(route,{user,body,key=randomUUID(),token,origin=true}={}){const r=await fetch(url+route,{method:body?'POST':'GET',headers:{...(user?{'x-test-user':user}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json','Idempotency-Key':key,...(origin?{Origin:url}:{})}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 return {api,restart:async()=>{await close();await boot();}};
}
test('server limit survives concurrent requests, replay, rename and restart',async t=>{
 const f=await fixture(t),key=randomUUID();
 const first=await f.api('/api/garden/pots',{user:'student1',body:BODY,key});assert.equal(first.status,201);
 assert.equal((await f.api('/api/garden/pots',{user:'student1',body:BODY,key})).data.duplicate,true);
 assert.equal((await f.api('/api/garden/pots',{user:'student1',body:{...BODY,message:'Another different thank you'},key})).status,409);
 const attempts=await Promise.all(Array.from({length:5},(_,i)=>f.api('/api/garden/pots',{user:'student1',body:{...BODY,signature:'Name '+i}})));
 assert.equal(attempts.filter(r=>r.status===201).length,2);assert.equal(attempts.filter(r=>r.data.code==='GARDEN_LIMIT').length,3);
 await f.restart();assert.equal((await f.api('/api/garden',{user:'student1'})).data.account.used,3);
 assert.equal((await f.api('/api/garden/pots',{user:'student1',body:BODY})).data.code,'GARDEN_LIMIT');
 assert.equal((await f.api('/api/garden/pots',{user:'student2',body:BODY,key})).status,201);
});
test('moderation hides names and wishes, stable slots and true global counts',async t=>{
 const f=await fixture(t);await f.api('/api/admin/settings',{token:TOKEN,body:{autoApprove:false}});const first=await f.api('/api/garden/pots',{user:'first',body:{...BODY,signature:'PRIVATE-NAME',message:'PRIVATE-WISH-DO-NOT-EXPOSE'}});
 for(let i=1;i<25;i++)assert.equal((await f.api('/api/garden/pots',{user:'u'+i,body:BODY})).status,201);
 let garden=(await f.api('/api/garden')).data;assert.equal(garden.total,25);assert.equal(garden.published,0);assert.equal(garden.pages,2);assert.equal(garden.slots.length,24);assert.ok(!JSON.stringify(garden).includes('PRIVATE'));assert.ok(garden.slots.every(p=>p===null));
 const owner=(await f.api('/api/garden?page=1',{user:'u24'})).data;assert.equal(owner.slots[0],null);assert.equal(owner.mine[0].sequence,25);assert.equal(owner.mine[0].status,'pending');
 await f.api('/api/admin/greetings/'+first.data.pot.id+'/moderate',{token:TOKEN,body:{action:'approve'}});
 garden=(await f.api('/api/garden')).data;assert.equal(garden.published,1);assert.equal(garden.slots[0].signature,'PRIVATE-NAME');assert.equal(garden.slots[0].slot,0);assert.equal(garden.slots[0].mine,false);
 await f.api('/api/admin/greetings/'+first.data.pot.id+'/moderate',{token:TOKEN,body:{action:'reject'}});
 garden=(await f.api('/api/garden')).data;assert.equal(garden.total,25);assert.equal(garden.published,0);assert.equal(garden.slots[0],null);
 const mine=(await f.api('/api/garden',{user:'first'})).data;assert.equal(mine.account.used,1);assert.equal(mine.mine[0].status,'rejected');assert.equal(mine.slots[0],null);
});
test('unauthenticated, forged browser identity, closed intake and invalid flowers fail closed',async t=>{
 const noSso=await fixture(t,{gardenIdentity:null});assert.equal((await noSso.api('/api/garden/pots',{user:'fake',body:BODY})).data.code,'SSO_UNAVAILABLE');
 const f=await fixture(t);assert.equal((await f.api('/api/garden/pots',{body:BODY})).status,401);
 assert.equal((await f.api('/api/garden/pots',{user:'u',body:BODY,origin:false})).status,403);
 assert.equal((await f.api('/api/garden/pots',{user:'u',body:{...BODY,flowers:['invalid']}})).status,400);
 assert.equal((await f.api('/api/garden/pots',{user:'u',body:{...BODY,owner:'other'}})).status,400);
 const closed=await fixture(t,{submissionsEnabled:false});assert.equal((await closed.api('/api/garden/pots',{user:'u',body:BODY})).data.code,'EVENT_CLOSED');assert.equal((await closed.api('/api/garden')).data.total,0);
});
test('BCSE ID verifies signature, issuer, audience, expiry and algorithm',()=>{
 const c={issuer:'https://id.bcse-vju.com',clientId:'sv11-vju2011',jwtSecret:'test-secret-'.repeat(5)},now=Date.now();
 const payload={iss:c.issuer,aud:c.clientId,sub:'identity-1',iat:Math.floor(now/1000),exp:Math.floor(now/1000)+3600};
 function jwt(p=payload,h={alg:'HS256'},secret=c.jwtSecret){const data=[h,p].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');}
 assert.equal(verifyBcseToken(jwt(),c,now).sub,'identity-1');
 for(const token of [jwt({...payload,aud:'other'}),jwt({...payload,iss:'https://attacker.example'}),jwt({...payload,exp:1}),jwt({...payload,sub:''}),jwt(payload,{alg:'none'}),jwt(payload,{alg:'HS256'},'wrong')])assert.throws(()=>verifyBcseToken(token,c,now));
});

test('SSO binds one-time state to browser, issues hashed session and logs out',async t=>{
 const db=new DatabaseSync(':memory:');t.after(()=>db.close());
 const config={issuer:'https://id.bcse-vju.com',clientId:'sv11-vju2011',clientSecret:'test-client-secret',jwtSecret:'test-jwt-secret-'.repeat(4),appOrigin:'https://sv11.bcse-vju.com'};
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},writeHead(status,headers){this.status=status;Object.assign(this.headers,headers);},end(){}});
 const sso=createSso(db,{config,json:(res,status,body)=>{res.status=status;res.body=body;},fail:()=>{throw Error('Forbidden');},rate:()=>{}});
 const req=(method='GET',cookie='',origin)=>({method,headers:{cookie,origin}});
 const route=(path,r=req(),res=response())=>sso.route(r,res,new URL(path,config.appOrigin)).then(()=>res);
 const start=await route('/api/auth/sso/authorize');assert.equal(start.status,303);assert.match(start.headers['Set-Cookie'],/HttpOnly; SameSite=Lax; Max-Age=600; Secure/);
 const state=new URL(start.headers.Location).searchParams.get('state'),browserCookie=start.headers['Set-Cookie'].split(';')[0];
 const bad=await route('/api/auth/sso/callback?code=qa&state='+state);assert.equal(bad.headers.Location,'/?sso=failed');
 const p={iss:config.issuer,aud:config.clientId,sub:'verified-identity',name:'QA',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600};
 const input=[{alg:'HS256'},p].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');const token=input+'.'+createHmac('sha256',config.jwtSecret).update(input).digest('base64url');
 let calls=0;t.mock.method(globalThis,'fetch',async(url,init)=>{calls++;assert.equal(String(url),config.issuer+'/api/oidc/token');assert.equal(init.redirect,'error');assert.match(init.headers.Authorization,/^Basic /);return {ok:true,json:async()=>({id_token:token})};});
 const good=await route('/api/auth/sso/callback?code=qa&state='+state,req('GET',browserCookie));assert.equal(good.headers.Location,'/?view=walk&festival=1&intro=0&garden=1');
 const sessionCookie=good.headers['Set-Cookie'][1].split(';')[0];assert.equal((await sso.identity(req('GET',sessionCookie))).subject,'verified-identity');
 const row=db.prepare('SELECT * FROM garden_sessions').get();assert.ok(!sessionCookie.includes(row.token_hash));assert.equal(row.subject,'verified-identity');
 const repeat=await route('/api/auth/sso/callback?code=qa&state='+state,req('GET',browserCookie));assert.equal(repeat.headers.Location,'/?sso=failed');assert.equal(calls,1);
 await assert.rejects(()=>route('/api/auth/sso/logout',req('POST',sessionCookie,'https://evil.example')));
 await route('/api/auth/sso/logout',req('POST',sessionCookie,config.appOrigin));assert.equal(await sso.identity(req('GET',sessionCookie)),null);
});
