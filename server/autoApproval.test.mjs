import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createAppServer} from './app.mjs';

const token='qa-auto-approval-'.repeat(4),issuer='https://sso.test',origin='http://localhost:5173';
const greeting={recipientId:'general',message:'Cảm ơn thầy cô đã đồng hành cùng chúng em.',signature:'QA',className:'',visibility:'public',gift:'flowers'};
const pot={flowers:['rose'],signature:'QA',recipient:'Thầy cô',message:greeting.message};

test('auto approval defaults on for old settings, persists, preserves pending/rejected/private and replay semantics',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vju-auto-')),dbPath=path.join(dir,'qa.sqlite');let server,base;
 const start=async()=>{server=createAppServer({dbPath,adminToken:token,seedSamples:false,logger:()=>{},gardenIdentity:async()=>({issuer,subject:'gardener',name:'QA'})});await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;};
 const stop=()=>new Promise(r=>server.close(r));
 t.after(async()=>{if(server?.listening)await stop();assert.equal(path.dirname(dir),tmpdir());assert.ok(path.basename(dir).startsWith('vju-auto-'));await rm(dir,{recursive:true,force:true});});
 await start();
 const api=async(route,{body,admin=false,key=randomUUID()}={})=>{const r=await fetch(base+route,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json','Idempotency-Key':key,...(admin?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const setting=autoApprove=>api('/api/admin/settings',{admin:true,body:{autoApprove}});
 assert.equal((await api('/api/config')).data.event.autoApprove,true);
 // Emulate a database created before this setting existed, without schema changes.
 await stop();const db=new DatabaseSync(dbPath),stored=JSON.parse(db.prepare('SELECT event_json FROM settings').get().event_json);delete stored.autoApprove;db.prepare('UPDATE settings SET event_json=?').run(JSON.stringify(stored));db.close();await start();
 assert.equal((await api('/api/config')).data.event.autoApprove,true);
 const first=await api('/api/greetings',{body:greeting}),flower=await api('/api/garden/pots',{body:pot});
 assert.equal(first.data.status,'approved');assert.equal(flower.data.pot.status,'approved');
 assert.equal((await api('/api/garden')).data.published,1);assert.equal((await api('/api/greetings')).data.greetings.length,2);
 const priv=await api('/api/greetings',{body:{...greeting,visibility:'private',message:'PRIVATE NOT PUBLIC'}});
 assert.equal(priv.data.status,'approved');assert.ok(!(await api('/api/greetings')).data.greetings.some(g=>g.id===priv.data.id));
 await api('/api/admin/greetings/'+first.data.id+'/moderate',{admin:true,body:{action:'reject'}});
 assert.ok(!(await api('/api/greetings')).data.greetings.some(g=>g.id===first.data.id));
 assert.equal((await setting(false)).data.event.autoApprove,false);await stop();await start();
 assert.equal((await api('/api/config')).data.event.autoApprove,false);assert.equal((await api('/api/garden')).data.autoApprove,false);
 const key=randomUUID(),gardenKey=randomUUID(),waiting=await api('/api/greetings',{body:greeting,key}),waitingPot=await api('/api/garden/pots',{body:pot,key:gardenKey});
 assert.equal(waiting.data.status,'pending');assert.equal(waitingPot.data.pot.status,'pending');
 assert.equal((await api('/api/admin/greetings?status=pending',{admin:true})).data.greetings.length,2);
 await setting(true);
 const replay=await api('/api/greetings',{body:greeting,key}),replayPot=await api('/api/garden/pots',{body:pot,key:gardenKey});
 assert.equal(replay.status,200);assert.equal(replay.data.status,'pending');assert.equal(replay.data.id,waiting.data.id);
 assert.equal(replayPot.status,200);assert.equal(replayPot.data.pot.status,'pending');assert.equal(replayPot.data.pot.id,waitingPot.data.pot.id);
 const fresh=await api('/api/greetings',{body:greeting}),freshPot=await api('/api/garden/pots',{body:pot});
 assert.equal(fresh.data.status,'approved');assert.equal(freshPot.data.pot.status,'approved');
 assert.equal((await api('/api/garden')).data.published,2);
 assert.equal((await api('/api/admin/greetings?status=pending',{admin:true})).data.greetings.length,2);
 assert.equal((await api('/api/admin/greetings?status=rejected',{admin:true})).data.greetings[0].id,first.data.id);
 for(const id of [waiting.data.id,waitingPot.data.pot.id])assert.equal((await api('/api/admin/greetings/'+id+'/moderate',{admin:true,body:{action:'approve'}})).data.status,'approved');
 assert.equal((await api('/api/garden')).data.published,3);
 assert.equal((await api('/api/garden/pots',{body:pot})).status,409); // Quota still enforced.
 await api('/api/admin/settings',{admin:true,body:{acceptingSubmissions:false}});
 assert.equal((await api('/api/greetings',{body:greeting})).status,403);
 assert.equal((await api('/api/garden/pots',{body:pot})).status,403);
 assert.equal((await api('/api/admin/greetings?status=pending',{admin:true})).data.greetings.length,0);
});

test('admin and moderator can change auto approval; SSO needs allowed Origin and strict boolean',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'vju-auto-auth-')),dbPath=path.join(dir,'qa.sqlite');
 const server=createAppServer({dbPath,adminToken:token,seedSamples:false,logger:()=>{},moderationGrants:()=>[{issuer,subject:'admin',role:'admin'},{issuer,subject:'mod',role:'moderator'}],ssoConfig:{issuer,clientId:'qa',clientSecret:'qa',jwtSecret:'qa'.repeat(32),appOrigin:origin}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>server.close(r));assert.equal(path.dirname(dir),tmpdir());assert.ok(path.basename(dir).startsWith('vju-auto-auth-'));await rm(dir,{recursive:true,force:true});});
 const db=new DatabaseSync(dbPath),cookies={};
 for(const subject of ['admin','mod','student']){const session=randomUUID();cookies[subject]='vju_session='+session;db.prepare('INSERT INTO garden_sessions VALUES(?,?,?,?,?)').run(createHash('sha256').update(session).digest('hex'),issuer,subject,'QA',Date.now()+60000);}db.close();
 const base='http://127.0.0.1:'+server.address().port;
 const save=(who,value=false,from=origin)=>fetch(base+'/api/admin/approval-mode',{method:'POST',headers:{Cookie:cookies[who]||'',...(from?{Origin:from}:{}),'Content-Type':'application/json'},body:JSON.stringify({autoApprove:value})});
 assert.equal((await save('student')).status,401);assert.equal((await save('none')).status,401);assert.equal((await save('mod')).status,200);
 assert.equal((await fetch(base+'/api/admin/settings',{method:'POST',headers:{Cookie:cookies.mod,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({acceptingSubmissions:false})})).status,403);
 assert.equal((await fetch(base+'/api/admin/approval-mode',{method:'POST',headers:{Cookie:cookies.mod,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({autoApprove:true,acceptingSubmissions:false})})).status,400);
 assert.equal((await save('admin',false,null)).status,403);assert.equal((await save('admin',false,'https://evil.test')).status,403);
 for(const bad of ['false',0,null,{},[]])assert.equal((await save('admin',bad)).status,400);
 assert.equal((await save('admin')).status,200);
 assert.equal((await (await fetch(base+'/api/config')).json()).event.autoApprove,false);
});
